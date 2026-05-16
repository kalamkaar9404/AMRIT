# AMRIT AI Framework — SDLC Phase Coverage

End-to-end map of AI assistance touchpoints across AMRIT's development lifecycle.

---

## Phase 1: Requirements & Analysis

**Goal:** Convert business needs into structured, actionable specifications.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Convert BRD to JIRA stories | `generate-jira-ticket` + Confluence MCP | "Convert this BRD section into JIRA stories" |
| Analyse feature feasibility | Code Context MCP + Docs MCP | "What AMRIT APIs would be needed to support offline ASHA registration?" |
| Check for duplicate features | JIRA MCP | "Is there an existing ticket for beneficiary phone search?" |
| Identify affected repos | `explain_repo_relationships` | "Which repos does adding offline sync to 104 helpline affect?" |

### Workflow Example
1. PM pastes a Confluence BRD excerpt into Claude Code
2. Agent searches Confluence for related existing docs
3. Agent identifies affected AMRIT modules via `explain_repo_relationships`
4. Agent generates structured JIRA stories with acceptance criteria
5. PM reviews and calls `create_jira_ticket` to create in JIRA

---

## Phase 2: Sprint Planning

**Goal:** Estimate and prioritise backlog items for upcoming sprints.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Story point estimation | Code Context MCP + Standards | "How complex is implementing village-based ASHA routing? Estimate story points." |
| Backlog grooming | JIRA MCP | "List all unestimated stories in AMRIT project" |
| Dependency detection | Docs + Code Context | "Does AMRIT-123 depend on any other open tickets?" |
| Sprint velocity check | JIRA MCP | "What's our average velocity based on last 3 sprints?" |

---

## Phase 3: Development

**Goal:** Write code that follows AMRIT's conventions without manual lookups.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Implementation planning | `implementation-plan` | "Give me an implementation plan for AMRIT-123" |
| Code generation | CLAUDE.md context | "Write a Spring Boot service method to fetch beneficiary by Aadhar" |
| Pattern discovery | Code Context MCP | "Show me how BeneficiaryService handles soft-delete" |
| API endpoint discovery | `find_api_endpoints` | "What endpoints does HWC-API expose for beneficiary operations?" |
| Cross-repo understanding | Code Context MCP | "Which HWC-API endpoint does the Angular beneficiary search component call?" |

### Example: New Feature Development

```
Developer: "I need to add offline beneficiary lookup to the Android app"

Agent actions:
1. search_amrit_docs("offline beneficiary lookup") → finds architecture docs
2. get_amrit_file("AMRIT-Mobile", "data/repository/BeneficiaryRepository.kt")
3. find_api_endpoints("HWC-API") → finds GET /api/v1/beneficiary/search
4. Generates:
   - BeneficiaryEntity fields to cache locally
   - BeneficiaryDao.findByName() and findByPhone() queries
   - Repository offline/online path
   - ViewModel StateFlow update
   - Fragment observer update
```

---

## Phase 4: Code Review

**Goal:** Catch issues before merge; enforce AMRIT standards consistently.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Standards review | `pr-reviewer` | "Review this PR against AMRIT coding standards" |
| Security scan | `pr-reviewer` (security checklist) | "Check this PR for PII in logs and auth bypass" |
| Architecture review | Code Context + Standards | "Is this controller method following AMRIT's layering pattern?" |
| Cross-repo impact | Code Context MCP | "Does this API change break any frontend components?" |

### Automated Review Checklist
The `pr-reviewer` skill covers:
- ✅ Layer separation (no logic in controllers)
- ✅ Error handling (AMRITException, try-catch)
- ✅ Soft-delete filter
- ✅ No PII in logs
- ✅ Auth header on endpoints
- ✅ Reactive Forms, no hardcoded URLs (Angular)
- ✅ StateFlow, ViewBinding null, offline-first (Android)

---

## Phase 5: QA & Testing

**Goal:** Achieve comprehensive test coverage aligned with acceptance criteria.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Unit test generation | `test-case-generator` | "Write JUnit tests for BeneficiaryServiceImpl.registerBeneficiary" |
| QA test cases | `test-case-generator` (qa-manual) | "Generate manual test cases for the ASHA transfer feature" |
| Defect analysis | Docs + Code Context | "Why might beneficiary search return stale data?" |
| Regression scope | Code Context | "What features could be affected by changing BeneficiaryRepo?" |

---

## Phase 6: DevOps & Deployment

**Goal:** Release reliably with minimal manual steps and fast rollback.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Pre-deploy validation | `deployment-validator` | "Is this branch ready to deploy to production?" |
| DB migration review | `deployment-validator` | "Review this Flyway migration script for safety" |
| Release notes | `release-notes-generator` | "Generate release notes for Sprint 42" |
| Rollback procedure | `deployment-validator` | "What's the rollback procedure for HWC-API 2.4.0?" |

---

## Phase 7: L2 Support

**Goal:** Triage escalated bugs quickly and find root causes in a complex multi-repo system.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Bug triage | `bug-triage` | "NullPointerException in BeneficiaryServiceImpl — triage this" |
| Root cause analysis | Code Context + Docs | "Search for where village lookup can throw NPE" |
| Duplicate detection | JIRA MCP | "Has this 104 call routing bug been reported before?" |
| Workaround discovery | Docs MCP | "Is there a known workaround for Aadhar validation failures?" |

---

## Phase 8: Security & Compliance

**Goal:** Ensure AMRIT meets health data regulatory requirements.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| PII scan | `pr-reviewer` (security) | "Find all places where PII might be logged in this PR" |
| Aadhar handling | Code Context | "How does AMRIT encrypt Aadhar — show me existing patterns" |
| Auth bypass check | `pr-reviewer` | "Are there any endpoints without the Authorization header?" |
| Compliance notes | Docs MCP | "What does the AMRIT data privacy policy say about patient data retention?" |

---

## Phase 9: Documentation

**Goal:** Keep knowledge base current for contributors and operators.

### AI Touchpoints

| Touchpoint | Skill / Tool | Example Prompt |
|---|---|---|
| Release notes | `release-notes-generator` | "Generate Sprint 42 release notes from closed JIRA tickets" |
| API docs | Code Context + `create_confluence_page` | "Document the new beneficiary search API and publish to Confluence" |
| Onboarding guide | Docs MCP | "What should a new HWC-UI developer read first?" |
| Architecture updates | Code Context + Confluence | "Update the architecture doc to reflect the new caching layer" |

---

## SDLC Coverage Summary

| Phase | Status | Skills | MCP Servers |
|---|---|---|---|
| Requirements | ✅ | generate-jira-ticket | Confluence, JIRA |
| Sprint Planning | ✅ | (built-in JIRA tools) | JIRA |
| Development | ✅ | implementation-plan | Docs, Code Context |
| Code Review | ✅ | pr-reviewer | Docs, Code Context |
| Testing | ✅ | test-case-generator | Docs, Code Context |
| DevOps | ✅ | deployment-validator | Docs |
| L2 Support | ✅ | bug-triage | Docs, Code Context, JIRA |
| Security | ✅ | pr-reviewer (security) | Docs, Code Context |
| Documentation | ✅ | release-notes-generator | Confluence, JIRA |

All phases covered at initial release. Contributors can extend any phase with
new skills and MCP servers — see [CONTRIBUTING.md](../CONTRIBUTING.md).
