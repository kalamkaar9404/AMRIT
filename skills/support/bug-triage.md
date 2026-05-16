---
name: amrit-bug-triage
description: >
  Triage an escalated L2 bug report for AMRIT. Identifies the affected module,
  searches the codebase and knowledge base for root cause, and produces a
  structured triage report with recommended fix path.
triggers:
  - "triage this bug"
  - "root cause"
  - "why is this failing"
  - "L2 support"
  - "production issue"
  - "error in AMRIT"
---

# Skill: AMRIT L2 Bug Triage

## Purpose
Analyse a bug report or production error, locate the relevant code, and
produce a root-cause hypothesis + recommended fix path — reducing the time
L2 engineers spend on each escalation.

## Inputs
- Bug description or error message / stack trace
- Affected module or user flow (if known)
- JIRA ticket key (optional)
- Environment (production / staging / UAT)

## Triage Process

### Step 1: Parse the error signal

Extract from the report:
- **Error type**: exception class, HTTP status, or user-visible symptom
- **Affected entity**: beneficiary ID, call ID, user role
- **Timestamp and environment**
- **Stack trace** (if available) — identify the topmost AMRIT class

### Step 2: Identify the module

| Symptom keywords | Likely module | Repos to search |
|---|---|---|
| "beneficiary", "registration", "OPD" | HWC | HWC-API, HWC-UI |
| "call", "helpline", "104", "ASHA transfer" | 104 Helpline | Helpline104-API, Helpline104-UI |
| "teleconsultation", "doctor", "video" | Telemedicine | TM-API, TM-UI |
| "MMU", "mobile unit", "camp" | MMU | MMU-API, MMU-UI |
| "sync failed", "offline", "Android" | Mobile | AMRIT-Mobile |
| "login", "token", "JWT", "401" | Auth (cross-cutting) | AMRIT core |
| "report", "dashboard", "data" | Reporting | AMRIT core / specific API |

### Step 3: Search for the root cause

Using available MCP tools:

```
1. search_amrit_code("<exception class or method name from stack trace>")
   → Find the exact file and line throwing the error

2. search_amrit_docs("<feature name> <error keyword>")
   → Check if known issue or workaround documented

3. get_amrit_file("<repo>", "<file path from stack trace>")
   → Read the actual code to understand the error path

4. search_jira_issues("type=Bug AND text~'<error keyword>' AND status != Done")
   → Check if this is a known/duplicate bug
```

### Step 4: Produce triage report

```markdown
## L2 Triage Report

**Ticket:** [JIRA key or "Ad-hoc"]
**Reported:** [date]
**Severity:** [Critical / High / Medium / Low]
**Environment:** [Production / Staging / UAT]

---

### Symptom
[Exact error message or user-observed behaviour]

### Affected Module
**Repo:** [e.g. HWC-API]
**Layer:** [Controller / Service / Repository / Frontend / Mobile]
**Feature:** [e.g. Beneficiary registration]

### Root Cause Hypothesis
[Explain what you found in the code. Be specific:]
> The error originates in `BeneficiaryServiceImpl.registerBeneficiary()` at line ~120.
> The `NullPointerException` is thrown because `beneficiary.getVillageID()` returns null
> when the registration request omits the village field, and there is no null-check
> before calling `villageRepo.findById(villageID)`.

**Evidence:**
- File: `src/main/java/com/iemr/hwc/service/beneficiary/BeneficiaryServiceImpl.java`
- Code path: `registerBeneficiary → saveDetails → getVillageData`
- [Link to code if MCP returned one]

### Is This a Known Issue?
[Result of JIRA duplicate search — link similar tickets if found]

### Immediate Workaround (if any)
[Actionable step ops team can take right now to unblock users, e.g. "Set village field
to default value X in the DB for affected records"]

### Recommended Fix
**Type:** [Code fix / Configuration / Data patch / Null-check]
**File(s) to change:**
- `BeneficiaryServiceImpl.java` — add null-check before `villageRepo.findById()`
- `BeneficiaryController.java` — validate village field as required in request
- `BeneficiaryModel.java` — optionally add `@NotNull` constraint

**Estimated effort:** [S / M / L]

**Test to add:**
```java
@Test
void registerBeneficiary_nullVillageId_throwsValidationError() { ... }
```

### Escalation / Next Steps
- [ ] Assign fix to: [team / person]
- [ ] Target release: [sprint / version]
- [ ] Notify: [if user-impacting, list stakeholders]
- [ ] Post-fix: verify in UAT before production deploy
```

## Common AMRIT Bug Patterns

### "NullPointerException in ServiceImpl"
- Missing null-check on optional fields before DB lookup
- Entity not found but not wrapped in `Optional`
- Fix: defensive null-check + meaningful error response

### "401 Unauthorized on valid session"
- JWT token expired (default 24h)
- Token not refreshed on interceptor
- Fix: check token expiry logic in auth interceptor

### "Data not showing in frontend"
- API returns data but Angular component not mapping response correctly
- Common when backend added a new field but frontend model not updated
- Fix: update TypeScript interface and component binding

### "Sync failed on Android"
- WorkManager retry exhausted (network unstable during sync window)
- Fix: increase retry count or check `isSynced = false` records accumulating

### "Report shows incorrect numbers"
- Date range filter off-by-one (timezone issue between server and DB)
- Fix: ensure all timestamps stored in UTC, queries use UTC range

### "Cannot register duplicate phone"
- Unique constraint on phone column is too strict for AMRIT use case
  (same phone used by multiple family members)
- Fix: per BRD, phone is not a unique key — remove constraint if present
