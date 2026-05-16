---
name: amrit-generate-jira-ticket
description: >
  Generate a structured JIRA ticket for an AMRIT feature or bug from a raw
  description, BRD excerpt, or Confluence page. Produces summary, user story,
  acceptance criteria, technical notes, labels, and story point estimate.
triggers:
  - "generate jira ticket"
  - "create ticket"
  - "write a story for"
  - "draft a jira"
  - "ticket for this feature"
---

# Skill: Generate JIRA Ticket from Description

## Purpose
Convert a raw feature description, BRD excerpt, or Confluence note into a
fully-structured JIRA ticket ready for sprint planning, following AMRIT's
project conventions.

## When to Use
- Analyst or PM has a Confluence BRD they want converted to JIRA stories
- Developer wants to create a ticket for a feature they're about to build
- Bug report comes in that needs to be formalised into a JIRA bug ticket

## Steps

### 1. Gather context
Ask for (or accept inline):
- The raw description / BRD excerpt
- Target JIRA project key (e.g. `AMRIT`, `MOB`)
- Issue type: `Story`, `Bug`, `Task`, or `Epic`
- Any known technical constraints

If the JIRA MCP server is available, you may also call `list_jira_projects` to
confirm valid project keys.

### 2. Identify affected AMRIT modules
Based on the description, determine which repos are involved:
- Clinical workflows (nurse/doctor/pharmacist) → **HWC-API + HWC-UI**
- 104 helpline → **Helpline104-API + Helpline104-UI**
- Telemedicine → **TM-API + TM-UI**
- Mobile ASHA app → **AMRIT-Mobile**
- Cross-cutting (auth, reports) → **AMRIT core**

### 3. Generate the ticket

Produce output in this exact format:

```
## JIRA Ticket Draft

**Project:** [KEY]
**Type:** [Story / Bug / Task / Epic]
**Priority:** [Highest / High / Medium / Low]
**Labels:** [comma-separated — pick from: backend, frontend, android, api,
             beneficiary, hwc, mmu, helpline-104, telemedicine, offline-sync,
             security, performance, reporting]
**Story Points:** [1 / 2 / 3 / 5 / 8 / 13]

---

### Summary
[One-line summary, ≤100 chars, starts with a verb: "Add", "Fix", "Update", "Enable"]

### User Story
As a **[role]** (nurse / ASHA worker / call centre agent / system admin),
I want to **[action]**,
So that **[benefit for patient or operator]**.

### Background
[2–3 sentences of context from the BRD / description]

### Acceptance Criteria
- [ ] Given [precondition], when [trigger], then [observable outcome]
- [ ] Given [precondition], when [trigger], then [observable outcome]
- [ ] Error case: when [invalid input/failure], then [error is shown/logged]
- [ ] The feature works offline and syncs when connectivity is restored
      (only if Android/mobile involved)

### Technical Notes
**Backend:**
- Service: `[e.g. BeneficiaryService in HWC-API]`
- API endpoint to add/modify: `[METHOD /api/v1/path]`
- DB changes: `[table name and columns, or "none"]`
- Integration: `[downstream services called, or "none"]`

**Frontend:**
- Module/component: `[e.g. BeneficiaryRegistrationComponent in HWC-UI]`
- API call: `[service method and endpoint]`

**Mobile (if applicable):**
- Screen/ViewModel: `[name]`
- Offline behaviour: `[how it behaves without network]`

### Out of Scope
- [List anything explicitly NOT included in this ticket]

### Dependencies
- [List blocking tickets, external APIs, or teams]
```

### 4. Offer to create the ticket
If the JIRA MCP server is connected, ask:
> "Shall I create this ticket in JIRA? I'll call `create_jira_ticket` with
> the details above."

On confirmation, call `create_jira_ticket` and return the created ticket URL.

## Quality Checklist
Before presenting the draft, verify:
- [ ] Summary is ≤100 chars and starts with a verb
- [ ] At least 3 acceptance criteria, including one error/edge case
- [ ] Technical notes name the specific AMRIT service/component, not generic terms
- [ ] Story points assigned (don't leave blank)
- [ ] Labels are from the approved list

## Example

**Input:**
> The 104 helpline needs to be able to transfer a call to the right ASHA worker
> based on the caller's village. Currently operators manually look up the ASHA.

**Output summary line:**
> "Add automatic ASHA assignment based on caller village in 104 helpline"

**Labels:** `backend, helpline-104, beneficiary`
**Story points:** `5`
