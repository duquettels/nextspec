import React, { useState, useEffect } from "react";

export default function PriceChecker({ scannedData, pricing, pricingLoading }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [upgrades, setUpgrades] = useState([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(false);
  const [budget] = useState(() => localStorage.getItem("nextspec_budget") || 500);

  const bottleneck = scannedData?.analysis?.bottleneck_detected || "GPU";
  const DEMO_TAGS = ["RTX 4070", "RX 7800 XT", "i7-12700K", "Ryzen 7 7800X3D", "32GB DDR5"];

  useEffect(() => {
    if (!scannedData) return;
    setLoadingUpgrades(true);

    fetch(`http://localhost:8080/api/quick-upgrades?budget=${budget}&bottleneck=${bottleneck}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUpgrades(data.recommendations);
      })
      .catch(() => {})
      .finally(() => setLoadingUpgrades(false));
  }, [scannedData, budget, bottleneck]);

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

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchQuery, category);
  };

  return (
    <div style={{ padding: "20px", color: "var(--text-main)", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--accent-cyan)", margin: "0 0 5px 0" }}>Component Price & Benchmark Checker</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "14px" }}>
            Search any CPU, GPU, RAM, or PSU to inspect PassMark benchmarks and live market pricing.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>ACTIVE BUDGET</span>
          <span style={{ fontSize: "20px", fontWeight: "bold", color: "var(--accent-cyan)" }}>${budget}</span>
        </div>
      </div>

      {/* Component Search Box */}
      <div className="panel" style={{ background: "var(--bg-panel)", padding: "20px", marginBottom: "25px", border: "1px solid var(--border-light)" }}>
        <form onSubmit={handleFormSubmit} style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (searchQuery.trim()) executeSearch(searchQuery, e.target.value);
            }}
            style={{
              padding: "12px",
              background: "rgba(7, 11, 20, 0.9)",
              color: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "6px",
              fontSize: "14px"
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
            placeholder="Search hardware (e.g., RTX 4070, Ryzen 5 5600X, Corsair 32GB)..."
            style={{
              flex: 1,
              minWidth: "240px",
              padding: "12px 15px",
              background: "rgba(7, 11, 20, 0.9)",
              color: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />

          <button
            type="submit"
            disabled={searching}
            style={{
              padding: "12px 24px",
              background: "var(--accent-cyan)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {searching ? "Searching..." : "Search Parts"}
          </button>
        </form>

        {/* Quick Demo Search Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Quick Search:</span>
          {DEMO_TAGS.map((tag, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => executeSearch(tag, "all")}
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
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Section */}
      {hasSearched && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#fff", fontSize: "16px", marginBottom: "15px" }}>
            Search Results {searchResults.length > 0 ? `(${searchResults.length})` : ""}
          </h3>

          {searching ? (
            <div className="panel" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
              Querying benchmark database and eBay market listings...
            </div>
          ) : searchResults.length > 0 ? (
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {searchResults.map((part, idx) => (
                <div
                  key={idx}
                  className="panel"
                  style={{
                    background: "var(--bg-panel)",
                    padding: "18px",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        background: "rgba(6, 182, 212, 0.15)",
                        color: "var(--accent-cyan)",
                        borderRadius: "4px",
                        fontWeight: "bold"
                      }}>
                        {part.category}
                      </span>
                      <span style={{ fontSize: "18px", fontWeight: "bold", color: "#fff" }}>
                        {part.price != null ? `$${Number(part.price).toFixed(2)}` : "Price N/A"}
                      </span>
                    </div>

                    <h4 style={{ margin: "6px 0 10px 0", fontSize: "15px", color: "#fff" }}>{part.name}</h4>

                    <div style={{ fontSize: "12px", color: "#44ff44", fontWeight: "600", marginBottom: "4px" }}>
                      Benchmark: {part.benchmark}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
                      {part.spec} • {part.is_live ? "Live eBay Market Price" : "Database List Price"}
                    </div>
                  </div>

                  <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(part.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "9px",
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--accent-cyan)",
                      textDecoration: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      border: "1px solid var(--border-light)"
                    }}
                  >
                    View Live Listings →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel" style={{ padding: "25px", textAlign: "center", color: "var(--text-muted)" }}>
              No matching components found for "{searchQuery}".
            </div>
          )}
        </div>
      )}

      {/* Recommended Bottleneck Upgrades */}
      <div>
        <h3 style={{ color: "var(--accent-cyan)", fontSize: "16px", marginBottom: "12px" }}>
          Recommended Upgrades for Your System ({bottleneck} Target)
        </h3>

        {pricing?.upgrade && (
          <div className="panel" style={{ background: "rgba(6, 182, 212, 0.06)", border: "1px solid var(--accent-cyan)", padding: "18px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--accent-cyan)", fontWeight: "bold" }}>BEST VALUE DATABASE PICK</span>
                <h4 style={{ margin: "4px 0", fontSize: "16px", color: "#fff" }}>{pricing.upgrade.name}</h4>
                <span style={{ fontSize: "13px", color: "#44ff44", fontWeight: "600" }}>+{pricing.upgrade.gain_pct}% Performance Gain</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff" }}>
                  {pricing.upgrade.price != null ? `$${pricing.upgrade.price.toFixed(2)}` : "N/A"}
                </div>
                <a
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(pricing.upgrade.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "12px", color: "var(--accent-cyan)", textDecoration: "none" }}
                >
                  Check eBay →
                </a>
              </div>
            </div>
          </div>
        )}

        {loadingUpgrades ? (
          <p style={{ color: "var(--text-muted)" }}>Pulling vendor pricing...</p>
        ) : (
          <div style={{ display: "grid", gap: "15px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {upgrades.map((item, i) => (
              <div key={i} className="panel" style={{ background: "var(--bg-panel)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#fff" }}>{item.name}</h4>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ color: "#44ff44", fontSize: "13px", fontWeight: "600" }}>{item.performance_boost}</span>
                  <span style={{ fontWeight: "bold", color: "#fff" }}>${item.price}</span>
                </div>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(item.name + " price")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "8px",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--accent-cyan)",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    border: "1px solid var(--border-light)"
                  }}
                >
                  Compare Vendors →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}