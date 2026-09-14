import { useEffect, useState } from "react";

export default function realTimeClock() {

        const [currentTime, setCurrentTime] = useState(new Date());

        useEffect(() => {
            const intervalId = setInterval(() => {
                setCurrentTime(new Date());
            }, 1000);
            return () => clearInterval(intervalId);
        })

        return (
            <div className="profile">
            Active Rig: <span className="profile-badge">HP OMEN 40L</span>
            <span className="profile-time">{currentTime.toLocaleTimeString()}</span>
          </div>
        );
}

