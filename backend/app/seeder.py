import sqlite3
import uuid
from typing import List, Dict, Any
from .database import get_db_connection

SEED_EXPERIMENTS = [
    {
        "id": "exp-reasoning-01",
        "name": "Reasoning & Multi-Step Logic",
        "description": "Evaluates arithmetic problem solving, step-by-step logic, and question deduplication under tight output guidelines.",
        "category": "Reasoning",
        "target_model": "Nova-7B",
        "evaluation_criteria": "Exact match",
        "pass_threshold": 80.0,
        "status": "Complete",
        "test_cases": [
            {
                "id": "tc-r-01",
                "name": "Prime Number Logic",
                "input_prompt": "Is 97 a prime number? Answer with YES or NO only.",
                "expected_output": "YES",
                "evaluation_method": "Exact match"
            },
            {
                "id": "tc-r-02",
                "name": "Multi-step Subtraction",
                "input_prompt": "Subtract 37 from 100, then divide the result by 9. Respond with the number only.",
                "expected_output": "7",
                "evaluation_method": "Exact match"
            },
            {
                "id": "tc-r-03",
                "name": "Coin Counting Logic",
                "input_prompt": "You have 3 quarters, 2 dimes, and 1 nickel. How many total cents do you have? Output the integer.",
                "expected_output": "100",
                "evaluation_method": "Exact match"
            }
        ]
    },
    {
        "id": "exp-format-02",
        "name": "Strict Output Format Check",
        "description": "Tests adherence to exact JSON schemas without unrequested markdown explanations, conversational wrappers, or preamble.",
        "category": "Instruction following",
        "target_model": "Meridian-13B",
        "evaluation_criteria": "JSON format",
        "pass_threshold": 90.0,
        "status": "Complete",
        "test_cases": [
            {
                "id": "tc-f-01",
                "name": "Key-Value Extraction",
                "input_prompt": "Extract the person name and age from 'Marcus is 34 years old' into valid JSON with keys 'name' and 'age'.",
                "expected_output": '{"name": "Marcus", "age": 34}',
                "evaluation_method": "JSON format"
            },
            {
                "id": "tc-f-02",
                "name": "Status Enum Verification",
                "input_prompt": "Return a JSON object with key 'status' set to 'APPROVED'. Do not include extra commentary.",
                "expected_output": '{"status": "APPROVED"}',
                "evaluation_method": "JSON format"
            }
        ]
    },
    {
        "id": "exp-robustness-03",
        "name": "Ambiguous Prompt Robustness",
        "description": "Checks how models respond when user constraints are minimal or edge-case boundary conditions are untested.",
        "category": "Robustness",
        "target_model": "Aegis-70B",
        "evaluation_criteria": "Normalized match",
        "pass_threshold": 75.0,
        "status": "Needs review",
        "test_cases": [
            {
                "id": "tc-rob-01",
                "name": "Missing Parameter Fallback",
                "input_prompt": "Provide the boiling point of pure water at standard sea-level atmospheric pressure in Celsius. Number only.",
                "expected_output": "100",
                "evaluation_method": "Exact match"
            }
        ]
    }
]

def seed_database_if_empty():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM experiments")
    count = cursor.fetchone()[0]
    
    if count == 0:
        for exp in SEED_EXPERIMENTS:
            cursor.execute(
                """
                INSERT OR IGNORE INTO experiments (id, name, description, category, target_model, evaluation_criteria, pass_threshold, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    exp["id"],
                    exp["name"],
                    exp["description"],
                    exp["category"],
                    exp["target_model"],
                    exp["evaluation_criteria"],
                    exp["pass_threshold"],
                    exp["status"]
                )
            )
            for tc in exp["test_cases"]:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO test_cases (id, experiment_id, name, input_prompt, expected_output, evaluation_method)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        tc["id"],
                        exp["id"],
                        tc["name"],
                        tc["input_prompt"],
                        tc["expected_output"],
                        tc["evaluation_method"]
                    )
                )

        # Seed initial evaluation runs for Arena and Archives comparison
        run_id_1 = "run-nova-reasoning"
        cursor.execute(
            """
            INSERT OR IGNORE INTO evaluation_runs (id, experiment_id, model_id, model_name, total_tests, passed_tests, pass_rate, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id_1, "exp-reasoning-01", "nova-7b", "Nova-7B (Imperial Fast)", 3, 2, 66.7, "Completed", "Automated baseline execution")
        )

        cursor.execute(
            """
            INSERT OR IGNORE INTO test_results (id, run_id, test_case_id, model_id, input_prompt, expected_output, actual_output, passed, evaluation_method, error_details)
            VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "res-1", run_id_1, "tc-r-01", "nova-7b", 
                "Is 97 a prime number? Answer with YES or NO only.", "YES", "The answer is YES.", False, "Exact match", "Expected exact string 'YES', but received 'The answer is YES.'",
                "res-2", run_id_1, "tc-r-02", "nova-7b",
                "Subtract 37 from 100, then divide the result by 9. Respond with the number only.", "7", "7", True, "Exact match", None,
                "res-3", run_id_1, "tc-r-03", "nova-7b",
                "You have 3 quarters, 2 dimes, and 1 nickel. How many total cents do you have? Output the integer.", "100", "100", True, "Exact match", None
            )
        )

        run_id_2 = "run-aegis-reasoning"
        cursor.execute(
            """
            INSERT OR IGNORE INTO evaluation_runs (id, experiment_id, model_id, model_name, total_tests, passed_tests, pass_rate, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id_2, "exp-reasoning-01", "aegis-70b", "Aegis-70B (Deep Reasoning)", 3, 3, 100.0, "Completed", "Benchmark run against reasoning suite")
        )
        cursor.execute(
            """
            INSERT OR IGNORE INTO test_results (id, run_id, test_case_id, model_id, input_prompt, expected_output, actual_output, passed, evaluation_method, error_details)
            VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "res-4", run_id_2, "tc-r-01", "aegis-70b", 
                "Is 97 a prime number? Answer with YES or NO only.", "YES", "YES", True, "Exact match", None,
                "res-5", run_id_2, "tc-r-02", "aegis-70b",
                "Subtract 37 from 100, then divide the result by 9. Respond with the number only.", "7", "7", True, "Exact match", None,
                "res-6", run_id_2, "tc-r-03", "aegis-70b",
                "You have 3 quarters, 2 dimes, and 1 nickel. How many total cents do you have? Output the integer.", "100", "100", True, "Exact match", None
            )
        )

        conn.commit()
    conn.close()
