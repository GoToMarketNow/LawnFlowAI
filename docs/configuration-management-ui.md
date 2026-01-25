# Configuration Management UI Specification

## Objective
To provide Product Managers and developers with a clear specification for a user interface that allows the creation, reading, updating, and deletion (CRUD) of agent-specific business configurations, centralizing control over agent behavior without requiring code deployments.

## Core Principles
*   **Intuitive:** Easy to understand and navigate, even for non-technical users.
*   **Secure:** Role-based access control (RBAC) to prevent unauthorized changes.
*   **Auditable:** All changes to configurations are logged.
*   **Extensible:** Easily accommodate new agents and their configurations.

## User Flows

### 1. View Agent Configurations (List)
*   **Goal:** See all configured agents and their high-level status.
*   **Components:**
    *   **Table/List:** Displays `Agent Key`, `Display Name` (if available), `Description`, `Status (Active/Inactive)`, `Last Updated`.
    *   **Search/Filter:** By `Agent Key`, `Status`, `Category`.
    *   **"Create New Configuration" Button:** Navigates to the Create/Edit form.
    *   **"View Details" / "Edit" Action:** For each agent in the list, navigate to the Agent Configuration Detail view.

### 2. Agent Configuration Detail / Edit
*   **Goal:** View and modify the detailed configuration settings for a specific agent.
*   **Components:**
    *   **Agent Key & Description:** Displayed prominently.
    *   **"Edit" / "Save" / "Cancel" Buttons:** Standard form actions.
    *   **Configuration Form (Dynamic):**
        *   The form fields are dynamically generated based on the agent's schema (e.g., `BillingConfig` for the Billing Agent).
        *   Input types (text, number, checkbox, dropdown) match the schema definition.
        *   Includes fields for `isActive`.
    *   **Version History/Audit Log:** (Future enhancement) Shows who changed what and when.

### 3. Create New Agent Configuration
*   **Goal:** Define a new set of business rules for an agent.
*   **Components:**
    *   **Agent Key Selection:** Dropdown or search to select an existing agent type (pre-registered agents).
    *   **Dynamic Form:** As in the Edit view, generated based on the selected agent's schema.
    *   **"Save" / "Cancel" Buttons.**

## Example UI - Billing Agent Configuration

### Agent List View
| Agent Key       | Display Name          | Description               | Status  | Last Updated       | Actions        |
| :-------------- | :-------------------- | :------------------------ | :------ | :----------------- | :------------- |
| `billing_agent` | Billing Orchestrator  | Manages invoice follow-ups | Active  | 2026-01-07 10:30   | View / Edit    |
| `quoting_agent` | Quote Generator       | Generates price estimates | Active  | 2026-01-06 14:00   | View / Edit    |
| `policy_agent`  | Policy Enforcement    | Enforces business rules   | Active  | 2026-01-05 09:00   | View / Edit    |

### Billing Agent Configuration - Detail/Edit View

**Agent Key:** `billing_agent`
**Description:** Manages automated invoice follow-ups and payment reminders.

---

**General Settings**
*   **Business Name:** `[Text Input] GreenFlow Lawn Care`
*   **Payment Link Base URL:** `[Text Input] https://pay.greenflow.com/configured`
*   **Include Late Fee Language:** `[Checkbox] ✅`
*   **Tone:** `[Dropdown] Friendly / Professional / **Firm**`

**Escalation Cadence (Days)**
*   `[Number Input] 5`
*   `[Number Input] 10`
*   `[Number Input] 15`
*   `[Number Input] 20`
*   `[Add New Step] Button`

---

**Status**
*   **Is Active:** `[Toggle Switch] ✅`

---

`[Save Changes] Button` `[Cancel] Button`

## CLI Example (Simulated UI Interaction)

While a full graphical UI is ideal, a basic CLI can simulate interaction for development and testing.

### View all agent configurations
```bash
$ agent-cli config list --business-id 1
```
Output:
```
ID | Agent Key       | Status | Last Updated
---|-----------------|--------|-------------
1  | billing_agent   | Active | 2026-01-07
2  | quoting_agent   | Active | 2026-01-06
...
```

### View detailed configuration for a specific agent
```bash
$ agent-cli config get --business-id 1 --agent-key billing_agent
```
Output:
```json
{
  "agentKey": "billing_agent",
  "businessId": 1,
  "isActive": true,
  "configJson": {
    "business_name": "GreenFlow Lawn Care (Configured)",
    "payment_link_base_url": "https://pay.greenflow.com/configured",
    "include_late_fee_language": true,
    "escalation_cadence_days": [5, 10, 15, 20],
    "tone": "firm"
  }
}
```

### Update a specific configuration value
```bash
$ agent-cli config update --business-id 1 --agent-key billing_agent --set 'configJson.tone="friendly"'
```
Output:
```json
{
  "agentKey": "billing_agent",
  "businessId": 1,
  "isActive": true,
  "configJson": {
    "business_name": "GreenFlow Lawn Care (Configured)",
    "payment_link_base_url": "https://pay.greenflow.com/configured",
    "include_late_fee_language": true,
    "escalation_cadence_days": [5, 10, 15, 20],
    "tone": "friendly"
  }
}
```

### Create a new agent configuration
```bash
$ agent-cli config create --business-id 1 --agent-key new_agent --config '{"some_setting": "value"}' --active true
```
Output:
```json
{
  "id": 101,
  "agentKey": "new_agent",
  "businessId": 1,
  "isActive": true,
  "configJson": {
    "some_setting": "value"
  }
}
```
