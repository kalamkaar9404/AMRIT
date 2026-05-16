---
name: amrit-deployment-validator
description: >
  Assist with AMRIT CI/CD workflows, validate deployment readiness, and
  generate deployment checklists for releasing AMRIT services to staging or
  production.
triggers:
  - "deployment checklist"
  - "ready to deploy"
  - "release checklist"
  - "CI/CD"
  - "deploy this"
---

# Skill: AMRIT Deployment Validator

## Purpose
Verify that a branch/PR is safe to deploy and generate an environment-specific
deployment checklist for AMRIT backend services, frontends, or the mobile app.

## Inputs
- Target service / repo
- Target environment: `staging` or `production`
- Optional: JIRA release ticket or sprint number

## Pre-Deployment Checklist

### Code Quality Gates
- [ ] All unit tests passing in CI
- [ ] No new `@SuppressWarnings` or `// TODO: fix` on critical paths
- [ ] No hardcoded credentials, URLs, or environment values
- [ ] SonarQube quality gate passed (if configured)
- [ ] PR reviewed and approved by at least one senior developer

### Database Migrations
- [ ] Migration scripts present in `src/main/resources/db/migration/`
- [ ] Migration is idempotent (safe to re-run)
- [ ] Migration tested on a copy of production data
- [ ] Rollback script available if migration adds non-nullable columns

### API Compatibility
- [ ] No breaking changes to existing API contracts (added fields are OK, removed/renamed are not)
- [ ] If breaking change is unavoidable, version the endpoint (`/api/v2/`)
- [ ] Frontend repos updated to match any API changes

### Configuration
- [ ] `application.properties` / `application-prod.properties` updated if new config added
- [ ] New environment variables documented in `.env.example` / deployment runbook
- [ ] Feature flags off by default in production

### Security
- [ ] No new endpoints bypass `Authorization` header check
- [ ] Sensitive data (Aadhar, phone) encrypted at rest
- [ ] CORS configuration reviewed (not `*` in production)

---

## Deployment Steps by Artifact

### Spring Boot Service (JAR)

```bash
# 1. Build
mvn clean package -DskipTests -P<profile>

# 2. Run DB migrations (Flyway auto-runs on startup, but verify:)
mvn flyway:info -Dflyway.url=jdbc:mysql://<host>/<db>

# 3. Deploy JAR
scp target/<service>-<version>.jar deploy@<server>:/opt/amrit/<service>/
ssh deploy@<server> "sudo systemctl restart amrit-<service>"

# 4. Health check
curl -f http://<server>:<port>/actuator/health

# 5. Smoke test
curl -H "Authorization: <token>" http://<server>:<port>/api/v1/beneficiary/test
```

### Angular Frontend (Nginx)

```bash
# 1. Build
ng build --configuration=production

# 2. Deploy dist/
rsync -av dist/<app-name>/ deploy@<server>:/var/www/html/<app>/

# 3. Reload Nginx
ssh deploy@<server> "sudo nginx -t && sudo systemctl reload nginx"

# 4. Smoke test — open in browser and verify:
#    - Login works
#    - Main landing page loads without console errors
#    - API calls return 200 (not CORS errors)
```

### Android APK/AAB

```bash
# 1. Build release
./gradlew bundleRelease  # or assembleRelease for APK

# 2. Sign
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore release.keystore app/build/outputs/bundle/release/app-release.aab <key-alias>

# 3. Distribute
# Internal: share via Firebase App Distribution
# Production: upload to Google Play Console → review → staged rollout (10% → 100%)

# 4. Post-release check
# Monitor crash-free rate in Firebase Crashlytics for 24h before full rollout
```

---

## Post-Deployment Validation

```markdown
### Post-Deploy Checklist (first 30 minutes)

- [ ] Service health endpoint returns 200: `GET /actuator/health`
- [ ] Application logs show no ERROR-level entries at startup
- [ ] DB connection pool established (check logs for HikariCP "connected")
- [ ] Smoke test: complete one full user flow (e.g. login → beneficiary search → register)
- [ ] Check for spikes in error rate on monitoring dashboard
- [ ] Confirm new JIRA ticket features are working as per acceptance criteria
- [ ] Mobile app (if updated): verify sync worker is scheduled and runs

### Rollback Trigger Criteria
Roll back immediately if:
- Error rate > 5% in first 15 minutes
- Any 500 errors on critical paths (login, beneficiary registration, data submission)
- DB migration failed mid-way (restore from backup)
- Mobile: crash-free rate drops below 99%
```

---

## Rollback Procedure

```bash
# Spring Boot: revert to previous JAR
ssh deploy@<server> "sudo systemctl stop amrit-<service>"
cp /opt/amrit/<service>/backups/<previous-version>.jar /opt/amrit/<service>/<service>.jar
ssh deploy@<server> "sudo systemctl start amrit-<service>"

# Angular: revert to previous build
rsync -av /var/www/html/<app>-backup/ /var/www/html/<app>/
sudo systemctl reload nginx

# DB: apply rollback migration (if written)
flyway -url=... -user=... -password=... repair
```

---

## Release Notes Template

```markdown
## AMRIT Release — v<version> — <date>

### What's New
- [Feature 1] ([AMRIT-n])
- [Feature 2] ([AMRIT-n])

### Bug Fixes
- Fixed: [bug description] ([AMRIT-n])

### Services Updated
| Service | Previous Version | New Version |
|---|---|---|
| HWC-API | 2.3.1 | 2.4.0 |
| HWC-UI | 1.8.0 | 1.8.1 |

### DB Migrations
- `V42__add_village_cache.sql` — adds `village_cache` table

### Config Changes
- New env var: `FEATURE_VILLAGE_CACHE=true` (default false)

### Known Issues
- [If any]

### Deployment Order
1. Run DB migration
2. Deploy HWC-API
3. Deploy HWC-UI
4. Smoke test
```
