# AMRIT Spring Boot Coding Standards

These standards apply to all AMRIT Java/Spring Boot backend repositories:
HWC-API, Helpline104-API, TM-API, MMU-API, and the core AMRIT repo.

---

## Package Structure

Every AMRIT service follows a strict layered package layout:

```
com.iemr.<service>/
├── controller/        # REST controllers — thin, no business logic
├── service/
│   ├── <Feature>Service.java       # Interface
│   └── <Feature>ServiceImpl.java   # Implementation
├── repo/              # Spring Data JPA repositories
├── model/
│   ├── db/            # JPA entities (map directly to DB tables)
│   └── response/      # API response DTOs
├── utils/             # Shared utilities, mappers, constants
├── config/            # Spring config classes
└── <ServiceName>Application.java
```

### Rules
- Controllers must not contain business logic. Delegate everything to a service.
- Service interfaces in `service/`, implementations in `service/impl/` or same package as `ServiceImpl`.
- Entities in `model/db/`, response objects in `model/response/`.
- Repos extend `JpaRepository<Entity, Long>` or `CrudRepository`.

---

## Controller Conventions

```java
@RestController
@RequestMapping(value = "/api/v1/beneficiary", headers = "Authorization")
@CrossOrigin
public class BeneficiaryController {

    @Autowired
    private BeneficiaryService beneficiaryService;

    @PostMapping("/register")
    public String registerBeneficiary(@RequestBody String requestBody) {
        logger.info("registerBeneficiary request");
        return beneficiaryService.registerBeneficiary(requestBody);
    }
}
```

- All endpoints require `Authorization` header (JWT via interceptor).
- Use `@CrossOrigin` on all controllers.
- Return type is typically `String` (JSON-encoded) for legacy APIs; new endpoints may use `ResponseEntity<OutputResponse>`.
- Log every incoming request at INFO level using SLF4J.
- API versioning via URL prefix (`/api/v1/`).

---

## Service Layer

```java
public interface BeneficiaryService {
    String registerBeneficiary(String request);
    String getBeneficiaryDetails(Long beneficiaryRegID);
}

@Service
public class BeneficiaryServiceImpl implements BeneficiaryService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass().getName());

    @Autowired
    private BeneficiaryRepo beneficiaryRepo;

    @Override
    public String registerBeneficiary(String request) {
        try {
            // parse → validate → persist → return
            InputMapper inputMapper = InputMapper.gson();
            BeneficiaryModel beneficiary = inputMapper.fromJson(request, BeneficiaryModel.class);
            // ... business logic
            return new Gson().toJson(Map.of("response", "Beneficiary registered successfully"));
        } catch (Exception e) {
            logger.error("registerBeneficiary failed", e);
            throw new AMRITException(e.getMessage());
        }
    }
}
```

- Wrap all service methods in try-catch. Log the exception. Throw `AMRITException`.
- Use `InputMapper.gson()` to deserialize request strings.
- Use `new Gson()` for serialization.
- `@Transactional` on write methods that touch multiple repos.

---

## Repository Layer

```java
@Repository
public interface BeneficiaryRepo extends JpaRepository<BeneficiaryModel, Long> {

    @Query("SELECT b FROM BeneficiaryModel b WHERE b.beneficiaryRegID = :id AND b.deleted = false")
    Optional<BeneficiaryModel> findActiveById(@Param("id") Long id);

    // Named queries for complex filters
    List<BeneficiaryModel> findByVillageIDAndDeleted(Integer villageID, Boolean deleted);
}
```

- All entities have a `deleted` boolean column (soft-delete pattern).
- Always filter `deleted = false` in queries unless intentionally fetching deleted records.
- Use `@Query` for JPQL when the derived query name would be unwieldy.
- No raw SQL unless absolutely necessary — use named native queries with `@Query(nativeQuery=true)`.

---

## Entity Conventions

```java
@Entity
@Table(name = "t_beneficiary_details")
public class BeneficiaryModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "BeneficiaryRegID")
    private Long beneficiaryRegID;

    @Column(name = "BeneficiaryID")
    private Long beneficiaryID;

    @Column(name = "FirstName", length = 50)
    private String firstName;

    @Column(name = "Deleted", columnDefinition = "tinyint(1) default 0")
    private Boolean deleted = false;

    @Column(name = "CreatedBy", length = 50)
    private String createdBy;

    @Column(name = "CreatedDate", insertable = true, updatable = false)
    private Timestamp createdDate;

    @Column(name = "ModifiedBy", length = 50)
    private String modifiedBy;

    @Column(name = "LastModDate")
    private Timestamp lastModDate;

    // Getters/setters (no Lombok by default in AMRIT)
}
```

- Table names use prefix `t_` for transactional, `m_` for master data.
- Column names use PascalCase (matches existing DB schema).
- Every entity has: `deleted`, `createdBy`, `createdDate`, `modifiedBy`, `lastModDate`.
- No Lombok — AMRIT uses explicit getters/setters.

---

## Error Handling

```java
// Throw this from service layer
throw new AMRITException("Beneficiary not found for ID: " + id);

// In controllers, errors bubble up to a global handler
// @ControllerAdvice handles AMRITException and returns structured JSON
```

- `AMRITException` is the standard unchecked exception across all AMRIT services.
- Never swallow exceptions silently — always log at ERROR level.
- Return a consistent error response: `{"statusCode": 5000, "errorMessage": "...", "status": "failure"}`.

---

## Security

- All endpoints secured via JWT. The token is validated in a `HandlerInterceptor`.
- Role-based access: roles defined in `m_Role` table and included in JWT claims.
- Never log PII (patient name, phone, Aadhar) in production logs.
- Aadhar numbers are encrypted at rest using AES-256.

---

## Logging

```java
private final Logger logger = LoggerFactory.getLogger(this.getClass().getName());

// Use this pattern:
logger.info("methodName request received for beneficiaryID: {}", beneficiaryID);
logger.error("methodName failed for beneficiaryID: {}", beneficiaryID, exception);
```

- Logger is always field-level, never static.
- Log entry and exit for every public service method at DEBUG level, errors at ERROR.
- Include entity IDs (not PII) in log messages for traceability.

---

## API Response Format

```json
// Success
{"data": {...}, "statusCode": 200, "status": "Success"}

// Error  
{"statusCode": 5000, "errorMessage": "Beneficiary not found", "status": "failure"}
```

Use `OutputResponse` wrapper class — set `.setResponse(data)` or `.setError(message)`.

---

## Testing

- JUnit 5 with Mockito.
- Test class: `<ServiceImpl>Test.java` alongside the class it tests, or under `src/test/`.
- Mock repositories, not the full Spring context (`@ExtendWith(MockitoExtension.class)`).
- Test names: `methodName_scenario_expectedOutcome`.

```java
@Test
void registerBeneficiary_validInput_returnsSuccessResponse() {
    // Arrange
    when(beneficiaryRepo.save(any())).thenReturn(mockBeneficiary);
    // Act + Assert
}
```
