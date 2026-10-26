import React, { useState } from "react";
import { fetchGameRequirements } from "../api/api";

function RequirementsCard({ title, specs }) {
  if (!specs) return null;
  return (
    <div className="panel" style={{ background: "rgba(7, 11, 20, 0.8)", border: "1px solid var(--border-light)", padding: "15px", borderRadius: "8px" }}>
      <div className="panel-title" style={{ fontSize: "13px", color: "var(--accent-cyan)", marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
        <div><strong style={{ color: "var(--text-muted)" }}>CPU:</strong> <span style={{ color: "#fff" }}>{specs.processor || "N/A"}</span></div>
        <div><strong style={{ color: "var(--text-muted)" }}>RAM:</strong> <span style={{ color: "#fff" }}>{specs.memory || "N/A"}</span></div>
        <div><strong style={{ color: "var(--text-muted)" }}>GPU:</strong> <span style={{ color: "#fff" }}>{specs.graphics || "N/A"}</span></div>
        <div><strong style={{ color: "var(--text-muted)" }}>Storage:</strong> <span style={{ color: "#fff" }}>{specs.storage || "N/A"}</span></div>
      </div>
    </div>
  );
}

export default function GameOptimizer({ scannedData }) {
  const [gameName, setGameName] = useState("");
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [budget, setBudget] = useState(() => localStorage.getItem("nextspec_budget") || 500);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const QUICK_SEARCHES = ["Cyberpunk 2077", "Elden Ring", "Grand Theft Auto V", "Apex Legends"];

  const executeSearch = async (query) => {
    if (!query.trim()) return;
    setGameName(query);
    setLoading(true);
    setError("");
    setRequirements(null);
    setAiInsight("");

    try {
      const data = await fetchGameRequirements(query);
      setRequirements(data);
    } catch (searchError) {
      setError(searchError.message || "Game not found or Steam API rate limited.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(gameName);
  };

  const handleAskAI = async () => {
    if (!requirements || !scannedData) return;
    setAiLoading(true);

    const recSpecs = requirements.recommended || requirements.minimum || {};
    const specString = `CPU: ${recSpecs.processor || "Unknown"}, RAM: ${recSpecs.memory || "Unknown"}, GPU: ${recSpecs.graphics || "Unknown"}`;

    try {
      const response = await fetch("http://localhost:8080/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: parseInt(budget),
          purpose: "Gaming",
          current_bottleneck: scannedData?.analysis?.bottleneck_detected || "Unknown",
          game_name: requirements.game_name || gameName,
          game_requirements: specString
        })
      });

      const result = await response.json();
      if (result.success) {
        setAiInsight(result.ai_insight);
      } else {
        setAiInsight("AI Error: " + (result.error || result.message || "Failed to generate recommendation."));
      }
    } catch {
      setAiInsight("Error connecting to NextSpec AI server.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ color: "var(--accent-cyan)", margin: "0 0 5px 0" }}>Game Requirements & Hardware Optimizer</h2>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "14px" }}>
          Benchmark your scanned hardware against live Steam system specs and generate budget-targeted upgrade advice.
        </p>
      </div>

      {/* Search Bar & Preset Quick-Links */}
      <div className="panel" style={{ background: "var(--bg-panel)", padding: "20px", marginBottom: "20px" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            type="search"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Search Steam game title (e.g. Elden Ring, Cyberpunk 2077)..."
            style={{
              flex: 1,
              padding: "12px 15px",
              background: "rgba(7, 11, 20, 0.8)",
              border: "1px solid var(--border-light)",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "14px"
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 25px",
              background: "var(--accent-cyan)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {loading ? "Scraping Steam..." : "Search Game"}
          </button>
        </form>

        {/* Quick Click Preset Tags */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Demo Presets:</span>
          {QUICK_SEARCHES.map((title, i) => (
            <button
              key={i}
              type="button"
              onClick={() => executeSearch(title)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border-light)",
                color: "var(--accent-cyan)",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="panel" style={{ color: "#ff4444", padding: "15px", marginBottom: "20px", border: "1px solid #ff4444" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Steam Game Results Grid */}
      {requirements && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Header Banner */}
          <div className="panel" style={{ padding: "0", overflow: "hidden", position: "relative", minHeight: "180px", border: "1px solid var(--border-light)" }}>
            {requirements.header_image && (
              <img
                src={requirements.header_image}
                alt={requirements.game_name}
                style={{ width: "100%", height: "200px", objectFit: "cover", display: "block", opacity: 0.85 }}
              />
            )}
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "20px",
              background: "linear-gradient(transparent, rgba(7, 11, 20, 0.95))"
            }}>
              <h1 style={{ margin: 0, color: "#fff", fontSize: "24px" }}>{requirements.game_name}</h1>
            </div>
          </div>

          {/* System Comparison Grid: Your Rig vs Steam Specs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "15px" }}>
            {/* Scanned System Specs */}
            <div className="panel" style={{ background: "rgba(6, 182, 212, 0.05)", border: "1px solid var(--accent-cyan)", padding: "15px", borderRadius: "8px" }}>
              <div className="panel-title" style={{ fontSize: "13px", color: "var(--accent-cyan)", marginBottom: "10px" }}>
                Your Local Telemetry
              </div>
              <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
                <div><strong style={{ color: "var(--text-muted)" }}>CPU:</strong> <span style={{ color: "#fff" }}>{scannedData?.cpu?.name || scannedData?.cpu || "Intel Core i7-1260P"}</span></div>
                <div><strong style={{ color: "var(--text-muted)" }}>RAM:</strong> <span style={{ color: "#fff" }}>{scannedData?.ram_gb || 32} GB</span></div>
                <div><strong style={{ color: "var(--text-muted)" }}>GPU:</strong> <span style={{ color: "#fff" }}>{scannedData?.gpu?.name || scannedData?.gpu || "Intel Iris Xe"}</span></div>
                <div><strong style={{ color: "var(--text-muted)" }}>Bottleneck:</strong> <span style={{ color: scannedData?.analysis?.bottleneck_detected === "None" ? "#44ff44" : "#ff4444", fontWeight: "bold" }}>{scannedData?.analysis?.bottleneck_detected || "GPU"}</span></div>
              </div>
            </div>

            {/* Steam Minimum Specs */}
            <RequirementsCard title="Steam Minimum Requirements" specs={requirements.minimum} />

            {/* Steam Recommended Specs */}
            <RequirementsCard title="Steam Recommended Requirements" specs={requirements.recommended} />
          </div>

          {/* AI Advisor Card */}
          <div className="panel ai-panel" style={{ background: "rgba(7, 11, 20, 0.9)", border: "1px solid var(--accent-cyan)", padding: "20px", borderRadius: "8px" }}>
            <div className="panel-title" style={{ color: "var(--accent-cyan)", fontSize: "16px", marginBottom: "5px" }}>
              Optimization Advisor for {requirements.game_name}
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "15px" }}>
              Tailored upgrade analysis evaluating your local hardware against {requirements.game_name}'s requirements.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", alignItems: "center" }}>
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                  <span>Max Budget Cap</span>
                  <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  style={{ width: "100%", marginBottom: "15px" }}
                />

                <button
                  onClick={handleAskAI}
                  disabled={aiLoading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "var(--accent-cyan)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  {aiLoading ? "Generating Analysis..." : `Analyze for ${requirements.game_name}`}
                </button>
              </div>

              <div style={{ padding: "15px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "6px", borderLeft: "3px solid var(--accent-cyan)", minHeight: "80px", display: "flex", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "#e2e8f0" }}>
                  {aiInsight || "Set your budget cap and click Analyze to generate targeted upgrade advice."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}