import React, { useState, useEffect } from "react";

export default function AIUpgradeAdvisor({ scannedData }) {
  const [insight, setInsight] = useState("Awaiting telemetry analysis...");

  useEffect(() => {
    if (!scannedData) return;
    
    const budget = localStorage.getItem("nextspec_budget") || 500;
    const purpose = localStorage.getItem("nextspec_purpose") || "Gaming";
    const bottleneck = scannedData.analysis?.bottleneck_detected || "None";

    fetch("http://localhost:8000/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: parseInt(budget), purpose, current_bottleneck: bottleneck })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setInsight(data.ai_insight);
        else setInsight("AI generation failed.");
      });
  }, [scannedData]);

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "800px" }}>
      <h2 style={{ color: "var(--accent-cyan)" }}>Dedicated AI Advisor</h2>
      <div style={{ background: "rgba(0,0,0,0.4)", padding: "20px", borderRadius: "8px", borderLeft: "4px solid var(--accent-cyan)" }}>
        <p style={{ fontSize: "16px", lineHeight: "1.6" }}>{insight}</p>
      </div>
    </div>
  );
}