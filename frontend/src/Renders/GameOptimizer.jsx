import { useState } from "react";
import { fetchGameRequirements } from "../api/api";


function RequirementsList({ requirements }) {
    if (!requirements) {
        return <p>No requirements available for the selected game.</p>
    }

    return (
        <div className="requirements-list">
            <p>
                <strong>Processor:</strong> {requirements.processor}
            </p>

            <p>
                <strong>Memory:</strong> {requirements.memory}
            </p>

            <p>
                <strong>Graphics:</strong> {requirements.graphics}
            </p>

            <p>
                <strong>Storage:</strong> {requirements.storage}
            </p>
        </div>
    );
}

export default function GameOptimizer() {

    const [gameName, setGameName] = useState("");
    const [requirements, setRequirements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSearch(event) {
        event.preventDefault();
        if (!gameName.trim()) {
            setError("Please enter a game name.");
            return;

        }

        setLoading(true);
        setError("");
        setRequirements(null);

        try {
            const data = await fetchGameRequirements(gameName);
            setRequirements(data);
        } catch (searchError) {
            setError(searchError.message);
        } finally {
            setLoading(false);
        }

    }

    return (
        <section className="panel">
            <h2 className="panel-title">Game Optimizer</h2>

            <form className="game-search" onSubmit={handleSearch}>
                <div className="game-search-input">
                    <span className="search-icon" aria-hidden="true">
                        /
                    </span>

                    <input
                        type="search"
                        value={gameName}
                        onChange={(event) => setGameName(event.target.value)}
                        placeholder="Search Steam library..."
                        aria-label="Search for a Steam game"
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Searching..." : "Search"}
                </button>
            </form>

            {error && <p>{error}</p>}

            {requirements && (
                <div>
                    {requirements.header_image && (
                        <img
                            src={requirements.header_image}
                            alt={requirements.game_name}
                        />
                    )}

                    <h3>{requirements.game_name}</h3>

                    <h4>Minimum Requirements</h4>
                    <RequirementsList requirements={requirements.minimum} />

                    <h4>Recommended Requirements</h4>
                    <RequirementsList requirements={requirements.recommended} />

                </div>
            )}
        </section>
    );

}