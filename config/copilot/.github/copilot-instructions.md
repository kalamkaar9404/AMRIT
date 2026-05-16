# GitHub Copilot Instructions — AMRIT Project

This repository is part of the AMRIT open-source EHR platform by Piramal Swasthya.
Apply these conventions to all code suggestions.

## About AMRIT

AMRIT is an Indian public health Electronic Health Record system. Repositories:
- Spring Boot backends: HWC-API, Helpline104-API, TM-API, MMU-API
- Angular frontends (4–19): HWC-UI, Helpline104-UI, TM-UI, MMU-UI
- Kotlin/Android: AMRIT-Mobile (offline-first ASHA companion app)

---

## Java / Spring Boot

**Do:**
- Place controllers in `controller/`, services in `service/` (interface + ServiceImpl), repos in `repo/`, entities in `model/db/`
- Catch all exceptions in service methods; throw `AMRITException`; log at `logger.error()`
- Give every entity: `deleted`, `createdBy`, `createdDate`, `modifiedBy`, `lastModDate` fields
- Filter soft-deleted records: `WHERE deleted = false` / `findByXxxAndDeletedFalse`
- Use `InputMapper.gson()` to parse JSON request strings
- Use `OutputResponse` wrapper for API responses
- Declare `Authorization` header on all controller request mappings

**Don't:**
- Put logic in controllers
- Use Lombok
- Log PII (names, phone numbers, Aadhar)
- Hardcode URLs or passwords
- Use `System.out.println`

## Angular / TypeScript

**Do:**
- Use standalone components (Angular 17+) or NgModule (legacy)
- Use Reactive Forms with FormBuilder
- Unsubscribe with `takeUntil(this.destroy$)` in ngOnDestroy
- Get API base URLs from `environment.ts`
- Let `AuthInterceptor` add auth headers automatically
- Use Angular Material components
- Define TypeScript interfaces for all data (no `any`)

**Don't:**
- Add logic to HTML templates
- Use template-driven forms
- Hardcode API URLs
- Nest `.subscribe()` calls

## Kotlin / Android

**Do:**
- Use `@HiltViewModel` and `@AndroidEntryPoint`
- Expose UI state as `StateFlow` with sealed class (Idle/Loading/Success/Error)
- Save to Room DB before API call (offline-first)
- Use `viewModelScope.launch` for async
- Null `_binding` in `onDestroyView()`
- Return `Result<T>` from repositories

**Don't:**
- Use `LiveData` in new code
- Use `GlobalScope`
- Leave subscriptions unmanaged

## Naming

- Java: `BeneficiaryServiceImpl`, `BeneficiaryRepo`, table `t_beneficiary_details`
- Angular: `beneficiary-registration.component.ts`, `BeneficiaryService`
- Kotlin: `BeneficiaryRegistrationViewModel`, `BeneficiaryEntity`, `RegisterBeneficiaryUseCase`
