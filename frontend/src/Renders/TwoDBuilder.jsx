import React, {useRef, useState} from 'react';
import "../styles/TwoDModel.css";



const components = [
    {
    name: "CPU",
    x: 33.25,
    y: 38,
    width: 16,
    height: 20,
    description: "The CPU, located under the heat sink.",
    },
    {
    name: "RAM",
    x: 52,
    y: 29,
    width: 8.5,
    height: 38,
    description: "RAM modules, the two sticks located on the top right of the motherboard.",
    },
    {
    name: "GPU",
    x: 15,
    y: 68,
    width: 59,
    height: 14,
    description: "Graphics Processing Unit",
    },
    {
    name: "SSD",
    x: 24,
    y: 60,
    width: 8.3,
    height: 6.5,
    description: "Storage Drive",
    },
]

//from what i understand, this bottleneck function only works for CPU and GPU, as RAM and SSD dont return a bottleneck value
function getComponentStatus(componentName, scannedData) {
    const bottleneck = scannedData?.analysis?.bottleneck_detected;

    if (!bottleneck) {
        return "No bottleneck detected";
    
    }
    return bottleneck.toLowerCase() === componentName.toLowerCase()
        ? "Needs attention"
        : "Good";
}

export default function TwoDBuilder({scannedData}) {
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [hoveredComponent, setHoveredComponent] = useState(null);

    const selectedStatus = selectedComponent
        ? getComponentStatus(selectedComponent.name, scannedData)
        : null;
    

    return (
    <div className="two-d-model">
      <div className="two-d-model-layout">
        <div className="computer-image-container">
          <img
            className="computer-image"
            src="/images/PCSideView.png"
            alt="Computer with interactive CPU, RAM, and SSD areas"
          />

          {components.map((component) => {
            const isSelected =
              selectedComponent?.name === component.name;

            const isHovered =
              hoveredComponent?.name === component.name;

            const status = getComponentStatus(
              component.name,
              scannedData
            );

            return (
              <button
                key={component.name}
                type="button"
                className={[
                  "component-hotspot",
                  isSelected ? "hotspot-selected" : "",
                  isHovered ? "hotspot-hovered" : "",
                  status === "Needs attention"
                    ? "hotspot-warning"
                    : "",
                ].join(" ")}
                style={{
                  left: `${component.x}%`,
                  top: `${component.y}%`,
                  width: `${component.width}%`,
                  height: `${component.height}%`,
                }}
                onMouseEnter={() => setHoveredComponent(component)}
                onMouseLeave={() => setHoveredComponent(null)}
                onFocus={() => setHoveredComponent(component)}
                onBlur={() => setHoveredComponent(null)}
                onClick={() => setSelectedComponent(component)}
                aria-label={`Select ${component.name}`}
              >
                <span>{component.name}</span>
              </button>
            );
          })}
        </div>

        <div className="component-info-panel">
          {selectedComponent ? (
            <>
              <div className="component-info-header">
                <div>
                  <span className="component-label">
                    Selected Component
                  </span>

                  <h2>{selectedComponent.name}</h2>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={() => setSelectedComponent(null)}
                  aria-label="Close component details"
                >
                  ×
                </button>
              </div>

              <p>{selectedComponent.description}</p>

              <div className="component-status-row">
                <span>Status</span>

                <strong
                  className={
                    selectedStatus === "Needs attention"
                      ? "status-warning"
                      : selectedStatus === "Good"
                        ? "status-good"
                        : "status-unknown"
                  }
                >
                  {selectedStatus}
                </strong>
              </div>

              {selectedStatus === "Needs attention" && (
                <div className="component-warning">
                  This component has been identified as the current
                  system bottleneck.
                </div>
              )}
            </>
          ) : (
            <div className="component-empty-state">
              <h2>Select a component</h2>

              <p>
                Hover over or click the CPU, RAM, or SSD on the image
                to view more information.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}