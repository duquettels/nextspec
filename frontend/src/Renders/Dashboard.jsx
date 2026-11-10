import React, { useState, useEffect, useCallback } from "react";
import HardwareInfo from "../components/HardwareInfo";
import TwoDBuilder from "./TwoDBuilder";

export default function Dashboard({ scannedData, budget: initialBudget, purpose: initialPurpose, pricing, pricingLoading }) {
  const [budget, setBudget] = useState(initialBudget || 500);
  const [purpose, setPurpose] = useState(initialPurpose || "Gaming");
  const [fps, setFPS] = useState(60);
  const [resolution, setResolution] = useState("1080p");

  const [aiInsight, setAiInsight] = useState("Analyzing hardware telemetry...");
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  const isGaming = purpose.includes("Gaming");

  const money = (v) => (v != null ? `$${v.toFixed(2)}` : "...");
  const outdatedNote = pricing?.prices_outdated ? (
    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
      * Using cached pricing where live market prices were unavailable.
    </div>
  ) : null;

  const handleUpdateData = useCallback(async () => {
    if (!scannedData) return;

    setAiLoading(true);
    try {
      const aiResponse = await fetch("http://localhost:8080/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: parseInt(budget),
          purpose: purpose,
          current_bottleneck: scannedData.analysis?.bottleneck_detected || "Unknown",
          target_fps: isGaming ? parseInt(fps) : null,
          target_resolution: isGaming ? resolution : null
        })
      });
      const aiResult = await aiResponse.json();
      if (aiResult.success) {
        setAiInsight(aiResult.ai_insight);
      } else {
        const errorMessage = aiResult.error || JSON.stringify(aiResult.detail) || "Unknown Backend Crash";
        setAiInsight("AI Error: " + errorMessage);
      }

      const bottleneck = scannedData.analysis?.bottleneck_detected || "Unknown";
      const recsResponse = await fetch(`http://localhost:8080/api/quick-upgrades?budget=${budget}&bottleneck=${bottleneck}`);
      const recsResult = await recsResponse.json();
      if (recsResult.success) {
        setRecommendations(recsResult.recommendations);
      }
    } catch (err) {
      setAiInsight("Error fetching AI insight.");
    } finally {
      setAiLoading(false);
    }
  }, [scannedData, budget, purpose, isGaming, fps, resolution]);

  useEffect(() => {
    if (scannedData) {
      handleUpdateData();
    }
  }, [scannedData, handleUpdateData]);

  return (
    <div className="dashboard-wrapper">
      <div className="top-section">
        <div className="col">
          <HardwareInfo scannedData={scannedData} />

          <div className="panel" style={{ textAlign: "center" }}>
            <div className="panel-title">Performance Overview</div>
            <div className="perf-circle" style={{ margin: "15px auto" }}>
              <span style={{ fontSize: "36px", fontWeight: "bold" }}>
                {scannedData?.analysis?.overall_score ?? "--"}
              </span>
              <small style={{ color: "var(--text-muted)", display: "block" }}>/ 100</small>
            </div>
            <div style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.5px",
              background: scannedData?.analysis?.bottleneck_detected === "None" 
                ? "rgba(68, 255, 68, 0.15)" 
                : "rgba(255, 68, 68, 0.15)",
              color: scannedData?.analysis?.bottleneck_detected === "None" ? "#44ff44" : "#ff4444",
              border: scannedData?.analysis?.bottleneck_detected === "None" ? "1px solid #44ff44" : "1px solid #ff4444"
            }}>
              {scannedData?.analysis?.system_status?.toUpperCase() || "ANALYZING"}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Upgrade Constraints</div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>Primary Purpose</label>
              <select 
                value={purpose} 
                onChange={(e) => setPurpose(e.target.value)}
                style={{ width: "100%", padding: "8px", background: "rgba(7, 11, 20, 0.8)", color: "var(--text-main)", border: "1px solid var(--border-light)", borderRadius: "6px" }}
              >
                <option value="Gaming">Gaming</option>
                <option value="Streaming">Streaming</option>
                <option value="Video Editing">Video Editing</option>
                <option value="Office Work">Office Work</option>
                <option value="School">School</option>
              </select>
            </div>

            {isGaming && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                    <span>Target FPS</span>
                    <span style={{ color: "var(--accent-cyan)" }}>{fps}</span>
                  </label>
                  <input type="range" min="30" max="240" step="10" value={fps} onChange={(e) => setFPS(e.target.value)} style={{ width: "100%" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>Resolution</label>
                  <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ width: "100%", padding: "8px", background: "rgba(7, 11, 20, 0.8)", color: "var(--text-main)", border: "1px solid var(--border-light)", borderRadius: "6px" }}>
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                <span>Budget ($)</span>
                <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
              </label>
              <input type="range" min="100" max="2000" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: "100%" }} />
            </div>

            <button
              onClick={handleUpdateData}
              disabled={aiLoading}
              style={{ width: "100%", padding: "10px", marginTop: "15px", background: "var(--accent-cyan)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
            >
              {aiLoading ? "Generating Insight..." : "Ask AI for Upgrade Advice"}
            </button>
          </div>

          <div className="panel">
            <div className="panel-title">How It Works</div>
            <div className="step"><div className="step-num">1</div>Scan local WMI hardware info</div>
            <div className="step"><div className="step-num">2</div>AI maps compatibility</div>
            <div className="step"><div className="step-num">3</div>Fetch live vendor pricing</div>
          </div>
        </div>

        <div className="panel visualizer-panel">
          <div className="panel-title" style={{ marginBottom: 0 }}>System Visualizer</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            Interactive Telemetry Layout
          </div>
          <div className="canvas-area">
            <TwoDBuilder scannedData={scannedData} />
          </div>
        </div>
      </div>

      <div className="bottom-section" style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
        <div className="panel">
          <div className="panel-title">Upgrade Recommendations</div>
          {pricing?.upgrade && (
            <div className="rec-item" style={{ marginBottom: "10px" }}>
              <div className="rec-header">
                <span>{pricing.upgrade.name}</span>
                <span className="rec-price">
                  {pricing.upgrade.price != null ? `$${pricing.upgrade.price.toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="value-score" style={{ color: "#44ff44" }}>+{pricing.upgrade.gain_pct}% performance</div>
            </div>
          )}
          {pricing?.ram_upgrade && (
            <div className="rec-item" style={{ marginBottom: "10px" }}>
              <div className="rec-header">
                <span>{pricing.ram_upgrade.name}</span>
                <span className="rec-price">
                  {pricing.ram_upgrade.price != null ? `$${pricing.ram_upgrade.price.toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="value-score">
                RAM: {scannedData?.ram_gb} GB → {pricing.ram_upgrade.capacity_gb} GB
              </div>
            </div>
          )}
          {pricing?.psu_pick && (
            <div className="rec-item" style={{ marginBottom: "10px" }}>
              <div className="rec-header">
                <span>{pricing.psu_pick.name}</span>
                <span className="rec-price">
                  {pricing.psu_pick.price != null ? `$${pricing.psu_pick.price.toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="value-score">PSU: {pricing.psu_pick.wattage}W required</div>
            </div>
          )}
          {recommendations.length > 0 && !pricing?.upgrade && (
            recommendations.map((rec, index) => (
              <div className="rec-item" key={index} style={{ marginBottom: "10px" }}>
                <div className="rec-header">
                  <span>{rec.name}</span>
                  <span className="rec-price">${rec.price}</span>
                </div>
                <div className="value-score" style={{ color: "#44ff44" }}>Est. Perf Gain: {rec.performance_boost}</div>
              </div>
            ))
          )}
          {!pricing?.upgrade && !pricing?.ram_upgrade && !pricing?.psu_pick && recommendations.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {scannedData?.is_laptop 
                ? "Laptop CPUs and GPUs are integrated. RAM and storage are recommended upgrades." 
                : pricingLoading ? "Analyzing live vendor prices..." : "Select parameters to view upgrades."}
            </div>
          )}
          {outdatedNote}
          <button className="view-more" type="button" style={{ marginTop: "15px", width: "100%" }}>VIEW ALL COMPATIBLE UPGRADES →</button>
        </div>

        <div className="panel">
          <div className="panel-title">Price and Value Analysis</div>
          <div className="metrics" style={{ display: "grid", gap: "10px", margin: "15px 0" }}>
            <div>
              <span className="sys-label" style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current Value: </span>
              <strong className="val">{money(pricing?.current_value)}</strong>
            </div>
            <div>
              <span className="sys-label" style={{ fontSize: "12px", color: "var(--text-muted)" }}>Upgraded Value: </span>
              <strong className="val">{money(pricing?.upgraded_value)}</strong>
            </div>
            <div>
              <span className="sys-label" style={{ fontSize: "12px", color: "var(--text-muted)" }}>Perf Gain: </span>
              <strong className="val gain" style={{ color: "#44ff44" }}>
                {pricingLoading ? "..." : pricing?.perf_gain_pct != null ? `+ ${pricing.perf_gain_pct}%` : "N/A"}
              </strong>
            </div>
          </div>
          {outdatedNote}
          {scannedData?.is_laptop && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Part prices don't apply to laptops.
            </div>
          )}
        </div>

        <div className="panel ai-panel">
          <div className="panel-title">AI Insight</div>
          <div className="ai-text" style={{ fontSize: "13px", lineHeight: "1.5", margin: "10px 0" }}>
            {aiInsight || "No AI insight available."}
          </div>
          <div className="sources" style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
            <div className="source-tag" style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "3px" }}>eBay</div>
          </div>
        </div>
      </div>
    </div>
  );
}