import React, { useState, useEffect, useCallback, useRef } from "react";
import HardwareInfo from "../components/HardwareInfo";
import ThreeDBuilder from "./threeDBuilder";

export default function Dashboard({ scannedData, budget: initialBudget, purpose: initialPurpose, pricing, pricingLoading }) {
  const [budget, setBudget] = useState(initialBudget || 500);
  const [purpose, setPurpose] = useState(initialPurpose || "Gaming");
  const [fps, setFPS] = useState(60);
  const [resolution, setResolution] = useState("1080p");

  const [aiInsight, setAiInsight] = useState("Analyzing hardware telemetry...");
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [localPricing, setLocalPricing] = useState(pricing);
  const [savedNotice, setSavedNotice] = useState("");

  const [catalogCpus, setCatalogCpus] = useState([]);
  const [catalogGpus, setCatalogGpus] = useState([]);
  const [selectedCpu, setSelectedCpu] = useState("");
  const [selectedGpu, setSelectedGpu] = useState("");
  const [buildAnalysis, setBuildAnalysis] = useState(null);

  const hasInitialFetched = useRef(false);
  const latestRequestId = useRef(0);

  useEffect(() => {
    if (pricing) setLocalPricing(pricing);
  }, [pricing]);

  const isGaming = (purpose || "").includes("Gaming");
  const money = (v) => (v != null ? `$${Number(v).toFixed(2)}` : "...");
  const outdatedNote = localPricing?.prices_outdated ? (
    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
      * Using cached pricing where live market prices were unavailable.
    </div>
  ) : null;

  useEffect(() => {
    fetch("http://localhost:8080/api/catalog")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCatalogCpus(data.cpus || []);
          setCatalogGpus(data.gpus || []);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Recalculate build value, upgrade cost, % gain, and new 0-100 score whenever swap dropdowns change
  useEffect(() => {
    if (!scannedData) return;
    const currCpu = scannedData.cpu?.name || "";
    const currGpu = scannedData.gpu?.name || "";

    fetch("http://localhost:8080/api/analyze-build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_cpu: currCpu,
        current_gpu: currGpu,
        selected_cpu: selectedCpu || currCpu,
        selected_gpu: selectedGpu || currGpu,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBuildAnalysis(data);
        }
      })
      .catch(() => {});
  }, [scannedData, selectedCpu, selectedGpu]);

  // 3. Debounced DB Recommendations + Pricing refresh on Upgrade Constraints changes (no Ollama calls)
  useEffect(() => {
    if (!scannedData) return;

    const timer = setTimeout(async () => {
      const bottleneck = scannedData.analysis?.bottleneck_detected || "None";
      const cpuName = scannedData.cpu?.name || "";
      const gpuName = scannedData.gpu?.name || "";

      try {
        const params = new URLSearchParams({
          budget: String(budget),
          bottleneck,
          cpu: cpuName,
          gpu: gpuName,
          purpose,
          fps: String(isGaming ? fps : 60),
          resolution: isGaming ? resolution : "1080p",
        });

        const recsRes = await fetch(`http://localhost:8080/api/quick-upgrades?${params.toString()}`);
        const recsData = await recsRes.json();
        const nextRecs = recsData.success ? recsData.recommendations : [];
        if (recsData.success) {
          setRecommendations(nextRecs);
        }

        if (!scannedData.is_laptop) {
          const activeTarget =
            nextRecs.length > 0
              ? nextRecs[0].type
              : bottleneck === "None"
              ? "none"
              : bottleneck.toLowerCase();

          const priceRes = await fetch(
            `http://localhost:8080/api/pricing?cpu=${encodeURIComponent(cpuName)}&gpu=${encodeURIComponent(gpuName)}&target=${activeTarget}&budget=${budget}`
          );
          const priceData = await priceRes.json();
          if (priceData.success) {
            setLocalPricing(priceData);
          }
        }
      } catch {
        // Keep previous recommendations/pricing if offline
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [scannedData, budget, purpose, isGaming, fps, resolution]);
  

  const handleUpdateData = useCallback(async () => {
    if (!scannedData) return;

    const requestId = ++latestRequestId.current;
    setAiLoading(true);
    const bottleneck = scannedData.analysis?.bottleneck_detected || "None";
    const cpuName = scannedData.cpu?.name || "";
    const gpuName = scannedData.gpu?.name || "";

    try {
      // 1. Hardware-aware Ollama AI Insight
      const aiResponse = await fetch("http://localhost:8080/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: parseInt(budget, 10),
          purpose: purpose,
          current_bottleneck: bottleneck,
          target_fps: isGaming ? parseInt(fps, 10) : null,
          target_resolution: isGaming ? resolution : null,
          cpu_name: cpuName,
          gpu_name: gpuName,
          ram_gb: scannedData.ram_gb
        })
      });
      const aiResult = await aiResponse.json();
      if (requestId !== latestRequestId.current) return;
      if (aiResult.success) {
        setAiInsight(aiResult.ai_insight);
      }

      // 2. Real Neon DB Upgrade Recommendations matched to current hardware
      const recsResponse = await fetch(
        `http://localhost:8080/api/quick-upgrades?budget=${budget}&bottleneck=${encodeURIComponent(bottleneck)}&cpu=${encodeURIComponent(cpuName)}&gpu=${encodeURIComponent(gpuName)}`
      );
      const recsResult = await recsResponse.json();
      if (requestId !== latestRequestId.current) return;
      if (recsResult.success) {
        setRecommendations(recsResult.recommendations);
      }

      // 3. Refresh Price & Value Analysis for current budget
      if (!scannedData.is_laptop) {
        const target = bottleneck === "None" ? "none" : (bottleneck === "CPU" ? "cpu" : "gpu");
        const priceRes = await fetch(
          `http://localhost:8080/api/pricing?cpu=${encodeURIComponent(cpuName)}&gpu=${encodeURIComponent(gpuName)}&target=${target}&budget=${budget}`
        );
        const priceData = await priceRes.json();
        if (requestId !== latestRequestId.current) return;
        if (priceData.success) {
          setLocalPricing(priceData);
        }
      }
    } catch {
      if (requestId === latestRequestId.current) {
        setAiInsight("Error fetching AI insight.");
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setAiLoading(false);
      }
    }
  }, [scannedData, budget, purpose, isGaming, fps, resolution]);

  useEffect(() => {
    if (scannedData && !hasInitialFetched.current) {
      hasInitialFetched.current = true;
      handleUpdateData();
    }
  }, [scannedData, handleUpdateData]);

  const handleSaveBuild = async (upgradePart = null) => {
    if (!scannedData) return;
    const isCpu = upgradePart?.type === "cpu";
    const isGpu = upgradePart?.type === "gpu";
    const profileName = upgradePart
      ? `${upgradePart.name.slice(0, 24)} Upgrade`
      : "Current PC Baseline";

    try {
      const res = await fetch("http://localhost:8080/api/save-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_name: profileName,
          cpu: isCpu ? upgradePart.name : scannedData.cpu?.name,
          gpu: isGpu ? upgradePart.name : scannedData.gpu?.name,
          total_cost_usd: upgradePart ? Number(upgradePart.price) : Number(localPricing?.current_value || 0),
          ram_gb: scannedData.ram_gb,
          storage_gb: scannedData.storage_gb,
          upgraded_part: upgradePart ? upgradePart.name : null,
          upgraded_category: upgradePart ? upgradePart.type?.toUpperCase() : null,
          new_score: scannedData.analysis?.overall_score,
          perf_gain_pct: upgradePart?.gain_pct || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        setSavedNotice(`Saved "${profileName}"!`);
        setTimeout(() => setSavedNotice(""), 3000);
      }
    } catch {
      // Ignore save errors if offline
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="top-section">
        <div className="col">
          <HardwareInfo scannedData={scannedData} />

          <div className="panel" style={{ textAlign: "center" }}>
            <div className="panel-title">Performance Overview</div>
            <div className="perf-circle" style={{ margin: "15px auto" }}>
              <span style={{ fontSize: "36px", fontWeight: "bold" }}>
                {scannedData?.analysis?.overall_score ?? "--"}
              </span>
              <small style={{ color: "var(--text-muted)", display: "block" }}>/ 100</small>
            </div>
            <div style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.5px",
              background: scannedData?.analysis?.bottleneck_detected === "None"
                ? "rgba(68, 255, 68, 0.15)"
                : "rgba(255, 68, 68, 0.15)",
              color: scannedData?.analysis?.bottleneck_detected === "None" ? "#44ff44" : "#ff4444",
              border: scannedData?.analysis?.bottleneck_detected === "None" ? "1px solid #44ff44" : "1px solid #ff4444"
            }}>
              {scannedData?.analysis?.system_status?.toUpperCase() || "ANALYZING"}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Upgrade Constraints</div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>Primary Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                style={{ width: "100%", padding: "8px", background: "rgba(7, 11, 20, 0.8)", color: "var(--text-main)", border: "1px solid var(--border-light)", borderRadius: "6px" }}
              >
                <option value="Gaming">Gaming</option>
                <option value="Streaming">Streaming</option>
                <option value="Video Editing">Video Editing</option>
                <option value="Office Work">Office Work</option>
                <option value="School">School</option>
              </select>
            </div>

            {isGaming && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                    <span>Target FPS</span>
                    <span style={{ color: "var(--accent-cyan)" }}>{fps}</span>
                  </label>
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
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: "5px" }}>
                <span>Budget ($)</span>
                <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
              </label>
              <input type="range" min="100" max="2000" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: "100%" }} />
            </div>

            <button
              onClick={handleUpdateData}
              disabled={aiLoading}
              style={{ width: "100%", padding: "10px", marginTop: "15px", background: "var(--accent-cyan)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
            >
              {aiLoading ? "Generating Insight..." : "Ask AI for Upgrade Advice"}
            </button>
          </div>

          <div className="panel">
            <div className="panel-title">How It Works</div>
            <div className="step"><div className="step-num">1</div>Scan local WMI hardware info</div>
            <div className="step"><div className="step-num">2</div>AI maps compatibility</div>
            <div className="step"><div className="step-num">3</div>Fetch live vendor pricing.</div>
          </div>
        </div>

        <div className="panel visualizer-panel">
          <div className="panel-title" style={{ marginBottom: 0 }}>System Visualizer</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            Interactive Telemetry Layout
          </div>
          <div className="canvas-area">
            <ThreeDBuilder scannedData={scannedData} />
          </div>
        </div>
      </div>

      <div className="bottom-section" style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
        {/* Panel 1: DB-Matched Upgrade Recommendations */}
        <div className="panel">
          <div className="panel-title">Upgrade Recommendations</div>
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <div className="rec-item" key={index} style={{ marginBottom: "10px" }}>
                <div className="rec-header">
                  <span>{rec.name}</span>
                  <span className="rec-price">${Number(rec.price).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span className="value-score" style={{ color: "#44ff44" }}>
                    Est. Perf Gain: {rec.performance_boost}
                    {rec.over_budget ? " (Above Budget)" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveBuild(rec)}
                    style={{
                      padding: "3px 8px",
                      background: "rgba(6, 182, 212, 0.2)",
                      border: "1px solid var(--accent-cyan)",
                      color: "var(--accent-cyan)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(68, 255, 68, 0.08)",
              border: "1px solid rgba(68, 255, 68, 0.35)",
              fontSize: "13px",
              lineHeight: "1.5"
            }}>
              <div style={{ color: "#44ff44", fontWeight: "bold", marginBottom: "4px" }}>
                ✓ No Upgrade Needed
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                Your {scannedData?.gpu?.name} and {scannedData?.cpu?.name} already score{" "}
                <strong style={{ color: "#fff" }}>{scannedData?.analysis?.overall_score}/100</strong> with no bottlenecks detected.
              </div>
            </div>
          )}

          {savedNotice && (
            <div style={{ fontSize: "12px", color: "#44ff44", marginTop: "10px", fontWeight: "bold" }}>
              ✓ {savedNotice}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSaveBuild(recommendations[0] || null)}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "9px",
              background: "rgba(6, 182, 212, 0.15)",
              border: "1px solid var(--accent-cyan)",
              color: "var(--accent-cyan)",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            {recommendations.length > 0 ? "SAVE RECOMMENDED BUILD TO PC →" : "SAVE CURRENT BUILD TO PC →"}
          </button>

          <button className="view-more" type="button" style={{ marginTop: "8px", width: "100%" }}>
            VIEW ALL COMPATIBLE UPGRADES →
          </button>
        </div>

        {/* Panel 2: Price and Value Analysis */}
        <div className="panel">
          <div className="panel-title">
            <span>Price and Value Analysis</span>
            {(selectedCpu || selectedGpu) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCpu("");
                  setSelectedGpu("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-cyan)",
                  fontSize: "10px",
                  cursor: "pointer",
                  padding: 0,
                  textTransform: "uppercase"
                }}
              >
                Reset
              </button>
            )}
          </div>

          {!scannedData?.is_laptop && (
            <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>
                  Test GPU Swap
                </label>
                <select
                  value={selectedGpu}
                  onChange={(e) => setSelectedGpu(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "rgba(7, 11, 20, 0.85)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "5px",
                    fontSize: "12px"
                  }}
                >
                  <option value="">Current: {scannedData?.gpu?.name || "Detected GPU"}</option>
                  {catalogGpus.map((g, i) => (
                    <option key={i} value={g.name}>
                      {g.name} (${g.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>
                  Test CPU Swap
                </label>
                <select
                  value={selectedCpu}
                  onChange={(e) => setSelectedCpu(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "rgba(7, 11, 20, 0.85)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "5px",
                    fontSize: "12px"
                  }}
                >
                  <option value="">Current: {scannedData?.cpu?.name || "Detected CPU"}</option>
                  {catalogCpus.map((c, i) => (
                    <option key={i} value={c.name}>
                      {c.name} (${c.price})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="metrics" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "8px 0" }}>
            <div>
              <span className="sys-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>Current Build:</span>
              <strong className="val">{money(buildAnalysis?.current_value ?? localPricing?.current_value)}</strong>
            </div>
            <div>
              <span className="sys-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>New Build Value:</span>
              <strong className="val">{money(buildAnalysis?.upgraded_value ?? localPricing?.upgraded_value)}</strong>
            </div>
            <div>
              <span className="sys-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>New Parts Cost:</span>
              <strong className="val" style={{ color: "var(--accent-cyan)" }}>
                {money(buildAnalysis?.upgrade_cost ?? 0)}
              </strong>
            </div>
            <div>
              <span className="sys-label" style={{ fontSize: "11px", color: "var(--text-muted)" }}>Perf & Score:</span>
              <strong
                className="val gain"
                style={{
                  color: (buildAnalysis?.perf_gain_pct ?? 0) < 0 ? "#ff4444" : "#44ff44"
                }}
              >
                {pricingLoading
                  ? "..."
                  : buildAnalysis
                  ? `${buildAnalysis.perf_gain_pct >= 0 ? "+" : ""}${buildAnalysis.perf_gain_pct}% (${buildAnalysis.new_overall_score}/100)`
                  : "+0%"}
              </strong>
            </div>
          </div>

          {(buildAnalysis?.cpu_changed || buildAnalysis?.gpu_changed) && (
            <button
              type="button"
              onClick={() =>
                handleSaveBuild({
                  name: buildAnalysis.gpu_changed ? buildAnalysis.selected_gpu : buildAnalysis.selected_cpu,
                  type: buildAnalysis.gpu_changed ? "gpu" : "cpu",
                  price: buildAnalysis.upgrade_cost,
                  gain_pct: buildAnalysis.perf_gain_pct,
                })
              }
              style={{
                marginTop: "10px",
                width: "100%",
                padding: "8px",
                background: "var(--accent-cyan)",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              SAVE CUSTOM BUILD TO PC →
            </button>
          )}

          {outdatedNote}
          {scannedData?.is_laptop && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Part prices don't apply to laptops.
            </div>
          )}
        </div>
        
        {/* Panel 3: AI Insight */}
        <div className="panel ai-panel">
          <div className="panel-title">AI Insight</div>
          <div className="ai-text" style={{ fontSize: "13px", lineHeight: "1.5", margin: "10px 0" }}>
            {aiInsight || "No AI insight available."}
          </div>
          <div className="sources" style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
            <div className="source-tag" style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "3px" }}>
              Neon DB + Ollama
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}