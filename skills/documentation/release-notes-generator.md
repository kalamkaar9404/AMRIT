---
name: amrit-release-notes
description: >
  Generate release notes for an AMRIT sprint or version from closed JIRA
  tickets and git commits. Produces developer-facing and end-user-facing
  versions.
triggers:
  - "release notes"
  - "what changed in this sprint"
  - "generate changelog"
  - "sprint summary"
---

# Skill: AMRIT Release Notes Generator

## Purpose
Produce clear, structured release notes from JIRA sprint data and/or git
history, in both technical (developer) and non-technical (end-user) formats.

## Steps

### 1. Gather sprint data
Call `search_jira_issues` with:
```
project = AMRIT AND sprint = "<sprint name>" AND status = Done ORDER BY issuetype ASC
```

Group issues by type: Stories (features), Bugs (fixes), Tasks (chores).

### 2. Generate release notes

```markdown
# AMRIT Release Notes — v<version> / Sprint <n>
**Release Date:** <date>
**Released by:** <name>

---

## What's New (for operators and clinical staff)

### Health & Wellness Centre (HWC)
- **[User-facing summary of Story]** — [one sentence what the user can now do]
  _Ticket: AMRIT-n_

### 104 Helpline
- ...

### Mobile App (ASHA companion)
- ...

---

## Bug Fixes
- **[Module]:** Fixed — [what was broken, what it does now] _(AMRIT-n)_

---

## Technical Changes (for developers)

### API Changes
| Method | Endpoint | Change | Backward Compatible? |
|---|---|---|---|
| POST | /api/v1/beneficiary/register | Added `villageID` field | Yes (optional) |

### Database Migrations
| Script | Description |
|---|---|
| V42__add_village_cache.sql | New `m_village_cache` table |

### Configuration
| Variable | Default | Description |
|---|---|---|
| FEATURE_VILLAGE_CACHE | false | Enable village data caching |

### Dependencies Updated
| Package | From | To |
|---|---|---|
| spring-boot | 3.1.0 | 3.2.1 |

---

## Services Updated
| Service | Version |
|---|---|
| HWC-API | 2.4.0 |
| HWC-UI | 1.8.1 |

## Known Issues
- [Describe any open P1/P2 bugs not fixed in this release]

## Deployment Order
1. DB migrations (HWC-API)
2. HWC-API
3. HWC-UI
4. AMRIT-Mobile (if APK updated) — staged rollout
```

### 3. Adapt for audience

**End-user version** (for Confluence / communication to clinical staff):
- Remove all technical details (API changes, DB, config)
- Use simple language: "You can now search beneficiaries by phone number"
- Bullet points only
- Include screenshots if available

**Developer changelog** (CHANGELOG.md in repo):
```
## [2.4.0] - 2026-05-16

### Added
- Beneficiary search by phone number (AMRIT-123)
- Village cache for faster lookup (AMRIT-124)

### Fixed
- NullPointerException in BeneficiaryServiceImpl when village not set (AMRIT-130)

### Changed
- Upgraded Spring Boot to 3.2.1
```

## Quality Checklist
- [ ] Every closed Story results in at least one user-facing bullet
- [ ] Every closed Bug results in a "Fixed" line
- [ ] API changes table is complete and backward-compatibility noted
- [ ] Deployment order respects service dependencies
- [ ] End-user version has no jargon
