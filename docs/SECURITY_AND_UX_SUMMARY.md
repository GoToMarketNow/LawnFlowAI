# Gated AI Support System - Security & UX Implementation Summary

**Project**: LawnFlow.ai Gated AI Communications
**Focus**: Enterprise-grade security + Clean user experience
**Status**: Production-ready foundation (Sprints 1-2 complete)

---

## 🛡️ Security Architecture

### Multi-Layered Defense

#### 1. Database Level Security
**Row-Level Security (RLS)**:
```sql
-- Every table has multi-tenant isolation
CREATE POLICY knowledge_items_isolation ON knowledge_items
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);
```

- ✅ No business can access another's data
- ✅ Enforced at PostgreSQL level (not just application)
- ✅ Impossible to bypass via SQL injection

**Immutable Audit Trail**:
- All changes logged to audit_log
- Append-only (no deletions)
- Captures: action, actor, before/after state, timestamp
- Survives application-level hacks

**Data Integrity Constraints**:
```sql
-- Example: Version numbers must be sequential
UNIQUE(knowledge_item_id, version_number)

-- Example: Expiration must be after effective date
CHECK (retired_at IS NULL OR retired_at > published_at)
```

#### 2. Application Level Security
**Role-Based Access Control (RBAC)**:
```typescript
function requireRole(roles: string[]) {
  // Enforce at every endpoint
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
}
```

**Roles & Permissions**:
| Role | Knowledge | Support Queue | AI Assistant |
|------|-----------|---------------|--------------|
| Owner | Full (create, approve, publish, retire) | Full (view, assign, resolve) | Full (use, confirm actions) |
| Admin | Full (create, approve, publish, retire) | Full (view, assign, resolve) | Full (use, confirm actions) |
| Staff | Create, Edit, Submit | View, Respond | Read-only |
| Crew | None | None (internal threads only) | None |
| Customer | None | None | Read-only (chat widget) |

**Rate Limiting**:
```typescript
// Per-user, per-operation limits
checkOperationRateLimit(userId, "create_knowledge", 20, 60000) // 20/min
checkOperationRateLimit(userId, "update_knowledge", 30, 60000) // 30/min
```

**Input Sanitization**:
```typescript
// Remove XSS attempts
.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')

// Remove control characters
.replace(/[\x00-\x1F\x7F]/g, ' ')

// Encode special characters
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
```

#### 3. AI Assistant Gating (Sprint 3)
**No Hallucination Architecture**:
1. AI answers ONLY from published PSKB or read-only tools
2. Every response requires citations (knowledge_item_id + version_id)
3. Write actions create pending requests (not execute immediately)
4. Explicit user confirmation required
5. Fail-closed: No citations? Escalate to human.

**Idempotency**:
```typescript
// Prevent duplicate action execution
idempotency_key: `${actionType}-${conversationId}-${Date.now()}`

// DB constraint ensures uniqueness
UNIQUE(idempotency_key)
```

**Read-Only Tool Constraint**:
```sql
-- Database-level enforcement
is_read_only BOOLEAN NOT NULL DEFAULT TRUE,
CHECK (is_read_only = TRUE)
```

#### 4. API Security
**Parameterized Queries**:
```typescript
// SAFE: Drizzle ORM prevents SQL injection
await db.query.knowledgeItems.findMany({
  where: and(
    eq(knowledgeItems.businessId, businessId),
    eq(knowledgeItems.status, "published")
  )
});

// UNSAFE (not used):
// await db.execute(`SELECT * FROM knowledge WHERE business_id = ${businessId}`)
```

**HTTPS Enforcement**: (Production deployment)
- All API traffic encrypted
- Certificate pinning for mobile apps
- HSTS headers

**Token Security**:
- JWT with short expiration (1 hour)
- Refresh tokens with rotation
- Secure httpOnly cookies
- No tokens in localStorage

---

## 🎨 User Experience Design

### Clean & Easy UX Across All Roles

#### Owner/Admin Experience

**Knowledge Management**:
```
Create Draft → Submit for Review → Approve → Publish
     ↓              ↓                 ↓          ↓
  Auto-save    Validation         Preview    Live Search
               Warnings            Diff
```

**UX Features**:
- ✅ Auto-generated slugs from titles
- ✅ Validation errors vs warnings (warnings non-blocking)
- ✅ Version diff view (see what changed)
- ✅ Change notes on every version
- ✅ One-click retirement (not deletion)
- ✅ Search autocomplete
- ✅ Bulk operations ready

**Support Queue**:
```
Queue View: [Urgent] [High] [Normal] [Low]
     ↓
Filters: Priority | Coverage | Assigned | SLA Status
     ↓
Sort: Priority Desc | SLA Due | Recent
     ↓
Thread Detail: Messages | Matched Knowledge | Macro Suggestions
```

**SLA Urgency Indicators**:
- 🔴 Overdue (past SLA deadline)
- 🟠 Critical (within 30 minutes)
- 🟡 Soon (within 4 hours)
- 🟢 OK (plenty of time)

#### Staff Experience

**Simplified Workflow**:
1. Create knowledge draft
2. Submit for review (one click)
3. Wait for owner/admin approval
4. Live once approved

**Support Queue Access**:
- View all threads
- Respond to threads
- Mark first response / resolved
- See coverage status (know when PSKB has answer)

**Macro Suggestions**:
```
When PSKB coverage = "covered":
  → Show macro template
  → Pre-fill placeholders from context
  → Preview before send
  → One-click insert
```

#### Crew Experience

**Job-Scoped Visibility**:
- See ONLY threads for jobs they're assigned to
- Internal crew ↔ ops threads (never visible to customers)
- Carbon-copy guardrails (sanitize before sharing with customer)

**No Accidental Leaks**:
```typescript
// Validation layer prevents customer access to internal threads
validateThreadAccess(thread, userRole): boolean {
  if (userRole === "customer" && thread.threadType !== "customer") {
    throw new Error("Access denied");
  }
}
```

#### Customer Experience (Sprint 5)

**Chat Widget**:
- Floating chat button (bottom-right)
- Minimalist design
- Citations visible (trust building)
- Suggested actions (not auto-executed)

**Example Interaction**:
```
Customer: "How does autopay work?"