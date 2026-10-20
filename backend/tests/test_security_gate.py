import os
import glob
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

def test_built_assets_contain_no_secrets():
    """
    Scans the compiled frontend bundle (dist/assets/) to guarantee no
    server-side master keys, VITE_ secrets, or API credentials are embedded.
    """
    dist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "dist")
    assert os.path.exists(dist_dir), "Production dist directory must exist (run npm run build first)"

    asset_files = glob.glob(os.path.join(dist_dir, "assets", "*.*"))
    assert len(asset_files) > 0, "Built asset files must be present in dist/assets"

    forbidden_patterns = [
        "VITE_EMPIRE_API_KEY",
        "VAULT_MASTER_KEY",
        "EMPIRE_SECRET_KEY",
        "sk-proj-",
        "sk-ant-api",
        "empire_sec_live_",
        "AIzaSy"
    ]

    for fpath in asset_files:
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                for pattern in forbidden_patterns:
                    assert pattern not in content, (
                        f"CRITICAL SECURITY LEAK: Forbidden pattern '{pattern}' detected in built asset '{os.path.basename(fpath)}'"
                    )
        except Exception as e:
            pytest.fail(f"Failed to scan asset file {fpath}: {e}")

def test_all_protected_endpoints_enforce_auth_boundary(monkeypatch):
    """
    Audits every API route in the application to ensure mutating and sensitive
    routes strictly return 401 when called without credentials.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    protected_endpoints = [
        ("GET", "/api/experiments"),
        ("POST", "/api/experiments"),
        ("GET", "/api/experiments/exp-12345"),
        ("PUT", "/api/experiments/exp-12345"),
        ("DELETE", "/api/experiments/exp-12345"),
        ("POST", "/api/experiments/exp-12345/run"),
        ("GET", "/api/runs"),
        ("GET", "/api/compare?experiment_id=exp-1"),
        ("GET", "/api/providers"),
        ("POST", "/api/providers/openai"),
        ("POST", "/api/providers/test"),
        ("POST", "/api/eval/test-single"),
        ("POST", "/api/eval/generate-cases"),
        ("POST", "/api/oracle/consult"),
        ("POST", "/api/oracle/ai-synthesis"),
        ("POST", "/api/system/backup"),
        ("GET", "/api/system/backups"),
        ("POST", "/api/system/restore"),
        ("POST", "/api/system/rotate-keys")
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        elif method == "POST":
            res = client.post(path, json={})
        elif method == "PUT":
            res = client.put(path, json={})
        elif method == "DELETE":
            res = client.delete(path)
        else:
            continue

        assert res.status_code == 401, (
            f"Endpoint {method} {path} failed access boundary gate! Returned status {res.status_code} instead of 401."
        )

def test_cors_does_not_bypass_authentication(monkeypatch):
    """
    Verifies that a valid or spoofed Origin header alone cannot bypass the access boundary.
    CORS restricts browser cross-origin reads, but the backend must enforce auth independently.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    res = client.get(
        "/api/experiments",
        headers={"Origin": "http://localhost:5173"}
    )
    assert res.status_code == 401, "CORS origin must not grant access to unauthenticated requests"

def test_operator_session_lifecycle(monkeypatch):
    """
    Verifies the complete operator session flow:
    - Rejects invalid key
    - Issues HttpOnly signed cookie on valid login
    - Authenticates protected endpoints via session cookie
    - Allows clean logout by clearing cookie
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    # 1. Invalid key rejected
    r_bad = client.post("/api/auth/login", json={"key": "wrong_key"})
    assert r_bad.status_code == 401

    # 2. Valid key login sets HttpOnly cookie
    r_login = client.post("/api/auth/login", json={"key": test_key})
    assert r_login.status_code == 200
    assert r_login.json()["authenticated"] is True
    assert "empire_session" in r_login.cookies

    # 3. Access protected route using session cookie
    r_protected = client.get(
        "/api/experiments",
        cookies={"empire_session": r_login.cookies["empire_session"]}
    )
    assert r_protected.status_code == 200

    # 4. Check auth status endpoint
    r_status = client.get(
        "/api/auth/status",
        cookies={"empire_session": r_login.cookies["empire_session"]}
    )
    assert r_status.status_code == 200
    assert r_status.json()["auth_required"] is True
    assert r_status.json()["authenticated"] is True

    # 5. Logout clears session
    r_logout = client.post("/api/auth/logout")
    assert r_logout.status_code == 200
    assert r_logout.json()["authenticated"] is False

def test_csrf_defense_on_mutating_session(monkeypatch):
    """
    Verifies defense-in-depth CSRF mitigation: cookie-authenticated mutating requests
    require custom headers or matching origins.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    # Login to obtain valid cookie
    r_login = client.post("/api/auth/login", json={"key": test_key})
    cookie = r_login.cookies["empire_session"]

    # Cookie mutation with foreign origin and no custom headers -> rejected with 403
    r_attack = client.post(
        "/api/system/backup",
        cookies={"empire_session": cookie},
        headers={"Origin": "https://evil-attacker.example.com", "Content-Type": "text/plain"}
    )
    assert r_attack.status_code == 403
    assert "CSRF" in r_attack.json()["detail"]

    # Cookie mutation with standard app custom header -> allowed
    r_legit = client.post(
        "/api/system/backup",
        cookies={"empire_session": cookie},
        headers={"X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json"}
    )
    assert r_legit.status_code == 200

def test_logout_revokes_token_and_prevents_replay(monkeypatch):
    """
    Verifies that logging out actively revokes the session token server-side,
    preventing an attacker with a stolen cookie from continuing to use it.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    # 1. Login to obtain session cookie
    r_login = client.post("/api/auth/login", json={"key": test_key})
    token = r_login.cookies["empire_session"]

    # 2. Confirm cookie works
    r_before = client.get("/api/experiments", cookies={"empire_session": token})
    assert r_before.status_code == 200

    # 3. Explicitly logout
    r_logout = client.post("/api/auth/logout", cookies={"empire_session": token})
    assert r_logout.status_code == 200

    # 4. Attempt to replay the old session token -> MUST return 401
    r_after = client.get("/api/experiments", cookies={"empire_session": token})
    assert r_after.status_code == 401, "Revoked session token must not be permitted access"

def test_login_brute_force_rate_limiting(monkeypatch):
    """
    Verifies that excessive failed login attempts trigger HTTP 429 lockout.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    from backend.app.auth import reset_login_failures
    reset_login_failures("testclient")

    # Send 5 invalid login attempts
    for _ in range(5):
        r = client.post("/api/auth/login", json={"key": "wrong_key"})
        assert r.status_code == 401

    # 6th attempt should be blocked by rate limiter
    r_blocked = client.post("/api/auth/login", json={"key": "wrong_key"})
    assert r_blocked.status_code == 429
    assert "Rate limit exceeded" in r_blocked.json()["detail"] or "Too many" in r_blocked.json()["detail"]

    # Clean up for subsequent tests
    reset_login_failures("testclient")

def test_tampered_and_expired_session_tokens(monkeypatch):
    """
    Verifies that malformed, expired, tampered, or skewed session tokens are rejected.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    # 1. Malformed token (missing segments)
    r1 = client.get("/api/experiments", cookies={"empire_session": "not_a_real_token"})
    assert r1.status_code == 401

    # 2. Non-integer timestamp
    r2 = client.get("/api/experiments", cookies={"empire_session": "invalid_ts:nonce:sig"})
    assert r2.status_code == 401

    # 3. Expired timestamp (>24h ago)
    expired_ts = str(int(time.time() if 'time' in globals() else 1000) - 90000)
    r3 = client.get("/api/experiments", cookies={"empire_session": f"{expired_ts}:testnonce:fakesig"})
    assert r3.status_code == 401

    # 4. Future timestamp (>5m ahead)
    import time
    future_ts = str(int(time.time()) + 10000)
    r4 = client.get("/api/experiments", cookies={"empire_session": f"{future_ts}:testnonce:fakesig"})
    assert r4.status_code == 401

    # 5. Tampered signature
    r_login = client.post("/api/auth/login", json={"key": test_key})
    valid_token = r_login.cookies["empire_session"]
    parts = valid_token.split(":")
    tampered_sig = parts[0] + ":" + parts[1] + ":0000000000000000000000000000000000000000000000000000000000000000"
    r5 = client.get("/api/experiments", cookies={"empire_session": tampered_sig})
    assert r5.status_code == 401

def test_production_secrets_strict_validation(monkeypatch):
    """
    Verifies that missing, short (<16 chars), or template placeholder secrets fail fast in production.
    """
    from backend.app.security import validate_production_key_configuration

    monkeypatch.setenv("ENVIRONMENT", "production")

    # 1. Missing VAULT_MASTER_KEY
    monkeypatch.delenv("VAULT_MASTER_KEY", raising=False)
    monkeypatch.delenv("EMPIRE_SECRET_KEY", raising=False)
    monkeypatch.setenv("EMPIRE_API_KEY", "strong_operator_key_99999")
    with pytest.raises(RuntimeError) as exc:
        validate_production_key_configuration()
    assert "VAULT_MASTER_KEY" in str(exc.value)

    # 2. Template placeholder VAULT_MASTER_KEY
    monkeypatch.setenv("VAULT_MASTER_KEY", "REPLACE_WITH_STRONG_PRODUCTION_FERNET_KEY")
    with pytest.raises(RuntimeError) as exc:
        validate_production_key_configuration()
    assert "insecure template placeholder" in str(exc.value)

    # 3. Short VAULT_MASTER_KEY
    monkeypatch.setenv("VAULT_MASTER_KEY", "short_key")
    with pytest.raises(RuntimeError) as exc:
        validate_production_key_configuration()
    assert "shorter than 16" in str(exc.value)

    # 4. Valid VAULT_MASTER_KEY, but missing EMPIRE_API_KEY
    monkeypatch.setenv("VAULT_MASTER_KEY", "production_master_vault_key_32bytes_alpha")
    monkeypatch.delenv("EMPIRE_API_KEY", raising=False)
    with pytest.raises(RuntimeError) as exc:
        validate_production_key_configuration()
    assert "EMPIRE_API_KEY" in str(exc.value)

    # 5. Placeholder EMPIRE_API_KEY
    monkeypatch.setenv("EMPIRE_API_KEY", "REPLACE_WITH_KEY_PLACEHOLDER")
    with pytest.raises(RuntimeError) as exc:
        validate_production_key_configuration()
    assert "insecure template placeholder" in str(exc.value)

    # 6. Both set with strong >=16 char keys -> passes
    monkeypatch.setenv("EMPIRE_API_KEY", "prod_operator_access_key_64_characters_safe_1234")
    validate_production_key_configuration()  # Should not raise

def test_global_session_invalidation_on_key_rotation(monkeypatch):
    """
    Verifies that rotating master keys invalidates all prior operator sessions.
    """
    test_key = "gatekeeper_secret_key_888"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    from backend.app.auth import revoke_all_sessions

    # Login and obtain token
    r_login = client.post("/api/auth/login", json={"key": test_key})
    token = r_login.cookies["empire_session"]
    assert client.get("/api/experiments", cookies={"empire_session": token}).status_code == 200

    # Invalidate all prior sessions (simulates key rotation)
    import time
    time.sleep(0.01)  # small delay so timestamp progresses
    revoke_all_sessions()

    # Old token must now be rejected
    r_recheck = client.get("/api/experiments", cookies={"empire_session": token})
    assert r_recheck.status_code == 401
