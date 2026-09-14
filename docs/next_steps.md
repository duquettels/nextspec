Sprint 2: Next Steps
UI & Frontend (Allen/Integration)

Manual Refresh: Add a clickable refresh button to the dashboard header that triggers the fetchScannedData() function without requiring a hard page reload.
Dynamic Pricing UI
Loading States: Implement a subtle loading spinner on the dashboard specifically for the pricing panel, as external APIs may take a few seconds longer than the local WMI scan.
Address the 3D Visualizer: Placeholder for a 3D R3F model. Decide if the team is actually building that, or if you need to scrap that panel to stay within scope.

API & Data (Paolo)

Current Hardware Valuation: Implement the eBay API to search the last 5 sold listings for the scanned local hardware, get "realistic value"
Upgrade Pricing: Secure API keys for Best Buy Developer or set up a proxy service (like ScraperAPI/ZenRows) to pull live MSRP data for the "Upgraded Value" components.
JSON Formatting: Ensure all pricing scripts return clean, standardized JSON payloads (e.g., {"component": "RTX 4070", "price": 549.99, "source": "Best Buy"}) to match API fetch

Backend & Architecture (Levi)

New Route: Create a new FastAPI endpoint (e.g., /api/pricing) that accepts the WMI hardware strings and triggers the external pricing scripts.
Model Updates: Update the HardwareProfile Pydantic model in main.py to securely handle and validate the new pricing objects.
Data Binding: Expand the App.jsx fetch logic to cleanly pass the new pricing data down into the <Dashboard/> component alongside the existing telemetry.
The AI Recommendation Engine - Right now, bottleneck logic is a hardcoded if/else statement based on TDP and raw scores. Need to replace this with actual AI or an advanced algorithmic model.  
  The Input: Feed the WMI scanner data, the Steam game requirements, and the current bottleneck into the model.
  The Output: The model needs to dynamically select a specific compatible upgrade (e.g., "Corsair RM1000x PSU") and generate the dynamic text for the "AI Insight" panel.  
  The Implementation: Decide whether to integrate an external LLM API (like OpenAI or Gemini) or build a highly complex custom Python decision tree to map component compatibility safely.

