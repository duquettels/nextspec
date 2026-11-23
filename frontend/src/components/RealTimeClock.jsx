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
        <div className = "header-status">

            <button onClick={onRefresh} className="rescan-button">
                ↻ Rescan Hardware
            </button>

            <div className="profile">
                <span className = "last-scan">
                    Last Scan: {lastRefresh || "Never"}
                </span>

                Active Rig: <span className="profile-badge">HP OMEN 40L</span>
                
                <span className="profile-time">{currentTime.toLocaleTimeString()}</span>
            </div>
        </div>
    );
}

