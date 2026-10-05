import { useState } from "react";

export default function Dashboard({ scannedData }) {

  const [budget, setBudget] = useState(500);
  const [purpose, setPurpose] = useState("Gaming");
  const [fps, setFPS] = useState(60);
  const [resolution, setResolution] = useState("1080p");

  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (scannedData?.analysis?.insight_text) {
      setAiInsight(scannedData.analysis.insight_text);
    }
  }, [scannedData]);

  //boolean to control ui render
  const isGaming = purpose.includes("Gaming");

  async function handleUpdateAI() {
    setAiLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: parseInt(budget),
          purpose: purpose,
          current_bottleneck: scannedData?.analysis?.bottleneck_detected || "Unknown",
          target_fps: isGaming ? parseInt(fps) : null,
          target_resolution: isGaming ? resolution : null
        })
      });
      const result = await response.json();
      if (result.success) {
        setAiInsight(result.insight);
      } else {
        setAiInsight("AI Error: " + result.error);
      }
      } catch (err) {
        setAiInsight("Error fetching AI insight.");
      } finally {
        setAiLoading(false);
      }
    }

    return (
      <div className="dashboard-wrapper">
        <div className="top-section">
          <div className="col">
              

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
                  <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                      Primary Purpose
                  </label>
                  <select 
                      value={purpose} 
                      onChange={(e) => setPurpose(e.target.value)}
                      style={{ 
                          width: "100%", padding: "8px", 
                          background: "rgba(7, 11, 20, 0.8)", color: "var(--text-main)", 
                          border: "1px solid var(--border-light)", borderRadius: "6px" 
                       }}
                  >
                      <option value="Gaming">Gaming</option>
                      <option value="Esports Gaming">Esports Gaming</option>
                      <option value="Content Creation">Content Creation</option>
                      <option value="Video Editing">Video Editing</option>
                      <option value="General Use">General Use</option>
                      <option value="Full-Stack Development Workstation">Full-Stack Development Workstation</option>
                  </select>
              </div>
              
              {/* Conditionally render FPS and Resolution sliders only if the purpose is related to gaming */}
              {isGaming && (
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>Target FPS</label>
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
                  <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                      <span>Budget ($)</span>
                      <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
                  </label>
                  <input
                      type="range"
                      min="100"
                      max="2000"
                      step="50"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      style={{ width: "100%" }}
                  />
              </div>

              <button
                onClick={handleUpdateAI}
                disabled={aiLoading}
                style={{
                  width: "100%", padding: "10px",
                  background: "var(--accent-cyan)", color: "#fff",
                  border: "none", borderRadius: "6px", fontWeight: "600",
                }}
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

              <div className="rec-item">
                <div className="rec-header">
                  <span>Corsair RM1000x PSU</span>
                  <span className="rec-price">$169.99</span>
                </div>
                <div className="value-score">Value Score: 9.2 / 10</div>
              </div>

              <div className="rec-item">
                <div className="rec-header">
                  <span>2TB Samsung 990 Pro</span>
                  <span className="rec-price">$149.99</span>
                </div>
                <div className="value-score">Value Score: 8.5 / 10</div>
              </div>

              <button className="view-more" type="button">VIEW ALL COMPATIBLE UPGRADES →</button>
            </div>

            <div className="panel">
              <div className="panel-title">Price and Value Analysis</div>
              <div className="metrics">
                <div>
                  <span className="sys-label">Current Value</span>
                  <span className="val">$1,350</span>
                </div>
                <div>
                  <span className="sys-label">Upgraded Value</span>
                  <span className="val">$1,669</span>
                </div>
                <div>
                  <span className="sys-label">Perf Gain</span>
                  <span className="val gain">+ 18%</span>
                </div>
              </div>
            </div>

            <div className="panel ai-panel">
              <div className="panel-title">AI Insight</div>
              <div className="ai-text">
                {aiInsight || "No AI insight available."}
              </div>
              <div className="sources">
                <div className="source-tag">Amazon</div>
                <div className="source-tag">Newegg</div>
                <div className="source-tag">Microcenter</div>
              </div>
            </div>
          </div>
        </div>
    )
}