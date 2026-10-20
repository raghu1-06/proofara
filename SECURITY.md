# Empire Arena — Security Architecture & Access Model

## 1. Intended Deployment Model & Boundary

Empire Arena (Phase 6.1) is explicitly designed and hardened as a **Single-Tenant / Trusted Operator Platform**.

- **Target Audience:** An individual AI engineer, researcher, or trusted private team operating within a secure, dedicated environment.
- **Scope Limitation:** This version does **NOT** support public multi-tenant SaaS isolation, multi-user accounts, or per-user data isolation. All authorized operators share access to the platform's experiment catalogue, model configurations, and historical audit runs.
- **Public vs. Protected Boundaries:**
  - **Public Routes:** `/`, `/api/health`, `/api/models`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/status`, and OpenAPI metadata (`/docs`, `/redoc`, `/openapi.json`).
  - **Protected Routes:** All mutating endpoints (experiment creation/editing/deletion, evaluation execution, provider settings, backup creation/restoration, and Oracle consultations) require authorization.

## 2. Authentication Protocol

1. **Browser Sessions (HttpOnly Cookie):**
   - The operator authenticates via `POST /api/auth/login` by submitting the operator key.
   - The backend validates the key using constant-time string comparison (`hmac.compare_digest`) and issues a cryptographically signed session cookie (`empire_session`).
   - Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=86400` (24 hours), and `Secure` (in production/HTTPS).
   - **Zero Secret Exposure:** Raw administrative keys and secrets are never stored in browser `localStorage`, `sessionStorage`, or frontend bundles.
2. **Programmatic / CLI Access:**
   - Automation pipelines, SDKs, and scripts supply the key via the `X-Empire-Key` header or `Authorization: Bearer <key>`.
3. **CSRF Mitigation:**
   - SameSite cookie policies prevent cross-site request inclusion for cross-origin forms.
   - Mutating requests (`POST`, `PUT`, `DELETE`) require custom headers (`X-Requested-With` or `Content-Type: application/json`) and enforce origin matching against configured `CORS_ORIGINS`.

## 3. Secret Management & Cryptography

1. **Encryption-at-Rest:**
   - Sensitive credentials (e.g. OpenAI, Anthropic, Gemini API keys) are encrypted using authenticated symmetric encryption (**AES-128-CBC + HMAC-SHA256** via `cryptography.fernet`).
   - Ciphertexts are stored with a versioned prefix (`vault:v1:...`).
2. **Production Key Invariant:**
   - In production (`ENVIRONMENT=production`), the application strictly enforces that `VAULT_MASTER_KEY` or `EMPIRE_SECRET_KEY` is provided. Ephemeral key generation is rejected during startup to prevent data loss across container redeployments.
3. **Credential Masking:**
   - API responses never expose decrypted keys. Keys are masked (e.g. `sk-a••••••••••••689`) before delivery to the frontend.
4. **Key Rotation:**
   - The CLI utility `python -m backend.app.key_rotation` and protected endpoint `POST /api/system/rotate-keys` re-encrypt stored credentials from an old master key to a new master key atomically.

## 4. Network & Container Hardening

1. **Non-Root Execution:**
   - Container processes run as unprivileged user `empireuser` (`uid=10001, gid=10001`).
   - Docker security options enforce `no-new-privileges:true`.
2. **Network Isolation:**
   - Container port 8000 binds strictly to `127.0.0.1` (loopback). Direct WAN exposure without reverse proxy TLS termination is prohibited.
3. **Build Context Hygiene:**
   - `.dockerignore` excludes all `.env*`, `.key`, `*.db`, and `backups/` files from image build contexts.
4. **Content Security Policy (CSP):**
   - Reverse proxies enforce strict CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
