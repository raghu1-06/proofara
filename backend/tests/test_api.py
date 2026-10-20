import pytest
import os
from fastapi.testclient import TestClient

# Ensure test uses a separate or clean test database
os.environ["DATABASE_PATH"] = "test_empire_arena.db"

from backend.app.main import app
from backend.app.database import init_db
from backend.app.seeder import seed_database_if_empty
from backend.app.evaluator import EvaluationEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    seed_database_if_empty()
    yield
    if os.path.exists("test_empire_arena.db"):
        try:
            os.remove("test_empire_arena.db")
        except:
            pass

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_evaluator_exact_match():
    passed, error = EvaluationEngine.evaluate("Exact match", "YES", "YES")
    assert passed is True
    assert error is None

    passed_fail, error_fail = EvaluationEngine.evaluate("Exact match", "YES", "The answer is YES.")
    assert passed_fail is False
    assert "Expected exact string" in error_fail

def test_evaluator_json_match():
    passed, error = EvaluationEngine.evaluate("JSON format", '{"a": 1}', '```json\n{"a": 1}\n```')
    assert passed is True
    assert error is None

def test_list_experiments():
    response = client.get("/api/experiments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3

def test_create_and_run_experiment():
    # 1. Create experiment
    payload = {
        "name": "Safety Guardrail Probe",
        "description": "Verifies that the model adheres to policy bounds",
        "category": "Safety checks",
        "target_model": "Nova-7B",
        "evaluation_criteria": "Exact match",
        "pass_threshold": 100.0,
        "test_cases": [
            {
                "name": "Single Word Policy",
                "input_prompt": "Answer with the single word NO only.",
                "expected_output": "NO",
                "evaluation_method": "Exact match"
            }
        ]
    }
    create_res = client.post("/api/experiments", json=payload)
    assert create_res.status_code == 200
    exp = create_res.json()
    exp_id = exp["id"]
    assert exp["name"] == "Safety Guardrail Probe"
    assert len(exp["test_cases"]) == 1

    # 2. Run experiment
    run_res = client.post(f"/api/experiments/{exp_id}/run", json={"model_id": "aegis-70b"})
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["total_tests"] == 1
    assert run_data["passed_tests"] == 1
    assert run_data["pass_rate"] == 100.0
    assert len(run_data["results"]) == 1
    assert run_data["results"][0]["passed"] is True

def test_oracle_consult():
    res = client.post(
        "/api/oracle/consult",
        json={
            "topic": "Why does Nova fail single-word checks?",
            "model_id": "Nova-7B",
            "pattern": "instructions",
            "evidence_notes": "Added polite text before answer"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "Instruction" in data["title"]
    assert len(data["analysis"]) > 10

def test_providers_endpoints():
    # 1. Get providers
    get_res = client.get("/api/providers")
    assert get_res.status_code == 200
    providers = get_res.json()
    assert len(providers) >= 5
    openai_p = next(p for p in providers if p["id"] == "openai")
    assert openai_p["provider_type"] == "openai"

    # 2. Update provider settings with sensitive key
    update_res = client.post(
        "/api/providers/openai",
        json={
            "api_key": "sk-test1234567890abcdef",
            "is_enabled": True,
            "models": ["gpt-4o-mini", "gpt-4o"]
        }
    )
    assert update_res.status_code == 200
    up_data = update_res.json()
    assert up_data["is_enabled"] is True
    assert up_data["has_api_key"] is True
    assert "•" in up_data["api_key_masked"]
    # Ensure plaintext key is NEVER exposed in the JSON response
    assert "sk-test1234567890abcdef" not in str(up_data)

    # 3. Verify key is encrypted at rest in SQLite
    from backend.app.database import get_db_connection
    conn = get_db_connection()
    row = conn.cursor().execute("SELECT api_key FROM provider_settings WHERE id = 'openai'").fetchone()
    conn.close()
    assert row["api_key"].startswith("vault:")
    assert "sk-test1234567890abcdef" not in row["api_key"]

    # 4. Check models endpoint reflects enabled provider
    models_res = client.get("/api/models")
    assert models_res.status_code == 200
    all_models = models_res.json()
    model_ids = [m["id"] for m in all_models]
    assert "gpt-4o-mini" in model_ids
    assert "nova-7b" in model_ids

def test_immutable_run_snapshot():
    # 1. Create experiment with Case Alpha
    create_res = client.post("/api/experiments", json={
        "name": "Audit Snapshot Suite",
        "category": "Reasoning",
        "target_model": "aegis-70b",
        "test_cases": [
            {
                "name": "Case Alpha",
                "input_prompt": "Input Alpha",
                "expected_output": "Alpha",
                "evaluation_method": "Exact match"
            }
        ]
    })
    exp_id = create_res.json()["id"]

    # 2. Run the experiment
    run_res = client.post(f"/api/experiments/{exp_id}/run", json={"model_id": "aegis-70b"})
    run_data = run_res.json()
    assert run_data["snapshot_json"] is not None
    assert "Case Alpha" in run_data["snapshot_json"]
    assert run_data["is_simulation"] is True

    # 3. Mutate the experiment test cases to Case Beta
    client.put(f"/api/experiments/{exp_id}", json={
        "name": "Audit Snapshot Suite (Renamed)",
        "test_cases": [
            {
                "name": "Case Beta (Mutated)",
                "input_prompt": "Input Beta",
                "expected_output": "Beta",
                "evaluation_method": "Exact match"
            }
        ]
    })

    # 4. Query the historical run - verify snapshot still preserves Case Alpha
    runs_res = client.get(f"/api/runs?experiment_id={exp_id}")
    historical_runs = runs_res.json()
    assert len(historical_runs) == 1
    assert "Case Alpha" in historical_runs[0]["snapshot_json"]
    assert "Case Beta" not in historical_runs[0]["snapshot_json"]

def test_unconfigured_model_routing_rejection():
    # Testing an unconfigured model should fail transparently and NOT fall back to arbitrary providers
    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "nonexistent-frontier-model-999",
            "input_prompt": "Hello",
            "expected_output": "Hello",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is False
    assert "requires an active AI provider configuration" in data["actual_output"]

def test_single_test_execution():
    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "aegis-70b",
            "input_prompt": "Answer with only: VERIFIED",
            "expected_output": "VERIFIED",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is True
    assert data["actual_output"] == "VERIFIED"
    assert data["latency_ms"] >= 0

def test_generate_cases_endpoint():
    res = client.post(
        "/api/eval/generate-cases",
        json={
            "topic": "Financial Compliance Gateway",
            "category": "JSON format",
            "count": 2
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["test_cases"]) == 2
    assert "Strict JSON" in data["test_cases"][0]["name"]
    assert data["test_cases"][0]["evaluation_method"] == "JSON format"

def test_ai_oracle_synthesis():
    res = client.post(
        "/api/oracle/ai-synthesis",
        json={
            "pattern": "instructions",
            "notes": "Testing failure synthesis"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "Empirical" in data["title"] or "Oracle" in data["title"]
    assert len(data["root_causes"]) >= 2
    assert len(data["action_steps"]) >= 2

def test_experiment_input_validation():
    # 1. Reject experiment without test cases
    res1 = client.post("/api/experiments", json={
        "name": "Invalid Empty Suite",
        "category": "Reasoning",
        "target_model": "aegis-70b",
        "test_cases": []
    })
    assert res1.status_code == 400
    assert "at least one test case" in res1.json()["detail"]

    # 2. Reject test case with blank prompt
    res2 = client.post("/api/experiments", json={
        "name": "Invalid Blank Prompt Suite",
        "category": "Reasoning",
        "target_model": "aegis-70b",
        "test_cases": [
            {
                "name": "Blank Prompt",
                "input_prompt": "   ",
                "expected_output": "YES",
                "evaluation_method": "Exact match"
            }
        ]
    })
    assert res2.status_code == 400
    assert "empty input prompt" in res2.json()["detail"]

    # 3. Reject prompt exceeding max length
    res3 = client.post("/api/experiments", json={
        "name": "Oversized Prompt Suite",
        "category": "Reasoning",
        "target_model": "aegis-70b",
        "test_cases": [
            {
                "name": "Oversized",
                "input_prompt": "A" * 50001,
                "expected_output": "YES",
                "evaluation_method": "Exact match"
            }
        ]
    })
    assert res3.status_code == 400
    assert "exceeds" in res3.json()["detail"]

def test_execution_failure_status():
    # Create experiment
    create_res = client.post("/api/experiments", json={
        "name": "Unconfigured Contender Trial",
        "category": "Reasoning",
        "target_model": "unconfigured-model-xyz",
        "test_cases": [
            {
                "name": "Prompt 1",
                "input_prompt": "Is 1 prime?",
                "expected_output": "NO",
                "evaluation_method": "Exact match"
            }
        ]
    })
    exp_id = create_res.json()["id"]

    # Run with an unconfigured model
    run_res = client.post(f"/api/experiments/{exp_id}/run", json={"model_id": "unconfigured-model-xyz"})
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["status"] == "Failed"
    assert run_data["passed_tests"] == 0
    assert run_data["pass_rate"] == 0.0
    assert "requires an active AI provider configuration" in run_data["results"][0]["actual_output"]

def test_mocked_real_provider_execution(monkeypatch):
    import httpx

    # 1. Enable OpenAI provider in database
    client.post(
        "/api/providers/openai",
        json={
            "api_key": "sk-mock-valid-key-for-test",
            "is_enabled": True,
            "models": ["gpt-4o-mini"]
        }
    )

    # 2. Mock httpx.AsyncClient.post with realistic provider response
    async def mock_post(self, url, *args, **kwargs):
        class MockResponse:
            status_code = 200
            text = '{"choices": [{"message": {"content": "PARSED_TOKEN"}}], "usage": {"total_tokens": 42}}'
            def json(self):
                return {
                    "choices": [{"message": {"content": "PARSED_TOKEN"}}],
                    "usage": {"total_tokens": 42}
                }
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    # 3. Test single prompt execution against real provider route
    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "gpt-4o-mini",
            "input_prompt": "Produce token PARSED_TOKEN",
            "expected_output": "PARSED_TOKEN",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is True
    assert data["actual_output"] == "PARSED_TOKEN"
    assert data["tokens"] == 42
    assert data["is_simulation"] is False
    assert data["provider_type"] == "openai"

def test_mocked_provider_auth_failure_handling(monkeypatch):
    import httpx

    # Enable provider
    client.post(
        "/api/providers/openai",
        json={
            "api_key": "sk-invalid-key",
            "is_enabled": True,
            "models": ["gpt-4o-mini"]
        }
    )

    # Mock 401 Unauthorized response from provider
    async def mock_post_401(self, url, *args, **kwargs):
        class MockResponse:
            status_code = 401
            text = '{"error": {"message": "Incorrect API key provided"}}'
            def json(self):
                return {"error": {"message": "Incorrect API key provided"}}
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_401)

    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "gpt-4o-mini",
            "input_prompt": "Hello",
            "expected_output": "Hello",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is False
    assert "Authentication failed (401" in data["actual_output"]
    assert data["is_simulation"] is False

def test_mocked_provider_timeout_handling(monkeypatch):
    import httpx

    # Enable provider for this test
    client.post(
        "/api/providers/openai",
        json={
            "api_key": "sk-valid-timeout-test-key",
            "is_enabled": True,
            "models": ["gpt-4o-mini"]
        }
    )

    # Mock timeout exception from httpx
    async def mock_post_timeout(self, url, *args, **kwargs):
        raise httpx.TimeoutException("Operation timed out after 30s")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_timeout)

    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "gpt-4o-mini",
            "input_prompt": "Hello",
            "expected_output": "Hello",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is False
    assert "timed out" in data["actual_output"].lower()
    assert data["is_simulation"] is False

def test_mocked_provider_malformed_response_handling(monkeypatch):
    import httpx

    # Enable provider
    client.post(
        "/api/providers/openai",
        json={
            "api_key": "sk-test-malformed-key",
            "is_enabled": True,
            "models": ["gpt-4o-mini"]
        }
    )

    # Mock 200 OK with empty choices list
    async def mock_post_empty_choices(self, url, *args, **kwargs):
        class MockResponse:
            status_code = 200
            text = '{"choices": []}'
            def json(self):
                return {"choices": []}
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_empty_choices)

    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "gpt-4o-mini",
            "input_prompt": "Hello",
            "expected_output": "Hello",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is False
    assert "no choices" in data["actual_output"].lower() or "error" in data["actual_output"].lower()
    assert data["is_simulation"] is False

def test_missing_provider_credentials_rejection():
    # Attempt to execute an external model when its provider is disabled
    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "claude-3-5-sonnet",
            "input_prompt": "Hello",
            "expected_output": "Hello",
            "evaluation_method": "Exact match"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is False
    assert "requires an active AI provider" in data["actual_output"] or "not mapped" in data["actual_output"]
    assert data["is_simulation"] is False
    assert data["provider_type"] == "unconfigured"

def test_real_local_ollama_live_execution():
    """
    Genuine live provider test: if local Ollama daemon is running,
    exercises real live inference on qwen2.5:3b without any mocks.
    """
    import httpx

    try:
        r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=1.5)
        if r.status_code != 200:
            pytest.skip("Local Ollama server is not responding.")
        tags = r.json()
        models = [m.get("name") for m in tags.get("models", [])]
        if "qwen2.5:3b" not in models and not any("qwen" in m for m in models):
            pytest.skip("qwen2.5:3b model not installed in local Ollama.")
    except Exception:
        pytest.skip("Local Ollama daemon is offline.")

    # Configure Ollama provider in test database
    client.post(
        "/api/providers/ollama",
        json={
            "is_enabled": True,
            "base_url": "http://127.0.0.1:11434",
            "models": ["qwen2.5:3b"]
        }
    )

    res = client.post(
        "/api/eval/test-single",
        json={
            "model_id": "qwen2.5:3b",
            "input_prompt": "Output the single token CONFIRMED only.",
            "expected_output": "CONFIRMED",
            "evaluation_method": "Contains keyword"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_simulation"] is False
    assert data["provider_type"] == "ollama"
    assert data["latency_ms"] > 0
    assert data["tokens"] > 0
    assert "CONFIRMED" in data["actual_output"]
    assert data["passed"] is True

# ----------------- PHASE 6: PRODUCTION READINESS TESTS ----------------- #

def test_access_boundary_enforcement(monkeypatch):
    """Verifies that protected routes reject unauthorized requests when EMPIRE_API_KEY is active."""
    test_key = "empire_test_secret_key_999"
    monkeypatch.setenv("EMPIRE_API_KEY", test_key)

    # 1. Public routes should remain accessible without authentication
    r_health = client.get("/api/health")
    assert r_health.status_code == 200

    r_models = client.get("/api/models")
    assert r_models.status_code == 200

    # 2. Mutating / protected routes must reject unauthenticated requests
    r_unauth = client.get("/api/experiments")
    assert r_unauth.status_code == 401
    assert "Unauthorized" in r_unauth.json()["detail"]

    # 3. Request with incorrect key must be rejected
    r_wrong = client.get("/api/experiments", headers={"X-Empire-Key": "wrong_key"})
    assert r_wrong.status_code == 401

    # 4. Request with valid X-Empire-Key header must succeed
    r_auth_header = client.get("/api/experiments", headers={"X-Empire-Key": test_key})
    assert r_auth_header.status_code == 200

    # 5. Request with valid Bearer token must succeed
    r_auth_bearer = client.get("/api/experiments", headers={"Authorization": f"Bearer {test_key}"})
    assert r_auth_bearer.status_code == 200

def test_production_key_configuration_validation(monkeypatch):
    """Verifies fail-fast security: missing encryption key in production raises RuntimeError."""
    from backend.app.security import validate_production_key_configuration

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("VAULT_MASTER_KEY", raising=False)
    monkeypatch.delenv("EMPIRE_SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError) as exc_info:
        validate_production_key_configuration()
    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)

    # Providing valid keys satisfies production invariant
    monkeypatch.setenv("VAULT_MASTER_KEY", "prod-secure-master-key-xyz-777")
    monkeypatch.setenv("EMPIRE_API_KEY", "prod-access-boundary-key-999")
    validate_production_key_configuration()  # Should not raise

def test_key_rotation_flow():
    """Verifies atomic key rotation: re-encrypts stored secrets without data loss."""
    import sqlite3
    from backend.app.security import encrypt_secret, decrypt_secret, rotate_vault_keys, derive_fernet_key

    test_db = "test_key_rotation.db"
    if os.path.exists(test_db):
        os.remove(test_db)

    conn = sqlite3.connect(test_db)
    conn.execute("CREATE TABLE provider_settings (id TEXT PRIMARY KEY, api_key TEXT);")
    
    old_key = "old-master-passphrase-alpha"
    new_key = "new-master-passphrase-beta"
    
    secret_val = "sk-ant-test-credential-sample-secret"
    encrypted_val = encrypt_secret(secret_val, custom_key=derive_fernet_key(old_key))
    conn.execute("INSERT INTO provider_settings VALUES ('anthropic', ?)", (encrypted_val,))
    conn.commit()
    conn.close()

    # Rotate keys
    rotated = rotate_vault_keys(test_db, old_key, new_key)
    assert rotated == 1

    # Verify secret is decryptable with new key and NOT decryptable with old key
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT api_key FROM provider_settings WHERE id = 'anthropic'").fetchone()
    conn.close()
    
    re_encrypted = row[0]
    decrypted_with_new = decrypt_secret(re_encrypted, custom_key=derive_fernet_key(new_key))
    assert decrypted_with_new == secret_val

    decrypted_with_old = decrypt_secret(re_encrypted, custom_key=derive_fernet_key(old_key))
    assert decrypted_with_old == ""

    # Verify invalid old key raises ValueError and leaves data uncorrupted
    with pytest.raises(ValueError) as exc_info:
        rotate_vault_keys(test_db, "wrong-old-key", "even-newer-key")
    assert "Invalid old key" in str(exc_info.value)

    # Confirm data still decrypts with current active key
    conn = sqlite3.connect(test_db)
    row_after_failed = conn.execute("SELECT api_key FROM provider_settings WHERE id = 'anthropic'").fetchone()
    conn.close()
    assert decrypt_secret(row_after_failed[0], custom_key=derive_fernet_key(new_key)) == secret_val

    if os.path.exists(test_db):
        os.remove(test_db)

def test_system_backup_and_restore_endpoints():
    """Verifies SQLite online backup creation and verified database restoration."""
    # 1. Trigger backup
    r_backup = client.post("/api/system/backup")
    assert r_backup.status_code == 200
    b_data = r_backup.json()
    assert b_data["is_valid"] is True
    assert b_data["size_bytes"] > 0
    filename = b_data["filename"]

    # 2. List backups
    r_list = client.get("/api/system/backups")
    assert r_list.status_code == 200
    list_data = r_list.json()
    assert list_data["total_count"] >= 1
    assert any(b["filename"] == filename for b in list_data["backups"])

    # 3. Restore backup
    r_restore = client.post("/api/system/restore", json={"backup_filename": filename})
    assert r_restore.status_code == 200
    rest_data = r_restore.json()
    assert rest_data["success"] is True
    assert rest_data["stats"]["integrity"] == "ok"
    assert "experiments" in rest_data["stats"]

def test_model_identity_tiers():
    """Verifies that models are categorized into proper execution tiers (simulation, local, cloud)."""
    # Configure an Ollama and OpenAI provider
    client.post(
        "/api/providers/ollama",
        json={"is_enabled": True, "models": ["qwen2.5:3b"]}
    )
    client.post(
        "/api/providers/openai",
        json={"is_enabled": True, "api_key": "sk-mock-key", "models": ["gpt-4o-mini"]}
    )

    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()

    # Simulator models
    sim_models = [m for m in models if m["execution_tier"] == "simulation"]
    assert len(sim_models) >= 3
    assert any(m["id"] == "nova-7b" for m in sim_models)

    # Local models
    local_models = [m for m in models if m["execution_tier"] == "local"]
    assert any("qwen" in m["id"] for m in local_models)

    # Cloud models
    cloud_models = [m for m in models if m["execution_tier"] == "cloud"]
    assert any("gpt-4o-mini" in m["id"] for m in cloud_models)

