export default function Dashboard({ scannedData, pricing, pricingLoading }) {
    const money = (n) => (pricingLoading ? "..." : n == null ? "N/A" : `$${Math.round(n).toLocaleString()}`);
    const outdatedNote = pricing?.prices_outdated ? (
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Price might be outdated</div>
    ) : null;

    return (
        <div className="dashboard-wrapper">
          <div className="top-section">
            <div className="col">
              <div className="panel">
                <div className="panel-title">
                  <span>System Summary</span>
                  <span>↻ LIVE </span>
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
                    {scannedData?.ram_gb
                      ? [`${scannedData.ram_gb} GB`, scannedData.ram?.type,
                         scannedData.ram?.speed_mts && `${scannedData.ram.speed_mts} MT/s`,
                         scannedData.ram?.score != null && `score ${scannedData.ram.score}/10`]
                          .filter(Boolean).join(" · ")
                      : "Unknown RAM"}
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

              {pricing?.upgrade ? (
                <div className="rec-item">
                  <div className="rec-header">
                    <span>{pricing.upgrade.name}</span>
                    <span className="rec-price">
                      {pricing.upgrade.price != null ? `$${pricing.upgrade.price.toFixed(2)}` : "N/A"}
                    </span>
                  </div>
                  <div className="value-score">+{pricing.upgrade.gain_pct}% performance</div>
                </div>
              ) : null}
              {pricing?.ram_upgrade && (
                <div className="rec-item">
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
                <div className="rec-item">
                  <div className="rec-header">
                    <span>{pricing.psu_pick.name}</span>
                    <span className="rec-price">
                      {pricing.psu_pick.price != null ? `$${pricing.psu_pick.price.toFixed(2)}` : "N/A"}
                    </span>
                  </div>
                  <div className="value-score">PSU: {pricing.psu_pick.wattage}W covers your estimated need</div>
                </div>
              )}
              {!pricing?.upgrade && !pricing?.ram_upgrade && !pricing?.psu_pick && (
                <div className="rec-item">
                  <div className="value-score">
                    {scannedData?.is_laptop
                      ? "Laptop CPUs and GPUs are soldered, so they can't be swapped. RAM and storage are usually the upgrades to look at."
                      : pricingLoading ? "Finding upgrades..." : "No upgrade found."}
                  </div>
                </div>
              )}
              {outdatedNote}

              <button className="view-more" type="button">VIEW ALL COMPATIBLE UPGRADES →</button>
            </div>

            <div className="panel">
              <div className="panel-title">Price and Value Analysis</div>
              <div className="metrics">
                <div>
                  <span className="sys-label">Current Value</span>
                  <span className="val">{money(pricing?.current_value)}</span>
                </div>
                <div>
                  <span className="sys-label">Upgraded Value</span>
                  <span className="val">{money(pricing?.upgraded_value)}</span>
                </div>
                <div>
                  <span className="sys-label">Perf Gain</span>
                  <span className="val gain">
                    {pricingLoading ? "..." : pricing?.perf_gain_pct != null ? `+ ${pricing.perf_gain_pct}%` : "N/A"}
                  </span>
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
              <div className="ai-text">
                {scannedData?.analysis?.insight_text || "No AI insight available."}
              </div>
              <div className="sources">
                <div className="source-tag">eBay</div>
              </div>
            </div>
          </div>
        </div>
    )
}