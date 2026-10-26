import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { fetchScannedData } from "./api/api";

import Sidebar from "./components/Sidebar";
import RealTimeClock from "./components/RealTimeClock";
import HardwareInfo from "./components/HardwareInfo";

import Dashboard from "./Renders/Dashboard";
import ThreeDBuilder from "./Renders/ThreeDBuilder";
import PriceChecker from "./Renders/PriceChecker";
import GameOptimizer from "./Renders/GameOptimizer";
import AIUpgradeAdvisor from "./Renders/AIUpgradeAdvisor";




export default function App() {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    // Use the clean API function instead of raw fetch
    fetchScannedData()
      .then(json => {
        setHardware(json.data);
        setLoading(false);
        // Laptop CPUs and GPUs are soldered, so there is nothing to price or swap.
        if (json.data.is_laptop) {
          setPricingLoading(false);
          return;
        }
        // Pricing hits eBay so it is slower. Show the scan first, then fill in pricing.
        const target = json.data.analysis.bottleneck_detected === "CPU" ? "cpu" : "gpu";
        const ram = { gb: json.data.ram_gb, type: json.data.ram?.type, speed: json.data.ram?.speed_mts };
        fetchPricing(json.data.cpu.name, json.data.gpu.name, target, ram, json.data.psu_watts)
          .then(setPricing)
          .catch((err) => console.error("Error fetching pricing:", err))
          .finally(() => setPricingLoading(false));
      })
      .catch((err) => {
        console.error("Error fetching hardware data:", err);
        setError(err.message);
        setLoading(false);
        setPricingLoading(false);
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

  if (error) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <h2>{error}</h2>
        </div>
      </div>
    );
  }

  const cpuDot = hardware?.analysis?.bottleneck_detected === "CPU" ? "warn" : "good";
  const gpuDot = hardware?.analysis?.bottleneck_detected === "GPU" ? "warn" : "good";
  const ramDot = hardware?.analysis?.bottleneck_detected === "RAM" ? "warn" : "good";
  const storageDot = hardware?.analysis?.bottleneck_detected === "Storage" ? "warn" : "good";
  const psuDot = hardware?.analysis?.bottleneck_detected === "PSU" ? "warn" : "good";

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <div className="header">
          <h1>Welcome back, Consumer!</h1>
          <RealTimeClock />
        </div>

        <HardwareInfo scannedData={hardware} />

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path ="/dashboard" element={<Dashboard scannedData={hardware} />}
           />

          <Route path="/3d-builder" element={<ThreeDBuilder scannedData={hardware} />}
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