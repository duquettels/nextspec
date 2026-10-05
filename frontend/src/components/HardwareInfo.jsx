export default function HardwareInfo({ scannedData }) {
    return (
        <div className="panel hardware-info-panel">
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
    )
}