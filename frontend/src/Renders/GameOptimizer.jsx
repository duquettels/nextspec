import { useState } from "react";
import { fetchGameRequirements } from "../api/api";


function RequirementsList({ requirements }) {
    if (!requirements) {return <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No requirements available for the selected game.</p>}

    return (
        <div className="sys-item" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <p><strong>Processor:</strong> {requirements.processor}</p>
            <p><strong>Memory:</strong> {requirements.memory}</p>
            <p><strong>Graphics:</strong> {requirements.graphics}</p>
            <p><strong>Storage:</strong> {requirements.storage}</p>
        </div>
    );
}

export default function GameOptimizer({ scannedData }) {

    const [gameName, setGameName] = useState("");
    const [requirements, setRequirements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    //AI Special
    const [budget, setBudget] = useState(500);
    const [aiInsight, setAiInsight] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    //steam fetch
    async function handleSearch(event) {
        event.preventDefault();
        if (!gameName.trim()) return;

        setLoading(true);
        setError("");
        setRequirements(null);
        setAiInsight(""); // Reset AI insight when a new search is initiated

        try {
            const data = await fetchGameRequirements(gameName);
            setRequirements(data);
        } catch (searchError) {
            setError(searchError.message);
        } finally {
            setLoading(false);
        }

    }

    //fetch special AI
    async function handleAskAI() {
        if (!requirements || !scannedData) return;
        setAiLoading(true);

        //format steam specs
        const recSpecs = requirements.recommended;
        const specString = `CPU: ${recSpecs.processor}, RAM: ${recSpecs.memory}, GPU: ${recSpecs.graphics}, Storage: ${recSpecs.storage}`;
    
        try {
            const response = await fetch("http://localhost:8000/api/advisor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    budget: parseInt(budget),
                    purpose: "Gaming",
                    current_bottleneck: scannedData?.analysis?.bottleneck_detected || "Unknown",
                    target_game: requirements.game_name,
                    game_requirements: specString
                })
            });

            const result = await response.json();
            if (result.success) {
                setAiInsight(result.ai_insight);
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
        <section className="panel">
            <h2 className="panel-title">Game Optimizer</h2>

            <form className="game-search" onSubmit={handleSearch}>
                <div className="game-search-input">
                    <span className="search-icon">|</span>

                    <input
                        type="search"
                        value={gameName}
                        onChange={(event) => setGameName(event.target.value)}
                        placeholder="Search Steam library..."
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Searching..." : "Search"}
                </button>
            </form>

            {error && <p style={{ color: "var(--danger)", fontSize: "13px" , marginTop: "10px" }}>{error}</p>}

            {/* STEAM RESULTS & AI TRIGGER */}
            {requirements && (
                <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {requirements.header_image && (
                        <div style={{ width: "100%", maxHeight: "250px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                            <img
                            src={requirements.header_image}
                            alt={requirements.game_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px"}}>
                        <div className="panel" style={{ background: "rgba(7, 11, 20, 0.8)", border: "1px solid var(--border-light)", padding: "15px", borderRadius: "8px" }}>
                            <div className="panel-title">Recommended Requirements</div>
                            <RequirementsList requirements={requirements.recommended} />
                        </div>

                        <div className="panel ai-panel" style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid var(--accent-cyan)", padding: "15px", borderRadius: "8px" }}>
                            <div className="panel-title">Ask NextSpec AI</div>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
                                Get AI insights on how to optimize your PC for {requirements.game_name} based on your current hardware and budget.
                            </p>

                            <label style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "5px" }}>
                                <span style={{ color: "var(--text-main)" }}>Budget ($)</span>
                                <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${budget}</span>
                            </label>
                            <input type="range" min="100" max="2000" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: "100%", marginBottom: "20px" }} />

                            <button 
                                onClick={handleAskAI} 
                                disabled={aiLoading} 
                                style={{ 
                                    width: "100%", padding: "10px", 
                                    background: "var(--accent-cyan)", color: "#fff", 
                                    border: "none", borderRadius: "6px", fontWeight: "600", 
                                    cursor: "pointer", fontSize: "13px"
                                }}
                            >
                                {aiLoading ? "Generating Insight..." : "Ask AI"}
                            </button>

                            {aiInsight && (
                                <div style={{ marginTop: "15px", padding: "12px", background: "rgba(7, 11, 20, 0.8)", borderRadius: "6px", fontSize: "13px", lineHeight: "1.4", border: "1px solid var(--border-light)" }}>
                                    {aiInsight}
                                </div>
                            )}
                        </div>
                    </div>        
                </div>
            )}
        </section>
    );

}