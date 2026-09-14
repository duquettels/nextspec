import {useState, useEffect} from "react";


import Sidebar from "./components/Sidebar";
import RealTimeClock from "./components/RealTimeClock";
import Dashboard from "./Renders/Dashboard";

export default function App() {
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

