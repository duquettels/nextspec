import React, { useState, useEffect, useCallback } from "react";

export default function AIUpgradeAdvisor({ scannedData }) {
  const [budget, setBudget] = useState(() => localStorage.getItem("nextspec_budget") || 500);
  const [purpose, setPurpose] = useState(() => localStorage.getItem("nextspec_purpose") || "Gaming");
  const [insight, setInsight] = useState("Awaiting telemetry analysis...");
  const [loading, setLoading] = useState(false);

  const fetchAdvice = useCallback(async () => {
    if (!scannedData) return;
    setLoading(true);

    const bottleneck = scannedData.analysis?.bottleneck_detected || "None";

    try {
      const res = await fetch("http://localhost:8080/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          budget: parseInt(budget), 
          purpose, 
          current_bottleneck: bottleneck 
        })
      });
      const data = await res.json();
      if (data.success) {
        setInsight(data.ai_insight);
      } else {
        setInsight("AI Advisor is currently operating in offline telemetry mode.");
      }
    } catch {
      setInsight("Unable to establish connection to NextSpec AI server.");
    } finally {
      setLoading(false);
    }
  }, [scannedData, budget, purpose]);

  useEffect(() => {
    fetchAdvice();
  }, [fetchAdvice]);

  const bottleneck = scannedData?.analysis?.bottleneck_detected || "None";

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "25px" }}>
        <h2 style={{ color: "var(--accent-cyan)", margin: "0 0 5px 0" }}>NextSpec AI Upgrade Advisor</h2>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "14px" }}>
          Generative hardware optimization driven by local telemetry and real-time market data.
        </p>
      </div>

      {/* Telemetry Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div className="panel" style={{ background: "rgba(7, 11, 20, 0.8)", padding: "15px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>DETECTED CPU</span>
          <strong style={{ fontSize: "14px", color: "#fff" }}>{scannedData?.cpu?.name || scannedData?.cpu || "Scanning..."}</strong>
        </div>

        <div className="panel" style={{ background: "rgba(7, 11, 20, 0.8)", padding: "15px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>DETECTED GPU</span>
          <strong style={{ fontSize: "14px", color: "#fff" }}>{scannedData?.gpu?.name || scannedData?.gpu || "Scanning..."}</strong>
        </div>

        <div className="panel" style={{ background: "rgba(7, 11, 20, 0.8)", padding: "15px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>SYSTEM BOTTLENECK</span>
          <strong style={{ fontSize: "14px", color: bottleneck === "None" ? "#44ff44" : "#ff4444" }}>
            {bottleneck === "None" ? "Balanced System" : `${bottleneck} Limited`}
          </strong>
        </div>
      </div>

      {/* Control & Analysis Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        {/* Controls Panel */}
        <div className="panel" style={{ background: "var(--bg-panel)", padding: "20px" }}>
          <h4 style={{ margin: "0 0 15px 0", color: "var(--accent-cyan)" }}>Parameters</h4>
          
          <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>Primary Workload</label>
          <select 
            value={purpose} 
            onChange={(e) => setPurpose(e.target.value)} 
            style={{ width: "100%", padding: "10px", background: "rgba(7,11,20,0.8)", color: "#fff", border: "1px solid var(--border-light)", borderRadius: "6px", marginBottom: "20px" }}
          >
            <option value="Gaming">Gaming</option>
            <option value="Streaming">Streaming</option>
            <option value="Video Editing">Video Editing</option>
            <option value="Workstation">Workstation</option>
          </select>

          <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
            <span>Upgrade Budget</span>
            <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
          </label>
          <input 
            type="range" min="100" max="2000" step="50" 
            value={budget} 
            onChange={(e) => setBudget(e.target.value)} 
            style={{ width: "100%", marginBottom: "20px" }} 
          />

          <button 
            onClick={fetchAdvice} 
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: "var(--accent-cyan)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "Analyzing..." : "Re-evaluate System"}
          </button>
        </div>

        {/* AI Insight Box */}
        <div className="panel" style={{ background: "rgba(6, 182, 212, 0.05)", border: "1px solid var(--accent-cyan)", padding: "25px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: loading ? "#ffaa00" : "#44ff44" }} />
            <h3 style={{ margin: 0, color: "var(--accent-cyan)", fontSize: "18px" }}>AI Hardware Diagnostic Insight</h3>
          </div>
          
          <p style={{ fontSize: "15px", lineHeight: "1.7", color: "#e2e8f0" }}>
            {insight}
          </p>

          <div style={{ marginTop: "30px", paddingTop: "15px", borderTop: "1px solid var(--border-light)", display: "flex", gap: "15px", fontSize: "12px", color: "var(--text-muted)" }}>
            <span>Model: Gemini Flash</span>
            <span>•</span>
            <span>Target Bottleneck: {bottleneck}</span>
            <span>•</span>
            <span>Budget Cap: ${budget}</span>
          </div>
        </div>
      </div>
    </div>
  );
}