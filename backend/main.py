from fastapi import FastAPI
from pydantic import BaseModel
from core.scanner import get_local_hardware

app = FastAPI(title="NextSpec API", version="1.0")

# --- DATA MODELS ---   
class HardwareProfile(BaseModel):
    cpu: str
    gpu: str
    ram_gb: int

class ScanResponse(BaseModel):
    success: bool
    message: str
    data: HardwareProfile
    

@app.get("/")
def read_root():
    return {"status": "NextSpec Backend is online and routing correctly."}

# --- ROUTES ---
@app.get("/api/scan", response_model=ScanResponse)
def run_diagnostic_scan():
    """
    Triggers the local WMI scanner and returns a structured hardware payload.
    """
    hardware = get_local_hardware()
    
    return {
        "success": True,
        "message": "Local hardware successfully scanned.",
        "data": hardware
    }