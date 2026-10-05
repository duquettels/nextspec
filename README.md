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

### Architecture (MVC)
* **View (Frontend):** React & React Three Fiber (R3F) for interactive 3D rendering and dashboard UI.
* **Controller (API Gateway):** FastAPI coordinates the local WMI hardware scan, web scraping, and AI prompt injection.
* **Model (Data Layer):** Neon PostgreSQL (integration in progress) and live web APIs (Steam, Gemini, eBay).

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
python -m pip install -r requirements.txt

# Environment Variables:
# Create a .env file in the backend root and add your API keys:
GEMINI_API_KEY=your_google_key
EBAY_CLIENT_ID=your_ebay_id
EBAY_CLIENT_SECRET=your_ebay_secret
DATABASE_URL=your_neon_db_string

# Run the local server
python -m uvicorn main:app --reload
```

### 2. View the API Documentation

Once the server is running, open your web browser and navigate to:

```bash
http://localhost:8000/docs
```

This will load the interactive Swagger UI where you can view the exact JSON payload structure and test the /api/scan endpoint.

### 3. Start the Frontend Model

Once the backend server is running, we can run the frontend.

```bash
npm install
```

After that is installed, we can then:
```bash
npm run dev
```

Once that is complete, you can then hit CTRL + click on the localhost url!
