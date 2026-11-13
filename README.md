# ⬡ NextSpec
**AI-Powered 3D PC Diagnostic & Upgrade Visualizer**

### CSC 490 Senior Capstone — UNCG
* **Levi Duquette:** Backend Architecture, WMI Diagnostics, Local AI Integration
* **Allen Orozco:** React Frontend, Interactive 3D WebGL UI
* **Paolo Ordinario:** Neon PostgreSQL Database, External API & Pricing Integration

---

## Core Features

* **Automated Hardware Telemetry & Scoring:** Scans local Windows hardware via WMI (`CPU`, `GPU`, `RAM`, `Storage`) and computes a normalized `0–100` performance score with bottleneck detection.
* **Interactive 3D System Visualizer:** Renders an interactive Three.js / React Three Fiber PC layout directly on the dashboard and 3D Builder views.
* **Constraint-Aware Upgrade Recommendations:** Queries real PassMark benchmark tables and pricing in Neon PostgreSQL, dynamically filtering socket-compatible upgrades by **Budget**, **Primary Purpose**, **Target FPS**, and **Resolution**.
* **Interactive Price & Value Sandbox:** Lets users test CPU and GPU swaps in real time to compare **Current Build Value**, **New Build Value**, **New Parts Cost**, and recalculated **`0–100` performance gains**, with one-click local build saving.
* **Local Ollama AI Advisor & Game Optimizer:** Runs local LLM inference via **Ollama (`llama3.2:3b`)** with response caching and deterministic fallback logic—providing tailored upgrade advice and Steam game requirement tuning with zero cloud AI API costs.

---

## Project Structure

* `/backend` — FastAPI Python server, WMI diagnostic scanner, Neon DB queries, and Ollama integration.
* `/frontend` — React + Vite + React Three Fiber (R3F) client UI.
* `/database` — SQL schemas and PassMark benchmark tables for Neon PostgreSQL.
* `/docs` — System architecture diagrams and UI prototypes.
* `start.bat` — One-click Windows launcher that preloads Ollama, starts FastAPI on port `8080`, and launches Vite on port `5173`.

---

## Architecture (MVC)

* **View (Frontend):** React, Vite, and React Three Fiber (R3F) for interactive 3D hardware visualization, debounced constraint filtering, and live build-swap analytics.
* **Controller (API Gateway):** FastAPI coordinates local WMI hardware scanning, SQL benchmark filtering, Steam requirement scraping, local JSON build persistence, and Ollama prompt generation.
* **Model (Data Layer):** Neon PostgreSQL (CPU/GPU PassMark benchmarks and market pricing) paired with local Ollama (`llama3.2:3b`) inference and live Steam/vendor data.

---

## Local Development Setup

### 1. Install & Pull the Local AI Model (Ollama)

NextSpec uses **Ollama** running locally so no external AI API keys are required.

```bash
# Windows (PowerShell / CMD)
winget install -e --id Ollama.Ollama

# macOS
brew install ollama

# Pull the model used by the backend advisor (~2 GB)
ollama pull llama3.2:3b
```

### 2. Quick Start (Windows)

From the repository root, run `start.bat` (or run as Administrator for full WMI hardware telemetry) to start Ollama, the FastAPI backend (`:8080`), and the React frontend (`:5173`) automatically.

### 3. Manual Setup (Backend & Frontend)

#### Start the Backend (FastAPI)
Navigate into the `backend` directory before starting Uvicorn so the local scanner modules import properly:

```bash
# Clone the repository
git clone [https://github.com/YOUR-ORG/nextspec.git](https://github.com/YOUR-ORG/nextspec.git)
cd nextspec/backend

# Install Python dependencies
python -m pip install -r requirements.txt
```

Create a `.env` file inside `/backend` with your Neon PostgreSQL connection string:

```env
DATABASE_URL=your_neon_postgresql_connection_string
# Optional live pricing credentials (falls back to Neon DB list prices if omitted)
EBAY_CLIENT_ID=your_ebay_id
EBAY_CLIENT_SECRET=your_ebay_secret
```

Run the FastAPI server on port `8080`:

```bash
python -m uvicorn main:app --reload --port 8080
```

Interactive Swagger API documentation is available at `http://localhost:8080/docs`.

#### Start the Frontend (React + Vite)
In a second terminal:

```bash
cd nextspec/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser to launch the application.

---

## Future Roadmap (Phase 2)

* **Full-System Compatibility Engine:** Expand WMI telemetry and Neon PostgreSQL schemas to evaluate motherboard chipsets/DIMM slots, DDR4 vs. DDR5 memory kits, and PSU wattage headroom.
* **From-Scratch PC Builder:** Add a ground-up build mode with cascading compatibility filters alongside existing-rig upgrade diagnostics.