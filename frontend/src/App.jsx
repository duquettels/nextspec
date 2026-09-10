import {useState, useEffect} from "react";


import Sidebar from "./components/Sidebar";
import Dashboard from "./Renders/Dashboard";

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />


      <div className="main">
        <div className="header">
          <h1>Welcome back, Consumer!</h1>
          <div className="profile">
            Active Rig: <span className="profile-badge">HP OMEN 40L</span>
          </div>
        </div>

        <Dashboard />
        
        
      </div>
    </div>
  );
}

