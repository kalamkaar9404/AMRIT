# AMRIT Kotlin/Android Coding Standards

Applies to the AMRIT Mobile (ASHA companion app) repository.
Tech stack: Kotlin, MVVM, Room, Retrofit, WorkManager, Hilt, Coroutines.

---

## Architecture: MVVM + Clean Layers

```
app/src/main/java/com/psmri/amrit/
├── di/                    # Hilt modules
├── data/
│   ├── local/
│   │   ├── dao/           # Room DAOs
│   │   ├── entity/        # Room entities
│   │   └── database/      # RoomDatabase class
│   ├── remote/
│   │   ├── api/           # Retrofit service interfaces
│   │   └── dto/           # Network DTOs (request/response models)
│   └── repository/        # Repository implementations
├── domain/
│   ├── model/             # Domain models (pure Kotlin, no Android deps)
│   ├── repository/        # Repository interfaces
│   └── usecase/           # Use cases (one public method each)
├── ui/
│   ├── <feature>/
│   │   ├── <Feature>Fragment.kt
│   │   ├── <Feature>ViewModel.kt
│   │   └── <Feature>Adapter.kt   # (if list view)
│   └── common/            # Shared fragments, base classes
├── worker/                # WorkManager workers (offline sync)
└── utils/                 # Extensions, constants
```

---

## ViewModel Pattern

```kotlin
@HiltViewModel
class BeneficiaryRegistrationViewModel @Inject constructor(
    private val registerBeneficiaryUseCase: RegisterBeneficiaryUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<RegistrationUiState>(RegistrationUiState.Idle)
    val uiState: StateFlow<RegistrationUiState> = _uiState.asStateFlow()

    fun register(request: BeneficiaryRequest) {
        viewModelScope.launch {
            _uiState.value = RegistrationUiState.Loading
            registerBeneficiaryUseCase(request)
                .onSuccess { _uiState.value = RegistrationUiState.Success(it) }
                .onFailure { _uiState.value = RegistrationUiState.Error(it.message ?: "Unknown error") }
        }
    }
}

sealed class RegistrationUiState {
    object Idle : RegistrationUiState()
    object Loading : RegistrationUiState()
    data class Success(val beneficiaryId: Long) : RegistrationUiState()
    data class Error(val message: String) : RegistrationUiState()
}
```

- Use `StateFlow` / `SharedFlow` — not `LiveData` in new code.
- All coroutine launches inside `viewModelScope`.
- Sealed classes for UI state — `Idle`, `Loading`, `Success`, `Error`.
- ViewModels must not hold references to Context, Views, or Fragments.

---

## Fragment Pattern

```kotlin
@AndroidEntryPoint
class BeneficiaryRegistrationFragment : Fragment(R.layout.fragment_beneficiary_registration) {

    private val viewModel: BeneficiaryRegistrationViewModel by viewModels()
    private var _binding: FragmentBeneficiaryRegistrationBinding? = null
    private val binding get() = _binding!!

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        _binding = FragmentBeneficiaryRegistrationBinding.bind(view)

        setupListeners()
        observeUiState()
    }

    private fun setupListeners() {
        binding.btnRegister.setOnClickListener {
            val request = BeneficiaryRequest(
                firstName = binding.etFirstName.text.toString(),
                phoneNo = binding.etPhone.text.toString()
            )
            viewModel.register(request)
        }
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is RegistrationUiState.Loading -> binding.progressBar.isVisible = true
                    is RegistrationUiState.Success -> {
                        binding.progressBar.isVisible = false
                        // navigate or show success
                    }
                    is RegistrationUiState.Error -> {
                        binding.progressBar.isVisible = false
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                    else -> binding.progressBar.isVisible = false
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null  // prevent memory leaks
    }
}
```

- ViewBinding for all layouts — no `findViewById`.
- Null `_binding` in `onDestroyView()`.
- Collect StateFlow in `viewLifecycleOwner.lifecycleScope`.

---

## Room Database

```kotlin
@Entity(tableName = "beneficiary")
data class BeneficiaryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val beneficiaryRegId: Long?,
    val firstName: String,
    val phoneNo: String?,
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface BeneficiaryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(beneficiary: BeneficiaryEntity): Long

    @Query("SELECT * FROM beneficiary WHERE isSynced = 0")
    fun getUnsynced(): Flow<List<BeneficiaryEntity>>

    @Query("UPDATE beneficiary SET isSynced = 1, beneficiaryRegId = :serverId WHERE id = :localId")
    suspend fun markSynced(localId: Long, serverId: Long)
}
```

- Entities are `data class` with `@Entity`.
- DAOs are interfaces with `suspend` functions (for one-shot ops) or `Flow` (for reactive queries).
- `isSynced` column tracks offline-first sync state.
- All DB operations are off the main thread (Room enforces this with coroutines).

---

## Offline-First Sync with WorkManager

```kotlin
class BeneficiarySyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val beneficiaryRepository: BeneficiaryRepository
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            beneficiaryRepository.syncPendingBeneficiaries()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}

// Schedule on network availability:
val constraints = Constraints.Builder()
    .setRequiredNetworkType(NetworkType.CONNECTED)
    .build()

val syncRequest = PeriodicWorkRequestBuilder<BeneficiarySyncWorker>(15, TimeUnit.MINUTES)
    .setConstraints(constraints)
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "beneficiary_sync", ExistingPeriodicWorkPolicy.KEEP, syncRequest
)
```

- Sync workers run only when network is available.
- Retry up to 3 times with exponential backoff before marking failure.
- Use `enqueueUniquePeriodicWork` with `KEEP` policy to prevent duplicate workers.

---

## Retrofit / Network Layer

```kotlin
interface AmritApiService {
    @POST("api/v1/beneficiary/register")
    suspend fun registerBeneficiary(@Body request: BeneficiaryRequest): Response<BeneficiaryResponse>

    @GET("api/v1/beneficiary/{id}")
    suspend fun getBeneficiary(@Path("id") beneficiaryRegId: Long): Response<BeneficiaryResponse>
}

// Repository: always return domain Result, never expose Retrofit Response to ViewModel
class BeneficiaryRepositoryImpl @Inject constructor(
    private val api: AmritApiService,
    private val dao: BeneficiaryDao
) : BeneficiaryRepository {

    override suspend fun register(request: BeneficiaryRequest): Result<Long> {
        return try {
            val response = api.registerBeneficiary(request)
            if (response.isSuccessful) {
                val serverId = response.body()?.beneficiaryRegID ?: 0L
                Result.success(serverId)
            } else {
                Result.failure(Exception("Server error: ${response.code()}"))
            }
        } catch (e: Exception) {
            // Offline: save locally, will sync later
            val localId = dao.insert(request.toEntity())
            Result.success(localId)
        }
    }
}
```

---

## Hilt Dependency Injection

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Singleton
    fun provideRetrofit(@ApplicationContext context: Context): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    @Provides @Singleton
    fun provideAmritApiService(retrofit: Retrofit): AmritApiService =
        retrofit.create(AmritApiService::class.java)
}
```

- All dependencies provided via Hilt modules in `di/`.
- API base URL from `BuildConfig` (set in `build.gradle` per build variant).
- `SingletonComponent` for network, DB; `ViewModelComponent` for use cases.

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| ViewModel | PascalCase + `ViewModel` | `BeneficiaryRegistrationViewModel` |
| Fragment | PascalCase + `Fragment` | `BeneficiaryRegistrationFragment` |
| UseCase | Verb phrase + `UseCase` | `RegisterBeneficiaryUseCase` |
| Room Entity | PascalCase + `Entity` | `BeneficiaryEntity` |
| DAO | PascalCase + `Dao` | `BeneficiaryDao` |
| DTO | PascalCase + `Request`/`Response` | `BeneficiaryRequest`, `BeneficiaryResponse` |
| Flow/StateFlow | camelCase + `Flow` suffix | `beneficiaryFlow` |

---

## Testing

- JUnit 5 + MockK for unit tests.
- Turbine for Flow testing.
- Robolectric for Android-dependent unit tests.
- Instrumented tests (Espresso) for UI.

```kotlin
@Test
fun `register beneficiary returns success when API responds 200`() = runTest {
    val mockApi = mockk<AmritApiService>()
    coEvery { mockApi.registerBeneficiary(any()) } returns Response.success(mockResponse)
    val repo = BeneficiaryRepositoryImpl(mockApi, mockk())
    val result = repo.register(testRequest)
    assertTrue(result.isSuccess)
}
```
