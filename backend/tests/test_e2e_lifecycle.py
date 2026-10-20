import pytest
import os
import json
from fastapi.testclient import TestClient

os.environ["DATABASE_PATH"] = "test_lifecycle.db"

from backend.app.main import app
from backend.app.database import init_db
from backend.app.seeder import seed_database_if_empty

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_lifecycle_db():
    init_db()
    seed_database_if_empty()
    yield
    if os.path.exists("test_lifecycle.db"):
        try:
            os.remove("test_lifecycle.db")
        except:
            pass

def test_complete_platform_lifecycle():
    # ── 1. CREATE EXPERIMENT ──
    exp_payload = {
        "name": "E2E Citadel Evaluation Suite",
        "description": "Full lifecycle verification of the AI reliability workbench",
        "category": "Reasoning & logic",
        "target_model": "Meridian-13B",
        "evaluation_criteria": "Exact match",
        "pass_threshold": 80.0,
        "test_cases": [
            {
                "name": "Case 01 · Boolean logic",
                "input_prompt": "What is the boolean negation of True? Output FALSE only.",
                "expected_output": "FALSE",
                "evaluation_method": "Exact match"
            },
            {
                "name": "Case 02 · Arithmetic constraint",
                "input_prompt": "Calculate 15 + 27. Answer with the number only.",
                "expected_output": "42",
                "evaluation_method": "Exact match"
            }
        ]
    }
    create_res = client.post("/api/experiments", json=exp_payload)
    assert create_res.status_code == 200, create_res.text
    exp_data = create_res.json()
    exp_id = exp_data["id"]
    assert exp_data["name"] == "E2E Citadel Evaluation Suite"
    assert len(exp_data["test_cases"]) == 2

    # ── 2. EXECUTE RUN 1 ──
    run_res = client.post(
        f"/api/experiments/{exp_id}/run",
        json={"model_id": "Meridian-13B", "trigger_source": "E2E Test Step 2"}
    )
    assert run_res.status_code == 200, run_res.text
    run_data = run_res.json()
    assert run_data["experiment_id"] == exp_id
    assert run_data["total_tests"] == 2
    assert "snapshot_json" in run_data
    assert run_data["snapshot_json"] is not None

    snapshot_1 = json.loads(run_data["snapshot_json"])
    assert len(snapshot_1["test_cases"]) == 2
    assert snapshot_1["evaluation_criteria"] == "Exact match"

    # ── 3. UPDATE EXPERIMENT WITH A THIRD CASE ──
    update_payload = {
        "name": "E2E Citadel Evaluation Suite (V2)",
        "description": "Added third case to test immutability",
        "category": "Reasoning & logic",
        "target_model": "Nova-7B",
        "evaluation_criteria": "Contains keyword",
        "pass_threshold": 75.0,
        "test_cases": [
            {
                "name": "Case 01 · Boolean logic",
                "input_prompt": "What is the boolean negation of True? Output FALSE only.",
                "expected_output": "FALSE",
                "evaluation_method": "Exact match"
            },
            {
                "name": "Case 02 · Arithmetic constraint",
                "input_prompt": "Calculate 15 + 27. Answer with the number only.",
                "expected_output": "42",
                "evaluation_method": "Exact match"
            },
            {
                "name": "Case 03 · Keyword containment",
                "input_prompt": "Name the capital of the Roman Empire.",
                "expected_output": "Rome",
                "evaluation_method": "Contains keyword"
            }
        ]
    }
    update_res = client.put(f"/api/experiments/{exp_id}", json=update_payload)
    assert update_res.status_code == 200, update_res.text
    updated_exp = update_res.json()
    assert len(updated_exp["test_cases"]) == 3
    assert updated_exp["name"] == "E2E Citadel Evaluation Suite (V2)"

    # ── 4. VERIFY IMMUTABLE AUDIT TRAIL OF RUN 1 ──
    runs_res = client.get(f"/api/runs?experiment_id={exp_id}")
    assert runs_res.status_code == 200
    runs_list = runs_res.json()
    assert len(runs_list) >= 1
    historic_run = runs_list[0]

    # Verify that the past run's snapshot is STILL 2 cases and "Exact match", NOT 3 cases or "Contains keyword"
    assert historic_run["total_tests"] == 2
    frozen_snapshot = json.loads(historic_run["snapshot_json"])
    assert len(frozen_snapshot["test_cases"]) == 2
    assert frozen_snapshot["evaluation_criteria"] == "Exact match"

    # ── 5. COMPARE CONTENDERS IN ARENA ──
    # Run second model
    client.post(
        f"/api/experiments/{exp_id}/run",
        json={"model_id": "Nova-7B", "trigger_source": "Arena Contender Run"}
    )
    compare_res = client.get(f"/api/compare?experiment_id={exp_id}&model_a=Meridian-13B&model_b=Nova-7B")
    assert compare_res.status_code == 200, compare_res.text
    compare_data = compare_res.json()
    assert compare_data["experiment_id"] == exp_id
    assert compare_data["model_a"] is not None
    assert compare_data["model_b"] is not None
    assert len(compare_data["results_a"]) > 0
    assert len(compare_data["results_b"]) > 0

    # ── 6. CONSULT ORACLE DIAGNOSTICS ──
    oracle_res = client.post(
        "/api/oracle/consult",
        json={
            "topic": "Why did Nova-7B struggle with exact format matching?",
            "model_id": "Nova-7B",
            "pattern": "instructions",
            "evidence_notes": "Prepends conversational boilerplate to output."
        }
    )
    assert oracle_res.status_code == 200, oracle_res.text
    oracle_data = oracle_res.json()
    assert "title" in oracle_data
    assert "analysis" in oracle_data
    assert "recommendation" in oracle_data
    assert len(oracle_data["empirical_insights"]) >= 1

    # ── 7. ZERO LEAKAGE IN PROVIDER VAULT ──
    prov_res = client.get("/api/providers")
    assert prov_res.status_code == 200
    providers = prov_res.json()
    assert len(providers) >= 5
    for p in providers:
        if p["api_key_masked"]:
            assert "•" in p["api_key_masked"]
            assert not p["api_key_masked"].startswith("sk-real")
