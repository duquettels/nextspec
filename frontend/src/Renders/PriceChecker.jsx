import React, { useState, useEffect } from "react";

export default function PriceChecker({ scannedData }) {
  const [upgrades, setUpgrades] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scannedData) return;
    setLoading(true);
    
    const bottleneck = scannedData.analysis?.bottleneck_detected || "GPU";
    const budget = localStorage.getItem("nextspec_budget") || 500;

    fetch(`http://localhost:8000/api/quick-upgrades?budget=${budget}&bottleneck=${bottleneck}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setUpgrades(data.recommendations);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [scannedData]);

  return (
    <div style={{ padding: "20px", color: "var(--text-main)" }}>
      <h2 style={{ color: "var(--accent-cyan)" }}>Live Price Checker</h2>
      <p style={{ color: "var(--text-muted)" }}>Targeting your system bottleneck: <strong>{scannedData?.analysis?.bottleneck_detected}</strong></p>
      
      {loading ? <p>Pulling vendor pricing...</p> : (
        <div style={{ display: "grid", gap: "15px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {upgrades.map((item, i) => (
            <div key={i} style={{ background: "var(--bg-panel)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <h4 style={{ margin: "0 0 10px 0" }}>{item.name}</h4>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#44ff44" }}>{item.performance_boost}</span>
                <span style={{ fontWeight: "bold" }}>${item.price}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}