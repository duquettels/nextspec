import React, { useState, useEffect } from "react";

export default function PriceChecker({ scannedData }) {
  const [upgrades, setUpgrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(() => localStorage.getItem("nextspec_budget") || 500);

  const bottleneck = scannedData?.analysis?.bottleneck_detected || "GPU";

  useEffect(() => {
    if (!scannedData) return;
    setLoading(true);

    fetch(`http://localhost:8080/api/quick-upgrades?budget=${budget}&bottleneck=${bottleneck}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setUpgrades(data.recommendations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scannedData, budget, bottleneck]);

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "25px" }}>
        <div>
          <h2 style={{ color: "var(--accent-cyan)", margin: "0 0 5px 0" }}>Live Market Price Checker</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "14px" }}>
            Curated component upgrades targeted to resolve your <strong>{bottleneck}</strong> bottleneck.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Active Budget Limit</span>
          <span style={{ fontSize: "20px", fontWeight: "bold", color: "var(--accent-cyan)" }}>${budget}</span>
        </div>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Querying component pricing database...
        </div>
      ) : upgrades.length > 0 ? (
        <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {upgrades.map((item, i) => (
            <div key={i} className="panel" style={{ background: "var(--bg-panel)", padding: "20px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", padding: "3px 8px", background: "rgba(6, 182, 212, 0.15)", color: "var(--accent-cyan)", borderRadius: "4px", fontWeight: "bold", textTransform: "uppercase" }}>
                    {item.type || bottleneck} Upgrade
                  </span>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: "#fff" }}>${item.price}</span>
                </div>

                <h3 style={{ margin: "10px 0", fontSize: "16px", color: "#fff" }}>{item.name}</h3>
                
                <div style={{ fontSize: "13px", color: "#44ff44", marginBottom: "15px", fontWeight: "600" }}>
                  Estimated Gain: {item.performance_boost}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "15px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "3px" }}>Best Buy</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "3px" }}>Micro Center</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "3px 7px", borderRadius: "3px" }}>Amazon</span>
                </div>

                <a 
                  href={`https://www.google.com/search?q=${encodeURIComponent(item.name + " price")}`} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ display: "block", textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.05)", color: "var(--accent-cyan)", textDecoration: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", border: "1px solid var(--border-light)" }}
                >
                  Compare Vendors →
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
          No components found matching a ${budget} budget for a {bottleneck} upgrade. Try increasing your budget slider on the Dashboard.
        </div>
      )}
    </div>
  );
}