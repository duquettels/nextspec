import React, { useState, useEffect, useCallback } from "react";

export default function PriceChecker({ scannedData, pricing }) {
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [recommendedParts, setRecommendedParts] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [saveToast, setSaveToast] = useState("");
  const [budget] = useState(() => Number(localStorage.getItem("nextspec_budget")) || 500);

  const cpuName = scannedData?.cpu?.name || "Intel Core i7-12700K";
  const gpuName = scannedData?.gpu?.name || "NVIDIA GeForce RTX 4070";
  const bottleneck = scannedData?.analysis?.bottleneck_detected || "None";
  const baseScore = scannedData?.analysis?.overall_score || 94;

  const loadSavedBuilds = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8080/api/saved-builds");
      const data = await res.json();
      if (data.success) {
        setSavedBuilds(data.builds);
      }
    } catch {
      // Ignore if backend is still starting
    }
  }, []);

  const loadRecommendedParts = useCallback(async () => {
    setLoadingRecs(true);
    try {
      // 1. Fetch bottleneck-specific DB recommendations
      const recRes = await fetch(
        `http://localhost:8080/api/quick-upgrades?budget=${budget}&bottleneck=${encodeURIComponent(bottleneck)}&cpu=${encodeURIComponent(cpuName)}&gpu=${encodeURIComponent(gpuName)}`
      );
      const recData = await recRes.json();

      if (recData.success && recData.recommendations?.length > 0) {
        setRecommendedParts(recData.recommendations);
      } else {
        // 2. For optimal rigs, show top higher-scoring next-tier upgrades from the enriched DB catalog
        const catRes = await fetch(
          `http://localhost:8080/api/catalog?cpu=${encodeURIComponent(cpuName)}&gpu=${encodeURIComponent(gpuName)}`
        );
        const catData = await catRes.json();
        if (catData.success) {
          const nextTier = catData.catalog
            .filter((item) => item.is_upgrade)
            .sort((a, b) => a.price - b.price)
            .slice(0, 3);
          setRecommendedParts(nextTier);
        }
      }
    } catch {
      setRecommendedParts([]);
    } finally {
      setLoadingRecs(false);
    }
  }, [budget, bottleneck, cpuName, gpuName]);

  useEffect(() => {
    loadSavedBuilds();
  }, [loadSavedBuilds]);

  useEffect(() => {
    if (scannedData) {
      loadRecommendedParts();
    }
  }, [scannedData, loadRecommendedParts]);

  const handleSavePartToBuild = async (partName, partCategory, partPrice, gainPct = 0) => {
    const isCpu = String(partCategory).toLowerCase() === "cpu";
    const isGpu = String(partCategory).toLowerCase() === "gpu";
    const nextCpu = isCpu ? partName : cpuName;
    const nextGpu = isGpu ? partName : gpuName;
    const projectedScore = Math.min(100, Math.round(baseScore + Math.max(0, gainPct) * 0.25));
    const profileName = `${partName.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 26)} Build`;

    try {
      const res = await fetch("http://localhost:8080/api/save-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_name: profileName,
          cpu: nextCpu,
          gpu: nextGpu,
          total_cost_usd: Number(partPrice) || 0,
          ram_gb: scannedData?.ram_gb || 32,
          storage_gb: scannedData?.storage_gb || 512,
          upgraded_part: partName,
          upgraded_category: String(partCategory).toUpperCase(),
          new_score: projectedScore,
          perf_gain_pct: gainPct
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveToast(`Saved "${profileName}" to local_saves/ on your PC.`);
        loadSavedBuilds();
        setTimeout(() => setSaveToast(""), 4000);
      }
    } catch {
      setSaveToast("Failed to save build locally.");
    }
  };

  const handleDeleteSaved = async (profileName) => {
    try {
      await fetch(`http://localhost:8080/api/saved-builds/${encodeURIComponent(profileName)}`, {
        method: "DELETE"
      });
      loadSavedBuilds();
    } catch {
      // Ignore
    }
  };

  const executeSearch = async (queryToRun, catToRun = category) => {
    if (!queryToRun.trim()) return;
    setSearchQuery(queryToRun);
    setSearching(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `http://localhost:8080/api/parts/search?q=${encodeURIComponent(queryToRun)}&category=${catToRun}`
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "1150px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--accent-cyan)", margin: "0 0 5px 0" }}>Saved Builds & Component Price Checker</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "14px" }}>
            Compare saved PC builds, inspect database-recommended upgrades, or search individual parts.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>CURRENT RIG SCORE</span>
          <span style={{ fontSize: "20px", fontWeight: "bold", color: "#44ff44" }}>{baseScore} / 100</span>
        </div>
      </div>

      {saveToast && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "18px",
          background: "rgba(68, 255, 68, 0.12)",
          border: "1px solid #44ff44",
          borderRadius: "8px",
          color: "#44ff44",
          fontSize: "13px",
          fontWeight: "600"
        }}>
          ✓ {saveToast}
        </div>
      )}

      {/* 1. SAVED BUILDS & SAVED UPGRADE PARTS (AUTO-LOADED FROM PC) */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ color: "#fff", fontSize: "16px", margin: 0 }}>
            Saved Builds on This PC ({savedBuilds.length})
          </h3>
          <button
            type="button"
            onClick={() => handleSavePartToBuild(gpuName, "GPU", pricing?.current_value || 0, 0)}
            style={{
              padding: "6px 12px",
              background: "rgba(6, 182, 212, 0.15)",
              border: "1px solid var(--accent-cyan)",
              color: "var(--accent-cyan)",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            + Save Current Rig Baseline
          </button>
        </div>

        {savedBuilds.length > 0 ? (
          <div style={{ display: "grid", gap: "15px", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))" }}>
            {savedBuilds.map((build, idx) => (
              <div
                key={idx}
                className="panel"
                style={{
                  background: "var(--bg-panel)",
                  padding: "18px",
                  border: "1px solid var(--accent-cyan)",
                  borderRadius: "8px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--accent-cyan)" }}>
                    {build.profile_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSaved(build.profile_name)}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px" }}
                    title="Remove saved build"
                  >
                    ✕
                  </button>
                </div>

                {build.upgraded_part && (
                  <div style={{ fontSize: "13px", color: "#44ff44", fontWeight: "bold", marginBottom: "8px" }}>
                    Selected Upgrade: {build.upgraded_part} ({build.perf_gain_pct > 0 ? `+${build.perf_gain_pct}%` : "Baseline"})
                  </div>
                )}

                <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "12px" }}>
                  <div><strong style={{ color: "#fff" }}>CPU:</strong> {build.cpu}</div>
                  <div><strong style={{ color: "#fff" }}>GPU:</strong> {build.gpu}</div>
                  {build.new_score && (
                    <div><strong style={{ color: "#fff" }}>Projected Score:</strong> {build.new_score} / 100</div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-light)" }}>
                  <span style={{ fontWeight: "bold", fontSize: "16px", color: "#fff" }}>
                    ${Number(build.total_cost_usd || 0).toFixed(2)}
                  </span>
                  <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(build.upgraded_part || build.gpu)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "12px", color: "var(--accent-cyan)", textDecoration: "none", fontWeight: "bold" }}
                  >
                    Compare Prices →
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel" style={{ padding: "18px", color: "var(--text-muted)", fontSize: "13px", border: "1px dashed var(--border-light)" }}>
            No builds saved yet. Click <strong>Save to Build</strong> on any recommended or searched part below to store it on your PC.
          </div>
        )}
      </div>

      {/* 2. AUTOMATICALLY RECOMMENDED PARTS (MATCHED TO SCANNED HARDWARE & DB SCORES) */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ color: "var(--accent-cyan)", fontSize: "16px", marginBottom: "12px" }}>
          {bottleneck === "None"
            ? "Next-Tier Database Upgrades (Optional Step-Up)"
            : `Recommended Upgrades for Your ${bottleneck} Bottleneck`}
        </h3>

        {loadingRecs ? (
          <p style={{ color: "var(--text-muted)" }}>Calculating benchmark gains and database pricing...</p>
        ) : recommendedParts.length > 0 ? (
          <div style={{ display: "grid", gap: "15px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {recommendedParts.map((part, idx) => (
              <div
                key={idx}
                className="panel"
                style={{
                  background: "var(--bg-panel)",
                  padding: "18px",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(6, 182, 212, 0.15)",
                      color: "var(--accent-cyan)",
                      fontWeight: "bold"
                    }}>
                      {String(part.type || "GPU").toUpperCase()}
                    </span>
                    <span style={{ fontSize: "18px", fontWeight: "bold", color: "#fff" }}>
                      ${Number(part.price).toFixed(2)}
                    </span>
                  </div>

                  <h4 style={{ margin: "6px 0 8px 0", color: "#fff", fontSize: "15px" }}>{part.name}</h4>

                  <div style={{ fontSize: "13px", color: "#44ff44", fontWeight: "600", marginBottom: "4px" }}>
                    Calc. Performance Gain: {part.performance_boost}
                  </div>
                  {part.raw_score && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
                      Benchmark: {part.raw_score.toLocaleString()} ({part.normalized_score}/10)
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleSavePartToBuild(part.name, part.type || "GPU", part.price, part.gain_pct || 0)}
                    style={{
                      flex: 1,
                      padding: "9px",
                      background: "var(--accent-cyan)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    Save to Build
                  </button>
                  <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(part.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "9px 12px",
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--accent-cyan)",
                      textDecoration: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      border: "1px solid var(--border-light)"
                    }}
                  >
                    eBay →
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel" style={{ padding: "18px", color: "var(--text-muted)", fontSize: "13px" }}>
            Your current system is already at top benchmark tier for this budget.
          </div>
        )}
      </div>

      {/* 3. OPTIONAL MANUAL COMPONENT SEARCH */}
      <div className="panel" style={{ background: "var(--bg-panel)", padding: "20px", border: "1px solid var(--border-light)" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "10px" }}>
          Search Additional Components (Optional)
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(searchQuery, category);
          }}
          style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
        >
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (searchQuery.trim()) executeSearch(searchQuery, e.target.value);
            }}
            style={{
              padding: "10px",
              background: "rgba(7, 11, 20, 0.9)",
              color: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "6px"
            }}
          >
            <option value="all">All Parts</option>
            <option value="gpu">GPUs</option>
            <option value="cpu">CPUs</option>
            <option value="ram">RAM</option>
            <option value="psu">PSUs</option>
          </select>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any CPU, GPU, RAM, or PSU in database..."
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "10px 14px",
              background: "rgba(7, 11, 20, 0.9)",
              color: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "6px"
            }}
          />

          <button
            type="submit"
            disabled={searching}
            style={{
              padding: "10px 20px",
              background: "var(--accent-cyan)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {hasSearched && (
          <div style={{ marginTop: "18px", display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {searchResults.length > 0 ? (
              searchResults.map((part, idx) => (
                <div key={idx} style={{ padding: "14px", background: "rgba(7, 11, 20, 0.65)", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--accent-cyan)", fontWeight: "bold" }}>{part.category}</span>
                    <span style={{ fontWeight: "bold", color: "#fff" }}>
                      {part.price != null ? `$${Number(part.price).toFixed(2)}` : "N/A"}
                    </span>
                  </div>
                  <div style={{ fontWeight: "bold", fontSize: "14px", color: "#fff", marginBottom: "6px" }}>{part.name}</div>
                  <div style={{ fontSize: "12px", color: "#44ff44", marginBottom: "10px" }}>{part.benchmark}</div>
                  <button
                    type="button"
                    onClick={() => handleSavePartToBuild(part.name, part.category, part.price || 0, 0)}
                    style={{
                      width: "100%",
                      padding: "7px",
                      background: "rgba(6, 182, 212, 0.2)",
                      border: "1px solid var(--accent-cyan)",
                      color: "var(--accent-cyan)",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    + Save Part to Build
                  </button>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No matching components found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}