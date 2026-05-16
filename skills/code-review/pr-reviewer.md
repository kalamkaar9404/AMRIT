---
name: amrit-pr-reviewer
description: >
  Review a GitHub pull request against AMRIT's coding standards for
  Spring Boot (Java), Angular (TypeScript), or Kotlin/Android. Flags
  issues and produces a structured review comment ready to post on GitHub.
triggers:
  - "review this PR"
  - "review this pull request"
  - "check this code"
  - "review against AMRIT standards"
  - "/review"
---

# Skill: AMRIT PR Code Reviewer

## Purpose
Review code changes in any AMRIT repository against the project's documented
conventions. Produce actionable, prioritised feedback.

## Inputs
- PR number or diff/patch text
- Repository name (to apply the right standards)
- Optional: specific areas of concern from the author

## Review Checklist by Layer

### All PRs
- [ ] **Branch name** follows `feature/AMRIT-<n>-<desc>` or `fix/AMRIT-<n>-<desc>`
- [ ] **PR description** references the JIRA ticket (`AMRIT-<n>`)
- [ ] **No secrets or PII** in code, comments, or test fixtures
- [ ] **No hardcoded URLs** — must use `environment.ts` / `BuildConfig` / `application.properties`
- [ ] Existing tests still pass (check CI status)
- [ ] New logic has at least one test covering the happy path

---

### Java / Spring Boot Review (HWC-API, Helpline104-API, TM-API, MMU-API)

**Architecture**
- [ ] Controller is thin — no business logic (only validation + delegation to service)
- [ ] Service interface defined; implementation in `ServiceImpl`
- [ ] Repository extends `JpaRepository` or `CrudRepository`
- [ ] New entities placed in `model/db/`, DTOs in `model/response/`

**Entities**
- [ ] New entity has: `deleted`, `createdBy`, `createdDate`, `modifiedBy`, `lastModDate`
- [ ] Table name uses prefix: `t_` (transactional), `m_` (master)
- [ ] Column names match DB PascalCase convention
- [ ] Soft-delete: queries filter `deleted = false`

**Error handling**
- [ ] Service methods wrapped in try-catch
- [ ] `AMRITException` thrown on failure (not raw `RuntimeException`)
- [ ] Exception logged at ERROR level with context (entity ID, not PII)
- [ ] Error response uses `OutputResponse.setError()`

**Security**
- [ ] No PII (name, phone, Aadhar) in log statements
- [ ] Aadhar handling uses AES encryption utility
- [ ] Endpoints require `Authorization` header declaration

**Code quality**
- [ ] Logger is field-level (`LoggerFactory.getLogger(this.getClass().getName())`)
- [ ] `InputMapper.gson()` used for deserialization
- [ ] No raw SQL unless necessary; JPQL preferred
- [ ] `@Transactional` on multi-repo write operations

---

### Angular / TypeScript Review (HWC-UI, Helpline104-UI, TM-UI, MMU-UI)

**Architecture**
- [ ] New components use standalone pattern (Angular 17+) or NgModule (legacy)
- [ ] No business logic in templates — delegate to component class
- [ ] Services use `providedIn: 'root'` or explicit module scope
- [ ] Base URLs from `environment.ts`, never hardcoded

**RxJS / Subscriptions**
- [ ] No unmanaged subscriptions — `takeUntil(destroy$)` or `async` pipe used
- [ ] `_binding` or destroy subject nulled in `ngOnDestroy`
- [ ] No nested `.subscribe()` calls — composed with `switchMap` / `combineLatest`

**Forms**
- [ ] Reactive Forms used (not template-driven)
- [ ] Validators applied, error messages shown via `mat-error`

**TypeScript**
- [ ] No `any` in new code — interfaces defined for data shapes
- [ ] Injected deps marked `readonly`
- [ ] `const` preferred over `let`

**Accessibility**
- [ ] `<img>` has `alt` attribute
- [ ] Form fields have `mat-label` or `aria-label`

---

### Kotlin / Android Review (AMRIT-Mobile)

**Architecture**
- [ ] ViewModel uses `StateFlow` (not `LiveData`)
- [ ] Sealed class covers all UI states: `Idle`, `Loading`, `Success`, `Error`
- [ ] Fragment observes state via `viewLifecycleOwner.lifecycleScope`
- [ ] `_binding` nulled in `onDestroyView()`

**Coroutines**
- [ ] All async ops in `viewModelScope` or `viewLifecycleOwner.lifecycleScope`
- [ ] No `GlobalScope` usage
- [ ] Repository returns `Result<T>`, not raw network responses

**Offline-first**
- [ ] Write operations saved to Room DB before API call (or on API failure)
- [ ] `isSynced` column updated after successful sync
- [ ] WorkManager constraints require `NetworkType.CONNECTED`

**Dependency injection**
- [ ] `@HiltViewModel` on ViewModels
- [ ] `@AndroidEntryPoint` on Fragments/Activities
- [ ] New deps declared in a Hilt `@Module`

---

## Output Format

Produce a structured GitHub review comment:

```markdown
## AMRIT Code Review

**Repo:** [repo name] | **PR:** #[number]
**Reviewer:** AI (AMRIT Framework) | **Standards applied:** [spring-boot / angular / kotlin-android]

---

### ❌ Must Fix (blocks merge)
1. **[File:Line]** [Issue description] — [why it violates AMRIT standards]
   > Suggested fix: `[code snippet]`

### ⚠️ Should Fix (strong recommendation)
1. ...

### 💡 Consider (style / improvement)
1. ...

### ✅ Looks Good
- [List things done well — reinforce good patterns]

---

**Summary:** [2–3 sentence overall assessment. Safe to merge? What's the main risk?]
```

## Severity Definitions
- **Must Fix**: Security issue, missing error handling, violates core architecture rule, PII in logs
- **Should Fix**: Missing test, wrong layer (logic in controller), hardcoded value
- **Consider**: Naming, minor style, optional improvement

## Using MCP Tools
If available, use `search_amrit_code` to check if the pattern used in the PR
is consistent with how similar things are done elsewhere in the codebase before
flagging it as a violation.
