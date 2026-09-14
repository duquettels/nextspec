export default function Dashboard({ scannedData }) {

    return (
        <div className="dashboard-wrapper">
          <div className="top-section">
            <div className="col">
              <div className="panel">
                <div className="panel-title">
                  <span>System Summary</span>
                  <span>↻ 10:42 AM</span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">CPU</span>
                  <span className="sys-val">
                    <span className="dot good" />
                    {scannedData?.cpu?.name || scannedData?.cpu || "Unknown CPU"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">GPU</span>
                  <span className="sys-val">
                    <span className="dot good" />
                    {scannedData?.gpu?.name || scannedData?.gpu || "Unknown GPU"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">RAM</span>
                  <span className="sys-val">
                    <span className="dot good" />
                    {scannedData?.ram_gb ? `${scannedData.ram_gb} GB` : "Unknown RAM"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">Storage</span>
                  <span className="sys-val">
                    <span className="dot good" />
                    {scannedData?.storage_gb ? `${scannedData.storage_gb} GB` : "Unknown Storage"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">PSU</span>
                  <span className="sys-val">
                    <span className="dot warn" />
                    {scannedData?.psu || "Unknown PSU"}
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Performance Overview</div>
                <div className="perf-circle">
                  <span>{scannedData?.analysis?.overall_score || "--"}</span>
                  <small>/ 100 {scannedData?.analysis?.system_status?.toUpperCase() || "UNKNOWN"}</small>
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
                {scannedData?.analysis?.insight_text || "No AI insight available."}
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