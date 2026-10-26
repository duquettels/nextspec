import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { fetchScannedData } from "./api/api";

import Sidebar from "./components/Sidebar";
import RealTimeClock from "./components/RealTimeClock";


import Dashboard from "./Renders/Dashboard";
import ThreeDBuilder from "./Renders/threeDBuilder";
import PriceChecker from "./Renders/PriceChecker";
import GameOptimizer from "./Renders/GameOptimizer";
import AIUpgradeAdvisor from "./Renders/AIUpgradeAdvisor";




export default function App() {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize state from localStorage
  const [setupComplete, setSetupComplete] = useState(() => localStorage.getItem("nextspec_setup") === "true");
  const [globalBudget, setGlobalBudget] = useState(() => localStorage.getItem("nextspec_budget") || 500);
  const [globalPurpose, setGlobalPurpose] = useState(() => localStorage.getItem("nextspec_purpose") || "Gaming");

  const finishSetup = () => {
    localStorage.setItem("nextspec_setup", "true");
    localStorage.setItem("nextspec_budget", globalBudget);
    localStorage.setItem("nextspec_purpose", globalPurpose);
    setSetupComplete(true);
  };

  
  useEffect(() => {
    // Use the clean API function instead of raw fetch
    fetchScannedData()
      .then(json => {
        setHardware(json.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching hardware data:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <h2>Loading hardware data...</h2>
        </div>
      </div>
    );
  }

  //Blocking model
  if (!setupComplete) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
        <div className="panel" style={{ width: "450px", padding: "30px", background: "var(--bg-panel)" }}>
          <h2 style={{ color: "var(--accent-cyan)", marginTop: 0 }}>Initialize NextSpec</h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Configure your upgrade parameters before analyzing telemetry.
          </p>
          
          <label style={{ display: "block", marginBottom: "5px" }}>Target Workload</label>
          <select value={globalPurpose} onChange={(e) => setGlobalPurpose(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "20px" }}>
            <option value="Gaming">Gaming</option>
            <option value="Streaming">Streaming</option>
            <option value="Video Editing">Video Editing</option>
            <option value="Office Work">Office Work</option>
            <option value="School">School</option>
          </select>

          <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span>Maximum Budget</span>
            <span style={{ color: "var(--accent-cyan)", fontWeight: "bold" }}>${globalBudget}</span>
          </label>
          <input type="range" min="100" max="2000" step="50" value={globalBudget} onChange={(e) => setGlobalBudget(e.target.value)} style={{ width: "100%", marginBottom: "30px" }} />

          <button onClick={finishSetup} style={{ width: "100%", padding: "12px" }}>Initialize Dashboard</button>
        </div>
      </div>
    );
  }


  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <div className="header">
          <h1>Welcome back, Consumer!</h1>
          <RealTimeClock lastRefresh={new Date().toLocaleTimeString()} onRefresh={() => window.location.reload()} />
        </div>

        

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route 
            path="/dashboard" 
            element={<Dashboard scannedData={hardware} budget={globalBudget} purpose={globalPurpose} />} 
          />

          <Route 
              path="/3d-builder" 
              element={
                <ThreeDBuilder 
                  scannedData={hardware} 
                  budget={globalBudget} 
                  purpose={globalPurpose} 
                />
              } 
            />
          <Route path="/price-checker" element={<PriceChecker scannedData={hardware} />}
           />
          <Route path="/game-optimizer" element={<GameOptimizer scannedData={hardware} />}
           />
          <Route path="/ai-upgrade-advisor" element={<AIUpgradeAdvisor scannedData={hardware}
           />} />


          
        </Routes>


      </div>
    </div>
  );
}

