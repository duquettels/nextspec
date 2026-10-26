import React, { useState, useEffect, useCallback } from "react";
import HardwareInfo from "../components/HardwareInfo";

export default function Dashboard({ scannedData, budget: initialBudget, purpose: initialPurpose }) {

  const [budget, setBudget] = useState(initialBudget);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [fps, setFPS] = useState(60);
  const [resolution, setResolution] = useState("1080p");

  const [aiInsight, setAiInsight] = useState("Analyzing hardware telemetry...");
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  // boolean to control ui render
  const isGaming = purpose.includes("Gaming");

  const handleUpdateData = useCallback(async () => {
    if (!scannedData) return;
    
    setAiLoading(true);
    try {
      // Call the backend API to get AI insight
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
    
      // fetch dynamic upgrade recommendations based on budget and bottleneck
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

  // Run automatically when scannedData becomes available
  useEffect(() => {
    if (scannedData) {
      handleUpdateData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedData]); 

  return (
    <div className="dashboard-wrapper">
      <div className="top-section">
        <div className="col">
          <HardwareInfo scannedData={scannedData} />
          <div className="panel">
            <div className="panel-title">Performance Overview</div>
            <div className="perf-circle">
              <span>{scannedData?.analysis?.overall_score || "--"}</span>
              <small>/ 100 {scannedData?.analysis?.system_status?.toUpperCase() || "UNKNOWN"}</small>
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
            
            {/* Conditionally render FPS and Resolution sliders only if the purpose is related to gaming */}
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
          <div className="panel-title" style={{ marginBottom: 0 }}>3D System Visualizer</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            Click a component to view detailed telemetry
          </div>
          <div className="canvas-area">[ Interactive R3F 3D Model Rendered Here ]</div>
         </div>
        </div>

        <div className="bottom-section">
        <div className="panel">
          <div className="panel-title">Upgrade Recommendations</div>
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <div className="rec-item" key={index}>
                <div className="rec-header">
                  <span>{rec.name}</span>
                  <span className="rec-price">${rec.price}</span>
                </div>
                <div className="value-score">Est. Perf Gain: {rec.performance_boost}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Select parameters and click Ask AI to view components.</div>
          )}
          <button className="view-more" type="button" style={{ marginTop: "15px" }}>VIEW ALL COMPATIBLE UPGRADES →</button>
        </div>

        <div className="panel ai-panel" style={{ gridColumn: "span 2" }}>
          <div className="panel-title">AI Insight</div>
          <div className="ai-text">
            {aiInsight || "No AI insight available. Adjust your budget and request an analysis."}
          </div>
          <div className="sources">
            <div className="source-tag">Amazon</div>
            <div className="source-tag">Newegg</div>
            <div className="source-tag">Microcenter</div>
          </div>
        </div>
      </div>
    </div>
  );
}