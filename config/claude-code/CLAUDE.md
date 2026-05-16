# AMRIT Project — Claude Code Context

This file gives Claude Code deep contextual knowledge of the AMRIT (Accessible
Medical Records via Integrated Technology) open-source EHR platform.

Copy this file to any AMRIT repository root to activate AMRIT-aware assistance.

---

## What Is AMRIT?

AMRIT is an open-source Electronic Health Record (EHR) platform maintained by
Piramal Swasthya Management and Research Institute (PSMRI). It serves India's
public health system — primary health centres, helplines, telemedicine, and ASHA
community health workers.

**GitHub org:** https://github.com/PSMRI
**Key repositories:** HWC-API, HWC-UI, Helpline104-API, Helpline104-UI, TM-API,
TM-UI, MMU-API, MMU-UI, AMRIT-Mobile, AMRIT (core)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     AMRIT Platform                       │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │  HWC-UI  │  │ 104-UI  │  │   TM-UI  │  │  MMU-UI  │  │
│  │(Angular) │  │(Angular)│  │(Angular) │  │(Angular) │  │
│  └────┬─────┘  └────┬────┘  └─────┬────┘  └────┬─────┘  │
│       │              │             │              │        │
│  ┌────▼─────┐  ┌─────▼───┐  ┌─────▼────┐  ┌────▼─────┐  │
│  │  HWC-API  │  │ 104-API │  │  TM-API  │  │  MMU-API │  │
│  │(Spr Boot) │  │(Spr Bt) │  │(Spr Bt)  │  │(Spr Bt)  │  │
│  └─────┬─────┘  └────┬────┘  └─────┬────┘  └────┬─────┘  │
│        └─────────────┴─────────────┴─────────────┘        │
│                              │                             │
│                       ┌──────▼──────┐                      │
│                       │ AMRIT Core  │ (shared auth, models)│
│                       └──────┬──────┘                      │
│                              │                             │
│                       ┌──────▼──────┐                      │
│                       │  MySQL DB   │                      │
│                       └─────────────┘                      │
│                                                          │
│  ┌──────────────────────────────────┐                    │
│  │   AMRIT-Mobile (Kotlin/Android)  │ ASHA companion app │
│  │   → calls HWC-API + MMU-API      │ offline-first      │
│  └──────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack by Layer

| Layer | Technology |
|---|---|
| Backend | Java 11, Spring Boot 2.x/3.x, Spring Data JPA, Hibernate |
| Database | MySQL 8 |
| Frontend | Angular 4–19, Angular Material, RxJS |
| Mobile | Kotlin, MVVM, Room, Retrofit, WorkManager, Hilt |
| Auth | JWT (custom implementation via interceptors) |
| Build | Maven (backend), Angular CLI (frontend), Gradle (Android) |
| Docs | Confluence (internal) + GitHub wikis |

---

## Backend Conventions (Spring Boot)

### Package layout
```
com.iemr.<service>/
├── controller/     # Thin REST controllers
├── service/        # Business logic interfaces + ServiceImpl classes
├── repo/           # Spring Data JPA repositories
├── model/
│   ├── db/         # JPA entities (t_ prefix = transactional, m_ = master)
│   └── response/   # API response DTOs
└── utils/
```

### Key patterns
- Controllers delegate entirely to services — no business logic in controllers
- Service methods wrapped in try-catch, throw `AMRITException` on failure
- Entities have soft-delete: `deleted` boolean, always filter `deleted = false`
- Every entity has: `createdBy`, `createdDate`, `modifiedBy`, `lastModDate`
- Serialization via `InputMapper.gson()` / `new Gson()`
- Logger: `LoggerFactory.getLogger(this.getClass().getName())` — never static
- No PII in logs (no names, phone numbers, Aadhar)

### API conventions
- Base path: `/api/v1/<module>/`
- All endpoints require `Authorization` header (JWT)
- Response wrapper: `OutputResponse` with `.setResponse()` or `.setError()`
- Error format: `{"statusCode": 5000, "errorMessage": "...", "status": "failure"}`

---

## Frontend Conventions (Angular)

- New code: standalone components (Angular 17+)
- Legacy code: NgModule-based
- Reactive Forms only (no template-driven forms)
- Services: `providedIn: 'root'`, use RxJS pipes, no logic in templates
- HTTP: all calls via `HttpClient`; auth header added by `AuthInterceptor`
- JWT stored in `sessionStorage` under key `'key'`
- Base URLs from `environment.ts` — never hardcoded
- Unsubscribe via `takeUntil(destroy$)` pattern
- Angular Material for all UI components

---

## Mobile Conventions (Kotlin/Android — AMRIT-Mobile)

- MVVM architecture with Hilt DI
- `StateFlow` for UI state (sealed class: Idle/Loading/Success/Error)
- Room for local persistence (offline-first)
- `isSynced` boolean on every entity — WorkManager syncs unsynced records
- Retrofit for network; repository abstracts online/offline path
- ViewBinding; null binding in `onDestroyView()`
- Collect StateFlow in `viewLifecycleOwner.lifecycleScope`

---

## Domain Concepts

| Term | Meaning |
|---|---|
| Beneficiary | A patient/citizen registered in AMRIT |
| BeneficiaryRegID | Unique AMRIT patient identifier |
| HWC | Health and Wellness Centre (primary health facility) |
| MMU | Mobile Medical Unit (travelling clinic) |
| 104 | Government helpline — medical advice + ASHA coordination |
| TM | Telemedicine — remote doctor consultation |
| ASHA | Accredited Social Health Activist — community health worker |
| ANM | Auxiliary Nurse Midwife |
| Role | Clinical roles: Nurse, Doctor, Pharmacist, Lab Technician, Registrar |

---

## MCP Servers Available

When this CLAUDE.md is paired with the AMRIT AI Framework MCP servers:

- **amrit-docs**: Search AMRIT documentation → `search_amrit_docs`
- **amrit-jira**: JIRA tickets and sprint data → `search_jira_issues`, `create_jira_ticket`
- **amrit-confluence**: BRDs and concept notes → `search_confluence`
- **amrit-code-context**: Cross-repo code search → `search_amrit_code`, `find_api_endpoints`

---

## Skills Available

Use `/generate-jira-ticket` — draft a JIRA ticket from a description
Use `/implementation-plan` — get a step-by-step plan for any feature
Use `/pr-review` — review code against AMRIT standards
Use `/test-cases` — generate unit or QA test cases
Use `/bug-triage` — analyse and triage a production bug
Use `/deployment-checklist` — validate deployment readiness

---

## Common Tasks

**"How does X work?"** → Call `search_amrit_docs` or `search_amrit_code`

**"Write a service method for..."** → Follow Spring Boot conventions above;
use `com.iemr.<service>.service` package; wrap in try-catch; throw `AMRITException`

**"Add an API endpoint"** → Controller in `/controller/`, service interface +
impl, return `OutputResponse`; ensure `Authorization` header declared

**"Write a test"** → JUnit 5 + `@ExtendWith(MockitoExtension.class)`,
mock repos, test happy path + error + soft-delete edge case

**"Fix a bug"** → Call `search_amrit_code` for the exception class/method,
read the file, check for null-checks, soft-delete filters, `AMRITException` handling

---

## What NOT to do

- Do not add logic to controllers (delegate to service)
- Do not use `System.out.println` (use SLF4J logger)
- Do not hardcode URLs, passwords, or environment values
- Do not log PII (patient name, phone, Aadhar number)
- Do not use Lombok (AMRIT uses explicit getters/setters)
- Do not use `GlobalScope` in Kotlin (use `viewModelScope`)
- Do not use `LiveData` in new Android code (use `StateFlow`)
