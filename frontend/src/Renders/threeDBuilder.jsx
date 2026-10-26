import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";

// Moved mapping outside so both components can access it
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

        // Clone material to prevent color bleed across shared textures
        if (child.material) {
          child.material = child.material.clone();
          
          if (category.toUpperCase() === bottleneck?.toUpperCase()) {
             // Red for the bottleneck component
             child.material.color.setHex(0xff4444);
             child.material.emissive = new THREE.Color(0x330000);
          } else if (category !== "Unknown") {
             // Green for sufficient components
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

  // Run AI Advisor on mount
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
    <div style={{ display: "flex", height: "75vh", background: "var(--bg-panel)", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
      <div style={{ flex: 3 }}>
        <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.5}>
              <PCModel onPartClick={setSelectedPart} bottleneck={systemBottleneck} />
            </Stage>
          </Suspense>
          <OrbitControls />
        </Canvas>
      </div>
      <div style={{ flex: 1, padding: "20px", borderLeft: "1px solid var(--border-light)", color: "var(--text-main)", display: "flex", flexDirection: "column" }}>
        
        {/* Dynamic AI Banner */}
        <div style={{ background: "rgba(0,0,0,0.4)", padding: "15px", borderRadius: "6px", marginBottom: "20px", borderLeft: "4px solid var(--accent-cyan)" }}>
          <h4 style={{ color: "var(--accent-cyan)", margin: "0 0 8px 0", fontSize: "14px" }}>NextSpec AI Advisor</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>{aiInsight}</p>
        </div>

        <h3 style={{ color: "var(--accent-cyan)", marginTop: 0 }}>Component Inspector</h3>
        {activeComponent ? (
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", marginBottom: "4px" }}>{activeComponent.label}</p>
            <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 10px 0", color: activeComponent.isBottleneck ? "#ff4444" : "#44ff44" }}>
              {activeComponent.name}
            </p>
            {activeComponent.score && (
               <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Benchmark Score: <strong style={{ color: "var(--text-main)" }}>{activeComponent.score} / 10</strong></p>
            )}
            {activeComponent.isBottleneck && (
                <p style={{ fontSize: "13px", color: "#ff4444", marginTop: "15px", fontWeight: "bold" }}>⚠️ System Bottleneck Detected</p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Click a highlighted component on the 3D model to inspect its telemetry.</p>
        )}
      </div>
    </div>
  );
}