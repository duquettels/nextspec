# 🎯 Sprint 2: Next Steps & Technical Roadmap

> **Project Scope:** Transitioning from static UI placeholders to live WMI telemetry, real-time pricing API integration, and AI-driven upgrade recommendations.

---

## 🎨 UI & Frontend Integration (Allen)

- [ ] **Manual Refresh:** Add a clickable refresh button to the dashboard header that triggers the `fetchScannedData()` function without requiring a full browser reload.
- [ ] **Dynamic Pricing UI:** Map the incoming pricing variables to the UI to replace the hardcoded `$1,350` "Current Value" and `$1,669` "Upgraded Value" metrics.
- [ ] **Loading States:** Implement a subtle loading spinner on the dashboard specifically for the pricing panel, as external API calls will take slightly longer to resolve than the local WMI scan.
- [ ] **Scope the 3D Visualizer:** Make a definitive team decision on the placeholder 3D R3F model panel—either commit to building it this sprint or scrap the panel to protect the project scope.

---

## 🔌 API & External Data (Paolo)

- [ ] **Current Hardware Valuation:** Implement the eBay API to average the last 5 sold listings for the scanned local hardware to calculate a realistic "Current Value."
- [ ] **Upgrade Pricing:** Secure API keys for the Best Buy Developer portal (or a proxy scraper like ScraperAPI/ZenRows) to pull live MSRP data for the recommended "Upgraded Value" components.
- [ ] **Standardized JSON Formatting:** Ensure all external pricing scripts return clean, uniform JSON payloads (e.g., `{"component": "RTX 4070", "price": 549.99, "source": "Best Buy"}`) to ensure seamless frontend fetching.

---

## 🧠 Backend & Architecture (Levi)

### Infrastructure & Routing
- [ ] **Pricing Endpoint:** Create a new FastAPI route (`GET /api/pricing`) that accepts the scanned WMI hardware strings and triggers the external pricing scripts.
- [ ] **Steam Integration Endpoint:** Build a new FastAPI route (`GET /api/game/{game_name}`) in `main.py` to bridge the standalone Steam WMI parser with the web app.
- [ ] **Data Validation Models:** Update the `HardwareProfile` Pydantic model in `main.py` to securely handle, type-check, and validate the new incoming pricing objects.
- [ ] **Data Pipeline Binding:** Expand the `App.jsx` fetch logic to cleanly pass the new pricing data down into the `<Dashboard/>` component alongside the existing WMI telemetry.

### AI Recommendation Engine
- [ ] **Core Logic Replacement:** Replace the current hardcoded `if/else` TDP bottleneck logic with a dynamic, algorithmic recommendation model.
- [ ] **Data Pipeline Ingestion:** Configure the model to ingest WMI scanner data, Steam game requirements, and the current bottleneck to accurately select specific, compatible upgrades (e.g., *"Corsair RM1000x PSU"*).
- [ ] **Implementation Strategy:** Decide whether to integrate an external LLM API (like OpenAI/Gemini) to generate the "AI Insight" panel text, or build a custom Python decision tree to ensure strict, safe hardware mapping.

---
