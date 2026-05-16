---
name: amrit-implementation-plan
description: >
  Produce a step-by-step implementation plan for an AMRIT JIRA ticket or
  feature description. Plan covers backend (Spring Boot), frontend (Angular),
  and/or mobile (Kotlin/Android) layers with specific class/file names from
  the AMRIT codebase.
triggers:
  - "implementation plan"
  - "how do I implement"
  - "plan for this ticket"
  - "what files do I need to change"
  - "where do I start"
---

# Skill: Generate Implementation Plan

## Purpose
Given a JIRA ticket key or feature description, produce a concrete, ordered
implementation checklist that follows AMRIT's architecture patterns and points
to specific repos, packages, and files.

## When to Use
- Developer picks up a ticket and needs to know where to start
- New contributor unfamiliar with AMRIT architecture needs guidance
- Complex feature spans multiple repos and layers

## Steps

### 1. Understand the requirement
- If given a JIRA key, call `get_jira_issue` to fetch full details.
- If given a description, extract: what data is stored/retrieved, which user
  role initiates the action, which AMRIT module it belongs to.

### 2. Identify affected repos and layers

Map the feature to repos:

| Module | Backend repo | Frontend repo | Mobile |
|---|---|---|---|
| Health & Wellness Centre | HWC-API | HWC-UI | AMRIT-Mobile (partial) |
| 104 Helpline | Helpline104-API | Helpline104-UI | — |
| Telemedicine | TM-API | TM-UI | — |
| Mobile Medical Unit | MMU-API | MMU-UI | — |
| ASHA companion | HWC-API / MMU-API | — | AMRIT-Mobile |

Use `search_amrit_code` or `find_api_endpoints` to locate existing related
classes if unsure.

### 3. Produce the plan

Format the plan as ordered steps per layer:

```markdown
## Implementation Plan: [Ticket summary or feature name]

### Overview
[2–3 sentences: what changes, which repos, estimated complexity]

---

### Phase 1: Database / Model

- [ ] **`t_<table_name>`** — add column `<col_name>` (`<type>`, nullable)
      _Migration script: `src/main/resources/db/migration/V<n>__add_<col>.sql`_
- [ ] Add field to entity `<EntityClass>` in `<repo>/src/main/java/.../model/db/`
- [ ] Update `@Column` mapping

### Phase 2: Backend — `<REPO_NAME>`

- [ ] **Repository** — add query method to `<Entity>Repo.java`:
      ```java
      Optional<Entity> findBy<Field>(Type value);
      ```
- [ ] **Service interface** — add method signature to `<Feature>Service.java`
- [ ] **Service impl** — implement in `<Feature>ServiceImpl.java`:
      - Validate input
      - Call repo
      - Return JSON via `OutputResponse`
- [ ] **Controller** — add endpoint to `<Feature>Controller.java`:
      ```
      POST /api/v1/<module>/<action>
      ```
- [ ] **Unit tests** — `<Feature>ServiceImplTest.java`

### Phase 3: Frontend — `<REPO_NAME>`

- [ ] **Service** — add API call to `<feature>.service.ts`:
      ```typescript
      actionName(data: RequestType): Observable<any> {
        return this.http.post(`${this.API_URL}/api/v1/<module>/<action>`, data);
      }
      ```
- [ ] **Component** — update `<feature>.component.ts` to call the service
- [ ] **Template** — update `<feature>.component.html` with new form fields / table columns
- [ ] **Model** — add/update interface in `shared/models/<feature>.model.ts`

### Phase 4: Mobile — `AMRIT-Mobile` (if applicable)

- [ ] **DTO** — add `<Request/Response>Dto` in `data/remote/dto/`
- [ ] **API service** — add endpoint to `AmritApiService.kt`
- [ ] **Repository** — implement in `<Feature>RepositoryImpl.kt`
      - Online path: call API
      - Offline path: save to Room DB with `isSynced = false`
- [ ] **Room entity** — add fields to `<Feature>Entity.kt` if needed
- [ ] **UseCase** — create `<Action>UseCase.kt`
- [ ] **ViewModel** — update `<Feature>ViewModel.kt` with new StateFlow
- [ ] **Fragment** — update UI and observe new state

### Phase 5: Integration & Testing

- [ ] Run backend locally and test endpoint with Postman / curl
- [ ] Connect frontend and test full flow in browser
- [ ] Run existing JUnit tests — fix any failures
- [ ] Write new unit tests for the service method
- [ ] For mobile: test offline → sync flow manually

### Phase 6: PR & Review

- [ ] Branch name: `feature/AMRIT-<ticket>-<short-description>`
- [ ] PR title: `[AMRIT-<n>] <what changed>`
- [ ] Reference ticket in PR description
- [ ] Tag relevant reviewer based on area (backend/frontend/mobile)
```

### 4. Annotate with code pointers
Where possible, use `search_amrit_code` to find the exact existing file paths
and include them inline in the plan. For example:
> _Existing file: `src/main/java/com/iemr/hwc/service/benHistory/BenChiefComplaintServiceImpl.java`_

## Quality Checklist
- [ ] Every step is actionable (has a specific file/class to create or modify)
- [ ] Follows AMRIT's package/naming conventions from coding-standards/
- [ ] Offline behaviour addressed for any mobile-facing feature
- [ ] Tests included in the plan, not as an afterthought
