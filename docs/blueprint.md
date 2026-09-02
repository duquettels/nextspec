# NextSpec: Phase 1
## System Architecture (Local Execution) END GOAL
* **The Backend:** Python FastAPI server handling WMI scripts, benchmark math, and database routing.
* **The Database:** Neon PostgreSQL hosting normalized component specs and synthetic benchmark scores.
* **The Frontend:** React dashboard fetching API data via `localhost:8000` to display diagnostic results.

## ⚙️ Levi: Backend & Math Engine
*   **Finalize the Hardware Scanner:** Ensure the WMI script reliably pulls the exact string names for the CPU, GPU, and RAM, formatting them into a clean JSON payload.
*   **Implement the Scoring Algorithm:** Write the Python Min-Max normalization function to convert raw database benchmark numbers into a 1-to-10 scale.
*   **Calibrate the Disparity Logic:** Write the script that subtracts the CPU score from the GPU score. Test this locally on your HP Omen 40L—since an i7 and RTX 4070 with 32 GB of RAM is a highly balanced rig, the algorithm must successfully output a green "System Balanced" flag rather than a false bottleneck.

## 🗄️ Paolo: Data Sourcing & Database
*   **Lock In the Datasets:** Make a final decision on which open-source GitHub PC part dataset to use for component names, and which Kaggle dataset (e.g., PassMark or 3DMark) to use for the synthetic benchmark scores.
*   **Build the Micro-Dataset:** Before writing a script to parse 60,000 rows, manually extract and merge just 20 popular CPUs and 20 popular GPUs (including their benchmark scores) into a single CSV file for immediate testing.
*   **Provision Neon PostgreSQL:** Execute the `CREATE TABLE` SQL command for the `hardware_components` schema, import the 20-item CSV, and provide the team with the secure connection string.

## 🎨 Allen: Frontend Dashboard
*   **Convert the HTML Prototype:** Translate the existing prototype HTML layout into a modular React application, setting up the basic routing and component structure (e.g., `Dashboard.jsx`, `HardwareCard.jsx`).
*   **Connect the API Fetch:** Write the `useEffect` hook to target `http://localhost:8000/api/scan` and map the incoming JSON data (scanned parts, 1-10 scores, bottleneck flags) to the UI components.
*   **Build Conditional Warning States:** Implement CSS logic so that if the JSON payload flags `"bottleneck: gpu"`, the corresponding GPU card on the dashboard dynamically changes to a red warning state, while passing components render as green.
