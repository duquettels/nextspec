export default function HardwareInfo({ scannedData }) {
  const bottleneck = scannedData?.analysis?.bottleneck_detected || "Unknown";

  const getDotClass = (component) => {
    return bottleneck === component ? "warn" : "good";
  };
    return (
        <div className="panel hardware-info-panel">
                <div className="panel-title">
                  <span>System Summary</span>
                  <span>↻ LIVE </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">CPU</span>
                  <span className="sys-val">
                    <span className={`dot ${getDotClass("CPU")}`} />
                    {scannedData?.cpu?.name || scannedData?.cpu || "Unknown CPU"}
                </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">GPU</span>
                  <span className="sys-val">
                    <span className={`dot ${getDotClass("GPU")}`} />
                    {scannedData?.gpu?.name || scannedData?.gpu || "Unknown GPU"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">RAM</span>
                  <span className="sys-val">
                    <span className={`dot ${getDotClass("RAM")}`} />
                    {scannedData?.ram_gb ? `${scannedData.ram_gb} GB` : "Unknown RAM"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">Storage</span>
                  <span className="sys-val">
                    <span className={`dot ${getDotClass("Storage")}`} />
                    {scannedData?.storage_gb ? `${scannedData.storage_gb} GB` : "Unknown Storage"}
                  </span>
                </div>

                <div className="sys-item">
                  <span className="sys-label">PSU</span>
                  <span className="sys-val">
                    <span className={`dot ${getDotClass("PSU")}`} />
                    {scannedData?.psu || "Unknown PSU"}
                  </span>
                </div>
              </div>
    )
}