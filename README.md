# Empire Arena 🏰⚔️
> **The Kingdom of Proof** — An AI evaluation and systematic model experimentation platform presented through an immersive ancient-empire aesthetic.

---

## 🏛️ What is Empire Arena?

Empire Arena is a full-stack AI evaluation platform that turns model benchmarking from passive metric charts into **repeatable, inspectable experimental evidence**.

Instead of guessing whether an LLM behaves reliably, Empire Arena allows teams to:
1. **Design Controlled Experiments** in **The Lab** with input prompts, ground-truth expected outputs, and deterministic evaluation methods.
2. **Execute Trials & Compare Models** in **The Arena** side-by-side using identical test cases, calculating true pass rates from actual passed counts over evaluated cases.
3. **Preserve Evaluation Evidence** in **The Archives**, persisting experiment history, run results, and failure logs in SQLite.
4. **Diagnose Systematic Failures** in **The Oracle**, turning raw assertion errors into diagnostic hypotheses and follow-up experiment recommendations.

---

## 🏰 The Four Realms & The Empire

| Realm | Route | Purpose |
|---|---|---|
| **The Empire** | `/` | Cinematic landing page explaining the evaluation workflow, core principles, and realm portals. |
| **The Lab** | `/lab` | Experiment creation workspace: configure threshold, evaluation criteria, and author test cases. Saves directly to SQLite. |
| **The Arena** | `/arena` | Side-by-side model comparison engine: executes live runs against contenders, calculates real pass rates, and displays failure diffs. |
| **The Archives** | `/archives` | Searchable history of all saved experiments and previous evaluation runs with status filtering. |
| **The Oracle** | `/oracle` | Diagnostic analysis chamber: identifies recurring failure modes (instruction drift, reasoning errors, schema formatting) based on stored empirical failures. |

---

## ⚙️ Architecture & Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Routing**: `react-router-dom` v7 with active route indicators and mobile drawer
- **Icons**: `lucide-react`
- **Styling**: Tailored design token system adhering to the prototype palette (`#0B0B0D` obsidian background, `#151416` panels, `#D7B46A` antique gold, `#9AC59B` success green, `#D98D82` failure crimson)

### Backend
- **Framework**: Python 3.11 + FastAPI
- **Validation**: Pydantic v2 schemas (`ConfigDict(from_attributes=True)`)
- **Database**: SQLite (`empire_arena.db`) with foreign-key constraints and automated initial seeder
- **Evaluation Engine**: Deterministic evaluators:
  - Exact match (`expected.strip() == actual.strip()`)
  - Normalized match (whitespace & case-insensitive)
  - Required substring verification
  - JSON & structured schema validation (verifying key/value equivalence and parsing stripped markdown fences)
- **Model Adapter**: Built-in deterministic model adapter with documented simulation profiles:
  - `Nova-7B (Imperial Fast)`: High throughput; exhibits instruction drift on negative constraints (e.g. prepends polite phrasing)
  - `Meridian-13B (Balanced)`: Robust generalist; handles strict schemas
  - `Aegis-70B (Deep Reasoning)`: Flawless factual and numeric ground truth
- **Testing**: Automated `pytest` suite testing all endpoints, evaluators, and database persistence.

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- **Node.js** (v18+ or v20+) and **npm**
- **Python** (v3.10+ or v3.11+) and `uv` (or `pip`)

---

### Step 1: Backend Setup & Execution

Open a terminal in the project directory:

```powershell
# 1. Create a Python virtual environment
uv venv .venv

# 2. Install backend dependencies
uv pip install --python .venv\Scripts\python.exe -r backend/requirements.txt

# 3. Run the automated backend test suite
$env:PYTHONPATH="."
.venv\Scripts\pytest backend\tests

# 4. Start the FastAPI backend server (listens on http://localhost:8000)
.venv\Scripts\uvicorn backend.app.main:app --port 8000 --reload
```

---

### Step 2: Frontend Setup & Execution

Open a second terminal in the project directory:

```powershell
# 1. Install frontend dependencies
npm install

# 2. Build and verify TypeScript types
npm run build

# 3. Start the Vite development server (listens on http://localhost:5174 or 5173)
npm run dev
```

Open your browser to:
👉 **`http://localhost:5174/`** (or the port reported by Vite)

---

## 🧪 How to Create and Execute a Test Experiment

1. **Navigate to The Lab (`/lab`)**:
   - Provide an experiment name (e.g., *“Single-Word Constraint Trial”*).
   - Choose a category (e.g., *Instruction following* or *Reasoning*).
   - Select evaluation criteria (e.g., *Exact match*).
   - Enter input prompt: `Is 97 a prime number? Answer with YES or NO only.`
   - Enter expected output: `YES`.
   - Click **“Save Experiment to SQLite”**.
2. **Execute Trial in The Arena (`/arena`)**:
   - Click **“Execute Trial in Arena”** (or navigate to `/arena` and choose your experiment).
   - Click **“Run Model A”** (Nova-7B) to observe its live execution. Nova will produce `The answer is YES.`, triggering an inspectable `FAIL` with the exact diff displayed in the table.
   - Click **“Run Model B”** (Aegis-70B). Aegis will produce `YES`, demonstrating a `100% PASS` rate.
3. **Inspect The Archives (`/archives`)**:
   - Search by name, filter by status (*Complete*, *Needs review*, *Draft*), or inspect run records.
4. **Consult The Oracle (`/oracle`)**:
   - Select *Misses exact negative constraints (Instruction drift)*.
   - Click **“Analyze Pattern ✧”** to review the diagnostic hypothesis and the empirical failure counts drawn directly from the SQLite test results.

---

## 🔌 Integrating Real LLM Model Providers (Future Roadmap)

The `ModelAdapter` class in `backend/app/evaluator.py` is intentionally modular. To integrate a live provider like Anthropic, OpenAI, or a local Ollama instance:

```python
# In backend/app/evaluator.py:
import os
import httpx

class RealModelAdapter:
    @staticmethod
    async def generate_ollama(model_name: str, prompt: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post("http://localhost:11434/api/generate", json={
                "model": model_name,
                "prompt": prompt,
                "stream": False
            })
            return resp.json()["response"].strip()
```

---

## 🛡️ Verification & Test Results

- **Backend Pytest**: `6 passed, 0 failed` (`test_health`, `test_evaluator_exact_match`, `test_evaluator_json_match`, `test_list_experiments`, `test_create_and_run_experiment`, `test_oracle_consult`).
- **Frontend Vite Build**: `tsc -b && vite build` succeeded with `0 errors`.
- **Live Servers**:
  - FastAPI running on `http://127.0.0.1:8000/api`
  - React/Vite running on `http://localhost:5174/`
