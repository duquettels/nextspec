import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate an API call to fetch hardware data
    fetch("http://localhost:8000/api/scan")
      // Replace this with your actual API call
      .then((response) => response.json())
      .then(json => {
        setHardware(json.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching hardware data:", error);
        setLoading(false);
      });
     }, []);
if (loading) {
    return (
    <div className="app-shell">
      <Sidebar />
      <div className="main" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <h2>Loading hardware data...</h2>
      </div>
    </div>
    );  
  }

  const cpuDot = hardware?.analysis?.bottleneck_detected === "CPU" ? "warn" : "good";
  const gpuDot = hardware?.analysis?.bottleneck_detected === "GPU" ? "warn" : "good";
  const ramDot = hardware?.analysis?.bottleneck_detected === "RAM" ? "warn" : "good";
  const storageDot = hardware?.analysis?.bottleneck_detected === "Storage" ? "warn" : "good";
  const psuDot = hardware?.analysis?.bottleneck_detected === "PSU" ? "warn" : "good";

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <div className="header">
          <h1>Welcome back, Consumer!</h1>
          <div className="profile">
            Active Rig: <span className="profile-badge">Live System</span>
          </div>
        </div>

        <div className="dashboard-wrapper">
          <div className="top-section">
            <div className="col">
              <div className="panel">
                <div className="panel-title">
                  <span>System Summary</span>
                  <span>↻ LIVE</span>
                </div>

                {/* CPU Data */}
                <div className="sys-item">
                  <span className="sys-label">CPU</span>
                  <span className="sys-val">
                    <span className={`dot ${cpuDot}`} />
                    {hardware?.cpu?.name || "Unknown CPU"}
                  </span>
                </div>

                {/* GPU Data */}
                <div className="sys-item">
                  <span className="sys-label">GPU</span>
                  <span className="sys-val">
                    <span className={`dot ${gpuDot}`} />
                    {hardware?.gpu?.name || "Unknown GPU"}
                  </span>
                </div>

                {/* RAM Data */}
                <div className="sys-item">
                  <span className="sys-label">RAM</span>
                  <span className="sys-val">
                    <span className={`dot ${ramDot}`} />
                    {hardware?.ram_gb ? `${hardware.ram_gb} GB` : "Unknown"}
                  </span>
                </div>

                {/* Storage Data */}
                <div className="sys-item">
                  <span className="sys-label">Storage</span>
                  <span className="sys-val">
                    <span className={`dot ${storageDot}`} />
                    {hardware?.storage_gb ? `${hardware.storage_gb} GB` : "Unknown Storage"}
                  </span>
                </div>

                {/* PSU Data */}
                <div className="sys-item">
                  <span className="sys-label">PSU</span>
                  <span className="sys-val">
                    <span className={`dot ${psuDot}`} />
                    {hardware?.psu || "Unknown PSU"}
                  </span>
                </div>
                
              {/* System Status Analysis */}
                <div className="sys-item">
                  <span className="sys-label">Status</span>
                  <span className="sys-val">
                    {hardware?.analysis?.system_status || "Optimal"}
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Performance Overview</div>
                <div className="perf-circle">
                  <span>{hardware?.analysis?.overall_score || "N/A"}</span>
                  <small>/ 100 {hardware?.analysis?.system_status === "Optimal" ? "EXCELLENT" : "WARNING"}</small>
                </div>
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
                Your i7 and RTX 4070 provide exceptional 1440p framerates. To maximize future upgrade paths
                for next-gen GPUs, replacing your 800W PSU is the most strategic priority.
              </div>
              <div className="sources">
                <div className="source-tag">Amazon</div>
                <div className="source-tag">Newegg</div>
                <div className="source-tag">Microcenter</div>
              </div>
            </div>
          </div>
        </div>
      </div>
  </div>
  );
}

