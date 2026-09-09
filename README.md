# ⬡ NextSpec
**AI-Powered 3D PC Diagnostic & Upgrade Visualizer**
### CSC 490 Senior Capstone
* **Levi Duquette:** Backend Architecture, WMI Diagnostics, AI Logic
* **Allen Orozco:** React Frontend, 3D WebGL UI
* **Paolo Ordinario:** PostgreSQL Database, External API Integration

### Project Structure
* `/backend` - FastAPI Python server and diagnostic scripts.
* `/frontend` - React / React Three Fiber client.
* `/database` - SQL schemas for Neon PostgreSQL.
* `/docs` - System diagrams and UI prototypes.

### Current Status: Sprint 1 (Environment Setup)
* Repository scaffolded and team access granted.
* UI Digital Prototype completed.
* WMI diagnostic proof-of-concept in development.

## 🛠️ Local Development Setup

Currently, NextSpec is in the Milestone 1 development phase. To run the backend diagnostic API locally, follow these steps:

### 1. Start the Backend (FastAPI)
You must navigate into the `backend` folder before starting the Uvicorn server, or the application will fail to import the scanner modules.

```bash
# Clone the repository
git clone [https://github.com/YOUR-ORG/nextspec.git](https://github.com/YOUR-ORG/nextspec.git)

# Navigate into the backend directory
cd nextspec/backend

# Install dependencies
pip install fastapi uvicorn pydantic wmi

# Run the local server
python -m uvicorn main:app --reload