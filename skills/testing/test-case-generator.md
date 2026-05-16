---
name: amrit-test-case-generator
description: >
  Generate unit tests, integration test cases, or QA test scenarios for any
  AMRIT component — Spring Boot services (JUnit 5 + Mockito), Angular
  components (Jasmine), or Kotlin ViewModels (MockK + Turbine).
triggers:
  - "write tests for"
  - "generate test cases"
  - "unit test for"
  - "test this service"
  - "QA test cases"
---

# Skill: AMRIT Test Case Generator

## Purpose
Generate ready-to-run or structured test cases for AMRIT code across all layers
and test types (unit, integration, QA manual).

## Inputs
- The class/method/component to test (code or file reference)
- Test type: `unit`, `integration`, or `qa-manual`
- Optional: JIRA ticket / acceptance criteria to derive cases from

---

## Unit Tests — Java/Spring Boot (JUnit 5 + Mockito)

### Template

```java
@ExtendWith(MockitoExtension.class)
class BeneficiaryServiceImplTest {

    @Mock private BeneficiaryRepo beneficiaryRepo;
    @Mock private InputMapper inputMapper;

    @InjectMocks private BeneficiaryServiceImpl service;

    // ── Happy path ────────────────────────────────────────────────────────────

    @Test
    void registerBeneficiary_validInput_returnsBeneficiaryId() {
        // Arrange
        String request = "{\"firstName\":\"Priya\",\"phoneNo\":\"9876543210\"}";
        BeneficiaryModel saved = new BeneficiaryModel();
        saved.setBeneficiaryRegID(42L);
        when(beneficiaryRepo.save(any(BeneficiaryModel.class))).thenReturn(saved);

        // Act
        String result = service.registerBeneficiary(request);

        // Assert
        assertThat(result).contains("42");
        verify(beneficiaryRepo, times(1)).save(any());
    }

    // ── Error path ────────────────────────────────────────────────────────────

    @Test
    void registerBeneficiary_repoThrows_throwsAmritException() {
        when(beneficiaryRepo.save(any())).thenThrow(new RuntimeException("DB error"));
        assertThrows(AMRITException.class, () -> service.registerBeneficiary("{}"));
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    @Test
    void registerBeneficiary_nullPhoneNo_stillRegistersSuccessfully() { ... }

    @Test
    void getBeneficiary_deletedRecord_returnsNull() {
        when(beneficiaryRepo.findActiveById(1L)).thenReturn(Optional.empty());
        String result = service.getBeneficiaryDetails(1L);
        assertThat(result).contains("null").doesNotContain("error");
    }
}
```

### Cases to always generate
1. Happy path with valid input
2. Repo/dependency throws exception → `AMRITException` propagated
3. Null / empty fields in input
4. Soft-deleted record (should not be returned)
5. `@Transactional` methods: verify rollback on failure (integration test)

---

## Unit Tests — Angular/TypeScript (Jasmine + TestBed)

### Template

```typescript
describe('BeneficiaryService', () => {
  let service: BeneficiaryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BeneficiaryService]
    });
    service = TestBed.inject(BeneficiaryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should POST to register endpoint and return response', () => {
    const mockRequest = { firstName: 'Priya', phoneNo: '9876543210' };
    const mockResponse = { beneficiaryRegID: 42 };

    service.register(mockRequest).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.hwcApiUrl}/api/v1/beneficiary/register`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should propagate HTTP error', () => {
    service.register({} as any).subscribe({
      error: err => expect(err.status).toBe(500)
    });
    httpMock.expectOne(/.+/).flush('Server error', { status: 500, statusText: 'Error' });
  });
});

// Component test
describe('BeneficiaryRegistrationComponent', () => {
  let component: BeneficiaryRegistrationComponent;
  let fixture: ComponentFixture<BeneficiaryRegistrationComponent>;
  let mockService: jasmine.SpyObj<BeneficiaryService>;

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('BeneficiaryService', ['register']);

    await TestBed.configureTestingModule({
      imports: [BeneficiaryRegistrationComponent, ReactiveFormsModule],
      providers: [{ provide: BeneficiaryService, useValue: mockService }]
    }).compileComponents();

    fixture = TestBed.createComponent(BeneficiaryRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();
    expect(mockService.register).not.toHaveBeenCalled();
  });

  it('should call service with form data on valid submit', () => {
    mockService.register.and.returnValue(of({ success: true }));
    component.registrationForm.setValue({ firstName: 'Priya', phoneNo: '9876543210' });
    component.onSubmit();
    expect(mockService.register).toHaveBeenCalledWith({ firstName: 'Priya', phoneNo: '9876543210' });
  });
});
```

---

## Unit Tests — Kotlin/Android (MockK + Turbine + runTest)

### Template

```kotlin
@ExtendWith(MockKExtension::class)
class BeneficiaryRegistrationViewModelTest {

    @MockK lateinit var registerBeneficiaryUseCase: RegisterBeneficiaryUseCase
    private lateinit var viewModel: BeneficiaryRegistrationViewModel

    @BeforeEach
    fun setUp() {
        viewModel = BeneficiaryRegistrationViewModel(registerBeneficiaryUseCase)
    }

    @Test
    fun `register emits Loading then Success when use case succeeds`() = runTest {
        coEvery { registerBeneficiaryUseCase(any()) } returns Result.success(42L)

        viewModel.uiState.test {
            assertThat(awaitItem()).isInstanceOf(RegistrationUiState.Idle::class.java)
            viewModel.register(testRequest)
            assertThat(awaitItem()).isInstanceOf(RegistrationUiState.Loading::class.java)
            assertThat(awaitItem()).isInstanceOf(RegistrationUiState.Success::class.java)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `register emits Error when use case fails`() = runTest {
        coEvery { registerBeneficiaryUseCase(any()) } returns Result.failure(Exception("Network error"))

        viewModel.uiState.test {
            awaitItem() // Idle
            viewModel.register(testRequest)
            awaitItem() // Loading
            val error = awaitItem()
            assertThat(error).isInstanceOf(RegistrationUiState.Error::class.java)
            cancelAndIgnoreRemainingEvents()
        }
    }

    private val testRequest = BeneficiaryRequest(firstName = "Priya", phoneNo = "9876543210")
}
```

---

## QA Manual Test Cases

When `qa-manual` type is requested, generate a table:

```markdown
## Manual Test Cases: [Feature Name]

| ID | Test Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-01 | Register beneficiary with valid data | User logged in as Nurse | 1. Open registration form 2. Fill all mandatory fields 3. Click Submit | Beneficiary registered, ID displayed, record in DB | High |
| TC-02 | Register with missing mandatory fields | User logged in | Fill only optional fields, submit | Form shows validation errors, no API call | High |
| TC-03 | Register offline (mobile) | Network disabled on device | Fill form and submit | Data saved locally, sync icon shown | High |
| TC-04 | Data syncs after network restored | TC-03 completed | Re-enable network | Record appears in server DB, isSynced = true | High |
| TC-05 | Duplicate phone number | Existing record with same phone | Register new beneficiary with same phone | [Expected behaviour per BRD] | Medium |
```

---

## Generation Instructions

When generating tests:
1. Read the class/method under test — identify inputs, outputs, dependencies
2. Generate at minimum: 1 happy path, 1 error path, 1 edge case per method
3. Use `search_amrit_code` to find existing test patterns in the repo for consistency
4. For Spring Boot: mock repos with Mockito, never mock the system under test
5. For Android: always test state emission sequence with Turbine
6. Name tests: `methodName_scenario_expectedOutcome` (Java) or backtick sentence (Kotlin)
