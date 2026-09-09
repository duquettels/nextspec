from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.scanner import get_local_hardware

app = FastAPI(title="NextSpec API", version="1.0")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MOCK DATABASE ---
MOCK_DB = {
    # Using your specific PC specs for baseline testing
    "12th Gen Intel(R) Core(TM) i7-12700K": {"raw_score": 34000, "type": "cpu"},
    "NVIDIA GeForce RTX 4070": {"raw_score": 27000, "type": "gpu"},
    # Fallback/Test parts to force a bottleneck alert
    "Intel Core i3-8100": {"raw_score": 6000, "type": "cpu"},
    "NVIDIA GTX 1060": {"raw_score": 10000, "type": "gpu"}
}

SCORE_MIN = 2000
SCORE_MAX = 40000

# --- MATH LOGIC ---
def normalize_score(raw_score: int) -> float:
    """Converts a raw benchmark score to a 1.0 - 10.0 scale."""
    if raw_score == 0:
        return 0.0
    normalized = ((raw_score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 10
    return round(max(1.0, min(10.0, normalized)), 1)

# --- DATA MODELS ---   
class ComponentDetail(BaseModel):
    name: str
    score: float

class AnalysisDetail(BaseModel):
    bottleneck_detected: str
    system_status: str
class HardwareProfile(BaseModel):
    cpu: ComponentDetail
    gpu: ComponentDetail
    ram_gb: int
    storage_gb: int
    analysis: AnalysisDetail

class ScanResponse(BaseModel):
    success: bool
    message: str
    data: HardwareProfile
    
# --- ROUTES ---
@app.get("/")
def read_root():
    return {"status": "NextSpec Backend is online and routing correctly."}

@app.get("/api/scan", response_model=ScanResponse)
def run_diagnostic_scan():
    """
    Triggers the local WMI scanner, scores the hardware, and checks for bottlenecks.
    """
    hardware = get_local_hardware()
    scanned_cpu = hardware.get("cpu", "Unknown CPU")
    scanned_gpu = hardware.get("gpu", "Unknown GPU")
    scanned_ram = hardware.get("ram_gb", 0)
    scanned_storage = hardware.get("storage_gb", 0)
    
    #Retrieve raw scores from the mock database
    cpu_raw_score = MOCK_DB.get(scanned_cpu, {}).get("raw_score", 0)
    gpu_raw_score = MOCK_DB.get(scanned_gpu, {}).get("raw_score", 0)

    # Normalize the scores to a 1.0 - 10.0 scale
    cpu_rating = normalize_score(cpu_raw_score)
    gpu_rating = normalize_score(gpu_raw_score)

    # Bottleneck detection logic
    bottleneck = "None"
    if abs(gpu_rating - cpu_rating) > 2.5: #2.5 point threshold for bottleneck detection
        if cpu_rating < gpu_rating:
            bottleneck = "CPU"
        else:
            bottleneck = "GPU"

    return {
        "success": True,
        "message": "Local hardware successfully scanned and analyzed.",
        "data": {
            "cpu": {"name": scanned_cpu, "score": cpu_rating},
            "gpu": {"name": scanned_gpu, "score": gpu_rating},
            "ram_gb": scanned_ram,
            "storage_gb": scanned_storage,
            "analysis": {"bottleneck_detected": bottleneck, 
                         "system_status": "Optimal" if bottleneck == "None" else "Upgrade Recommended"}
        }
    }