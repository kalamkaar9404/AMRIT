# AMRIT Angular Coding Standards

Applies to all AMRIT Angular frontend repositories: HWC-UI, Helpline104-UI, TM-UI, MMU-UI.
AMRIT frontends span Angular 4 through 19 — newer modules should target Angular 17+ standalone components.

---

## Project Structure

```
src/app/
├── core/
│   ├── services/          # Singleton services (auth, http-interceptor, notification)
│   ├── guards/            # Route guards
│   └── interceptors/      # HTTP interceptors
├── shared/
│   ├── components/        # Reusable UI components
│   ├── directives/        # Custom directives
│   ├── pipes/             # Custom pipes
│   └── models/            # Shared TypeScript interfaces/models
├── <feature>/             # Feature modules (e.g. beneficiary-registration, nurse-worklist)
│   ├── <feature>.module.ts       # (legacy) or standalone component
│   ├── <feature>.component.ts
│   ├── <feature>.component.html
│   ├── <feature>.component.scss
│   └── <feature>.service.ts      # Feature-scoped service
└── app-routing.module.ts
```

---

## Component Conventions

### New code (Angular 17+) — Standalone Components

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { BeneficiaryService } from '../services/beneficiary.service';

@Component({
  selector: 'app-beneficiary-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatInputModule, MatButtonModule],
  templateUrl: './beneficiary-registration.component.html',
  styleUrls: ['./beneficiary-registration.component.scss']
})
export class BeneficiaryRegistrationComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  registrationForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly beneficiaryService: BeneficiaryService
  ) {}

  ngOnInit(): void {
    this.registrationForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      phoneNo: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.registrationForm.invalid) return;
    this.beneficiaryService.register(this.registrationForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { /* handle success */ },
        error: (err) => { /* handle error */ }
      });
  }
}
```

### Legacy code (NgModule-based, Angular 4–16)
- Use `NgModule` with declarations array.
- Inject services via constructor.
- Same lifecycle hooks and RxJS patterns.

---

## Service Conventions

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })  // or module-scoped for feature services
export class BeneficiaryService {
  private readonly API_URL = environment.hwcApiUrl;

  constructor(private readonly http: HttpClient) {}

  register(data: BeneficiaryRegistrationRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/api/v1/beneficiary/register`, JSON.stringify(data))
      .pipe(
        map(res => res),
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('BeneficiaryService error:', error);
    throw error;
  }
}
```

- Services are `providedIn: 'root'` unless feature-scoped.
- Base API URLs come from `environment.ts` / `environment.prod.ts` — never hardcode.
- Use RxJS `pipe(catchError(...))` — never `.subscribe()` in services.
- Mark constructor-injected deps as `readonly`.

---

## HTTP Interceptor Pattern

AMRIT uses a centralized HTTP interceptor for auth headers:

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = sessionStorage.getItem('key');
    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', token)
      });
      return next.handle(authReq);
    }
    return next.handle(req);
  }
}
```

- JWT token stored in `sessionStorage` under key `'key'`.
- All HTTP calls go through this interceptor automatically.
- Do not manually add `Authorization` headers in services.

---

## Forms

- Use Reactive Forms (`FormBuilder`, `FormGroup`, `Validators`) — not Template-Driven.
- Validate on submit, not on every keystroke for performance.
- Custom validators go in `shared/validators/`.
- Show error messages using Angular Material's `mat-error` inside `mat-form-field`.

```html
<mat-form-field>
  <mat-label>Phone Number</mat-label>
  <input matInput formControlName="phoneNo" placeholder="10-digit mobile number">
  <mat-error *ngIf="form.get('phoneNo')?.hasError('pattern')">
    Enter a valid 10-digit mobile number
  </mat-error>
</mat-form-field>
```

---

## State Management

- AMRIT does not use NgRx. State is managed via services with BehaviorSubjects.
- For shared state between components:

```typescript
@Injectable({ providedIn: 'root' })
export class BeneficiaryStateService {
  private selectedBeneficiary$ = new BehaviorSubject<Beneficiary | null>(null);
  readonly selectedBeneficiary = this.selectedBeneficiary$.asObservable();

  setSelected(b: Beneficiary): void {
    this.selectedBeneficiary$.next(b);
  }
}
```

---

## Angular Material

- AMRIT UI uses Angular Material throughout. Do not introduce other component libraries.
- Import only what you need: `MatInputModule`, `MatButtonModule`, etc.
- Use `mat-card` for content sections, `mat-table` for data grids, `mat-dialog` for modals.
- Theme tokens from the global AMRIT theme — do not use inline colors.

---

## RxJS Rules

- Always unsubscribe. Prefer `takeUntil(this.destroy$)` pattern (shown above).
- Use `async` pipe in templates where possible — it auto-unsubscribes.
- Never nest `.subscribe()` calls — compose with operators (`switchMap`, `combineLatest`).
- Avoid `tap()` for side effects in production chains — only use for debugging.

---

## TypeScript

- `strict: true` in tsconfig.
- No `any` in new code — define interfaces in `shared/models/`.
- `readonly` on injected dependencies and immutable class fields.
- Prefer `const` over `let`.
- Interfaces for data shapes, classes only for services/components.

```typescript
export interface Beneficiary {
  readonly beneficiaryRegID: number;
  firstName: string;
  lastName: string;
  phoneNo?: string;
  villageName?: string;
}
```

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Component | `kebab-case` selector, PascalCase class | `app-beneficiary-list`, `BeneficiaryListComponent` |
| Service | `PascalCase` + `Service` suffix | `BeneficiaryService` |
| Module | `PascalCase` + `Module` suffix | `BeneficiaryRegistrationModule` |
| Interface | PascalCase, no `I` prefix | `BeneficiaryDetails` |
| Observable | `$` suffix | `beneficiaries$` |
| Private fields | camelCase | `private beneficiaryService` |

---

## Accessibility & i18n

- All `<img>` must have `alt` attributes.
- Form fields must have `<mat-label>` or `aria-label`.
- AMRIT serves multilingual users — use Angular i18n (`$localize`) for user-facing strings in new code.

---

## Testing

- Jasmine + Karma for unit tests.
- Test file: `<component>.spec.ts` alongside the component.
- Use `TestBed` for component tests, `jasmine.createSpyObj` to mock services.
- Test names: `'should <action> when <condition>'`.
