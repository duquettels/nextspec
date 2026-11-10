import { useEffect, useState } from "react";

export default function RealTimeClock({ lastRefresh, onRefresh }) {

        const [currentTime, setCurrentTime] = useState(new Date());

        useEffect(() => {
            const intervalId = setInterval(() => {
                setCurrentTime(new Date());
            }, 1000);
            return () => clearInterval(intervalId);
        })

        return (
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button 
                onClick={onRefresh} 
                style={{ padding: "5px 10px", background: "var(--accent-cyan)", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
                ↻ Rescan Hardware
            </button>
            <div className="profile">
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: "10px" }}>
                    Last Scan: {lastRefresh || "Never"}
                </span>
                Active Rig: <span className="profile-badge">HP OMEN 40L</span>
                <span className="profile-time">{currentTime.toLocaleTimeString()}</span>
            </div>
        </div>
        );
}

