# IdentityService

## Purpose
Authentication, RBAC authorization, session management, and user administration for all SaaR CBS users.

## Port
`:5001`

## Responsibilities
- User login / logout / password reset
- JWT access token + refresh token issuance
- Single active session enforcement (3-minute inactivity timeout)
- Role and permission management (TELLER, OFFICER, BRANCH_MANAGER, AUDITOR, ADMIN)
- Financial power limits per user
- Branch-scoped access enforcement
- Two-factor authentication (OTP via SMS for privileged roles)

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/identity/login` | Authenticate user, return JWT tokens |
| POST | `/api/identity/refresh` | Rotate refresh token, return new access token |
| POST | `/api/identity/logout` | Revoke session |
| GET | `/api/identity/me` | Current user profile + permissions |
| POST | `/api/identity/password/change` | Change password |
| POST | `/api/identity/password/reset` | Admin-initiated reset |
| GET | `/api/identity/users` | List users (ADMIN role) |
| POST | `/api/identity/users` | Create user (ADMIN role) |
| PUT | `/api/identity/users/{id}/roles` | Assign roles |

## Data Model
```
User
├── UserId (GUID)
├── Username / Email
├── PasswordHash (BCrypt)
├── BankId (tenant)
├── BranchId (branch-scoped access)
├── Roles: TELLER | OFFICER | BRANCH_MANAGER | AUDITOR | PARAM_ADMIN | REPORT_USER | BANK_ADMIN
├── TransactionLimit (decimal — financial power limit)
├── IsActive, IsLocked
├── LastLoginAt, FailedLoginCount
└── MustChangePassword (forced reset flag)
```

## Integration Points
- All services validate JWT issued by IdentityService
- Redis: session storage (`session:{userId}:{sessionId}`)
- AuditService: all login/logout/failed-login events published

## IDRBT Requirements Met
- Section: IDRBT Annexure II — RBAC, single session, 3-minute timeout
- Maker-Checker: users with MAKER role create; CHECKER role authorizes
