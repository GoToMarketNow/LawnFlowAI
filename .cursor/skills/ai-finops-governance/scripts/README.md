# AI FinOps Governance Validation Scripts

## Quick Start

Run the validation script to check compliance:

```bash
# Using npm/npx
npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts

# Or make executable and run directly
chmod +x .cursor/skills/ai-finops-governance/scripts/validate.sh
./.cursor/skills/ai-finops-governance/scripts/validate.sh
```

## What It Checks

### 1. Hardcoded API Keys
Scans for:
- OpenAI keys (sk-...)
- Anthropic keys (sk-ant-...)
- Direct apiKey assignments with string literals

**Pass criteria:** No hardcoded keys found

### 2. Environment Configuration
Looks for `src/config/env.ts` with:
- Zod schema validation
- Required fields: OPENAI_API_KEY, OPENAI_MODEL, DAILY_TOKEN_BUDGET

**Pass criteria:** Environment validation config exists with required fields

### 3. Monitoring Implementation
Checks for:
- Token tracking implementation
- Logging of token usage

**Pass criteria:** Both tracking and logging present

### 4. Secret Redaction
Scans for:
- `redactSecrets` function
- Log sanitization

**Pass criteria:** Redaction implementation found

## Exit Codes

- `0` - All checks passed
- `1` - One or more checks failed

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Validate AI Governance
  run: npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts
```

Add to pre-commit hook (`.git/hooks/pre-commit`):

```bash
#!/bin/bash
npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts || exit 1
```

## Output Example

```
🔍 Validating AI FinOps Governance...

Checking for hardcoded API keys...
Checking environment configuration...
Checking monitoring implementation...
Checking secret redaction...

============================================================
📊 Validation Results
============================================================

✅ No hardcoded API keys found
✅ Environment validation found
   src/config/env.ts
⚠️  Missing recommended field: DAILY_TOKEN_BUDGET
   src/config/env.ts
✅ Token tracking implementation found
✅ Token usage logging found
✅ Secret redaction implementation found

============================================================
✅ Passed: 5 | ❌ Failed: 1
============================================================

⚠️  Some governance checks failed. Review the guidelines in:
   .cursor/skills/ai-finops-governance/SKILL.md
```

## Customization

Edit `validate.ts` to add custom checks:

```typescript
private checkCustomRule() {
  // Your custom validation logic
  this.results.push({
    pass: true/false,
    message: '✅/❌ Your check',
    file: 'optional/file/path.ts',
    line: 42,
  });
}
```

## Troubleshooting

**"Module not found" error:**
```bash
npm install -D tsx
```

**Permission denied:**
```bash
chmod +x .cursor/skills/ai-finops-governance/scripts/validate.sh
```

**False positives:**
Add exclusions in the validator script for specific files or patterns.
