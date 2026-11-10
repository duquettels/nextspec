# 🎯 Sprint 3 (FINAL): Capstone Complete

> **Project Scope:** Finalizing the end-to-end architecture for the capstone presentation—implementing an interactive 3D visualizer, a multi-turn conversational AI upgrade advisor, live vendor pricing, and persistent PostgreSQL database logging.
---

## 🎨 UI & Frontend Integration (Allen)

- [ ] **Interactive 3D Visualizer (R3F/Canvas):** Replace the placeholder panel[cite: 15] with a working 3D primitive canvas (Three.js/R3F) that visually maps system components and highlights the active WMI bottleneck when clicked.
- [ ] **Conversational AI Advisor Page:** Build out `AIUpgradeAdvisor.jsx` from a static placeholder into a clean, multi-turn chat interface allowing users to type follow-up questions to Gemini.
- [ ] **Manual Refresh Feature:** Add a clickable refresh button to the dashboard header that triggers `fetchScannedData()` without requiring a full browser reload.
- [ ] **Dynamic Pricing UI:** Map incoming pricing variables to replace the hardcoded `$1,350` "Current Value" and `$1,669` "Upgraded Value" metrics on the dashboard[cite: 15, 27].
- [ ] **Loading States:** Implement subtle loading spinners on the dashboard and game optimizer panels for external API and AI requests.

---

## 🔌 API & External Data (Paolo)

**Neon PostgreSQL Integration:** Finalize database schemas (`system_scans`, `recommendations`, `market_prices`) to store user telemetry and generated upgrade paths.

- [ ] **Hardware Valuation (eBay API):** Implement eBay scraping or API queries to average recent sold listings for scanned local hardware to calculate realistic "Current Value".
- [ ] **Upgrade Pricing (Google Shopping/ Scraper):** Secure live MSRP/pricing data for recommended upgrade components to display accurate market values.
- [ ] **Persistence Logging:** Ensure backend routes successfully write scan states and AI recommendations into the Neon database during live execution for presentation proof.

---

---

## 🧠 Backend & Architecture (Levi)

### Infrastructure & Routing

- [ ] **Pricing Endpoint:** Finalize the FastAPI pricing route (`GET /api/pricing`) to accept WMI strings and return external vendor pricing data.
- [ ] **Steam Integration Endpoint:** Ensure `/api/game/{game_name}` cleanly bridges the BeautifulSoup Steam parser with the frontend `GameOptimizer.jsx` component.
- [ ] **Database Binding:** Add SQL insertion logic inside `/api/scan` and `/api/advisor` to persistently log user scans and AI recommendations to Paolo's PostgreSQL database.

### Conversational AI Engine

- [ ] **Multi-Turn Chat Sessions:** Update the `/api/advisor` endpoint from a static `generate_content` call to use Gemini's chat session handler (`ai_client.chats.create(...)`) for context-aware, back-and-forth conversations.
- [ ] **System Instruction Guardrails:** Lock in system instructions for Gemini to ensure it strictly acts as a professional PC hardware consultant and never breaks character.
- [ ] **Robust Fallbacks:** Maintain the 503 traffic-jam safety net in the backend to ensure a seamless offline demo if network constraints occur during the live presentation.

---
