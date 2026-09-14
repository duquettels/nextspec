import {useState, useEffect} from "react";


import Sidebar from "./components/Sidebar";
import RealTimeClock from "./components/RealTimeClock";
import Dashboard from "./Renders/Dashboard";

export default function App() {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate an API call to fetch hardware data
    fetch("http://localhost:8000/api/scan")
      // Replace this with your actual API call
      .then((response) => response.json())
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
        <Dashboard />   
      </div>
  </div>
  );
}

