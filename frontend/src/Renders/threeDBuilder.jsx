import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";

const MAPPINGS = {
  GPU: ["4", "5", "12", "35"],
  RAM: ["548", "568", "588", "618"],
  CPU: ["291", "680"],
  Storage: ["77"],
  PSU: ["61", "289", "287"],
  Cooling: ["417", "421", "439", "443", "461", "465", "485", "487", "632", "636", "654", "658"]
};

function PCModel({ onPartClick, bottleneck }) {
  const { scene } = useGLTF("/pc_model.glb"); 

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === "Object_790") {
          child.visible = false; 
          return;
        }

        const meshID = child.name.replace(/\D/g, '');
        let category = "Unknown";
        for (const [key, ids] of Object.entries(MAPPINGS)) {
          if (ids.includes(meshID)) category = key;
        }

        if (child.material) {
          child.material = child.material.clone();
          
          if (category.toUpperCase() === bottleneck?.toUpperCase()) {
            child.material.color.setHex(0xff4444);
            child.material.emissive = new THREE.Color(0x330000);
          } else if (category !== "Unknown") {
            child.material.color.setHex(0x44ff44);
            child.material.emissive = new THREE.Color(0x002200);
          }
        }
      }
    });
  }, [scene, bottleneck]);

  return (
    <primitive 
      object={scene} 
      onClick={(e) => {
        if (e.object.name === "Object_790") return;
        e.stopPropagation();
        onPartClick(e.object.name); 
      }} 
    />
  );
}

export default function ThreeDBuilder({ scannedData, budget, purpose }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [aiInsight, setAiInsight] = useState("Analyzing hardware telemetry...");

  useEffect(() => {
    if (!scannedData) return;

    const currentBottleneck = scannedData.analysis?.bottleneck_detected || "None";

    fetch("http://localhost:8080/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget: parseInt(budget) || 500,
        current_bottleneck: currentBottleneck,
        purpose: purpose || "Gaming"
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setAiInsight(data.ai_insight);
      } else {
        setAiInsight("AI offline. Please refer to standard system telemetry.");
      }
    })
    .catch(() => setAiInsight("Connection to NextSpec AI failed."));
  }, [scannedData, budget, purpose]);

  const getComponentSpecs = (meshName) => {
    if (!scannedData || !meshName) return null;
    const meshID = meshName.replace(/\D/g, ''); 
    let category = "Unknown";
    for (const [key, ids] of Object.entries(MAPPINGS)) {
      if (ids.includes(meshID)) category = key;
    }

    const isBottleneck = category.toUpperCase() === scannedData.analysis?.bottleneck_detected?.toUpperCase();

    switch (category) {
      case "GPU": return { label: "Graphics Card", name: scannedData.gpu?.name || scannedData.gpu, score: scannedData.gpu?.score, isBottleneck };
      case "CPU": return { label: "Processor", name: scannedData.cpu?.name || scannedData.cpu, score: scannedData.cpu?.score, isBottleneck };
      case "RAM": return { label: "System Memory", name: `${scannedData.ram_gb} GB`, score: null, isBottleneck };
      case "Storage": return { label: "Storage Drive", name: `${scannedData.storage_gb} GB`, score: null, isBottleneck };
      case "PSU": return { label: "Power Supply", name: scannedData.psu, score: null, isBottleneck };
      case "Cooling": return { label: "Case Cooling", name: "Standard System Fans", score: null, isBottleneck };
      default: return { label: "Unmapped Mesh", name: meshName, score: null, isBottleneck: false };
    }
  };

  const activeComponent = getComponentSpecs(selectedPart);
  const systemBottleneck = scannedData?.analysis?.bottleneck_detected || "None";

  return (
    <div style={{ position: "relative", width: "100%", height: "78vh", background: "var(--bg-panel)", borderRadius: "8px", border: "1px solid var(--border-light)", overflow: "hidden" }}>
      {/* Top-Left Floating Status Legend */}
      <div style={{
        position: "absolute",
        top: "16px",
        left: "16px",
        zIndex: 10,
        background: "rgba(7, 11, 20, 0.85)",
        backdropFilter: "blur(8px)",
        padding: "12px 16px",
        borderRadius: "8px",
        border: "1px solid var(--border-light)",
        pointerEvents: "none"
      }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--accent-cyan)", marginBottom: "4px" }}>
          Interactive 3D PC Inspector
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Click any highlighted component to inspect telemetry
        </div>
        <div style={{ display: "flex", gap: "14px", fontSize: "11px" }}>
          <span style={{ color: "#44ff44" }}>● Optimal</span>
          <span style={{ color: "#ff4444" }}>● Bottleneck ({systemBottleneck})</span>
        </div>
      </div>

      {/* Full-Width 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 2, 5], fov: 50 }}
        onPointerMissed={() => setSelectedPart(null)}
      >
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5}>
            <PCModel onPartClick={setSelectedPart} bottleneck={systemBottleneck} />
          </Stage>
        </Suspense>
        <OrbitControls />
      </Canvas>

      {/* Floating Component Popup Card (Appears on Click) */}
      {activeComponent && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "320px",
          zIndex: 20,
          background: "rgba(7, 11, 20, 0.94)",
          backdropFilter: "blur(12px)",
          padding: "20px",
          borderRadius: "10px",
          border: `1px solid ${activeComponent.isBottleneck ? "#ff4444" : "var(--accent-cyan)"}`,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.75)",
          color: "var(--text-main)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--accent-cyan)", fontWeight: "bold" }}>
              {activeComponent.label}
            </span>
            <button
              onClick={() => setSelectedPart(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "18px",
                cursor: "pointer",
                lineHeight: 1,
                padding: "0 4px"
              }}
              title="Close popup"
            >
              ×
            </button>
          </div>

          <div style={{
            fontWeight: "bold",
            fontSize: "16px",
            marginBottom: "12px",
            color: activeComponent.isBottleneck ? "#ff4444" : "#44ff44"
          }}>
            {activeComponent.name}
          </div>

          {activeComponent.score != null && (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
              Benchmark Rating: <strong style={{ color: "#ffffff" }}>{activeComponent.score} / 10</strong>
            </div>
          )}

          {activeComponent.isBottleneck && (
            <div style={{
              padding: "8px 10px",
              background: "rgba(255, 68, 68, 0.15)",
              border: "1px solid #ff4444",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#ff4444",
              fontWeight: "bold",
              marginBottom: "12px"
            }}>
              ⚠️ Primary System Bottleneck
            </div>
          )}

          <div style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-light)"
          }}>
            <div style={{ fontSize: "11px", color: "var(--accent-cyan)", fontWeight: "bold", marginBottom: "4px" }}>
              NEXTSPEC AI RECOMMENDATION
            </div>
            <p style={{ fontSize: "12px", color: "#e2e8f0", margin: 0, lineHeight: "1.5" }}>
              {aiInsight}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}