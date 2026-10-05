import os
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.scanner import get_local_hardware
from steam_parser import fetch_steam_specs_by_name

app = FastAPI(title="NextSpec API", version="1.0")

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
ai_client = genai.Client(api_key=api_key)

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
    "12th Gen Intel(R) Core(TM) i7-12700K": {"raw_score": 34000, "type": "cpu", "tdp": 125},
    "NVIDIA GeForce RTX 4070": {"raw_score": 30000, "type": "gpu", "tdp": 200},
    "12th Gen Intel(R) Core(TM) i7-1260p": {"raw_score": 30000, "type": "cpu", "tdp": 125},
    "Intel(R) Iris(R) Xe Graphics": {"raw_score": 2000, "type": "gpu", "tdp": 15},
    # Fallback/Test parts to force a bottleneck alert
    "Intel Core i3-8100": {"raw_score": 6000, "type": "cpu", "tdp": 65},
    "NVIDIA GTX 1060": {"raw_score": 10000, "type": "gpu", "tdp": 120}
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
    current_value_usd: float = 0.0  # Ready for eBay data
    upgrade_msrp_usd: float = 0.0   # Ready for Best Buy data

class AnalysisDetail(BaseModel):
    bottleneck_detected: str
    system_status: str
    overall_score: int
    insight_text: str

class HardwareProfile(BaseModel):
    cpu: ComponentDetail
    gpu: ComponentDetail
    ram_gb: int
    storage_gb: int
    psu: str                 
    analysis: AnalysisDetail

class ScanResponse(BaseModel):
    success: bool
    message: str
    data: HardwareProfile

class ConsultationRequest(BaseModel):
    budget: int
    target_fps: int
    target_resolution: str
    current_bottleneck: str
    game_name: str
    
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

    #DEMO STUFF
    scanned_storage = hardware.get("storage_gb", 0)
    scanned_psu = "800W Corsair RM800x 80+ Gold"
    
    #Retrieve raw scores from the mock database
    cpu_raw_score = MOCK_DB.get(scanned_cpu, {}).get("raw_score", 0)
    gpu_raw_score = MOCK_DB.get(scanned_gpu, {}).get("raw_score", 0)

    # so the math engine still has numbers to calculate the bottleneck UI.
    if cpu_raw_score == 0:
        cpu_raw_score = 30000  # Default to a high score
    if gpu_raw_score == 0:
        gpu_raw_score = 5000   # Default to a low score to force a bottleneck alert

    # Normalize the scores to a 1.0 - 10.0 scale
    cpu_rating = normalize_score(cpu_raw_score)
    gpu_rating = normalize_score(gpu_raw_score)

    # TDP estimation logic (simplified for demo purposes)
    cpu_tdp = MOCK_DB.get(scanned_cpu, {}).get("tdp", 65)  
    gpu_tdp = MOCK_DB.get(scanned_gpu, {}).get("tdp", 150) 
    estimated_watts = int((cpu_tdp + gpu_tdp + 50) * 1.2)
    scanned_psu = f"Estimated Required: {estimated_watts}W"

    # Bottleneck detection logic
    bottleneck = "None"
    if abs(gpu_rating - cpu_rating) > 2.5: #2.5 point threshold for bottleneck detection
        if cpu_rating < gpu_rating:
            bottleneck = "CPU"
        else:
            bottleneck = "GPU"

    # Overall system score is the average of CPU and GPU ratings
    overall_score = int((cpu_rating + gpu_rating) / 2 * 10)  # Scale to 0-100 for UI display

    # --- UPGRADE ADVICE LOGIC ---
    # This is a placeholder for future logic that could provide upgrade recommendations
    if bottleneck == "GPU":
        insight = f"Your CPU is severely outpacing your graphics card. Upgrading your GPU is recommended, but a stronger GPU means you will likely need a PSU larger than your current {estimated_watts}W requirement."
    elif bottleneck == "CPU":
        insight = "Your GPU is being bottlenecked by your processor. Upgrading your CPU will unlock missing performance, and usually doesn't require a major PSU wattage jump."
    else:
        insight = f"Your system is perfectly balanced. If you plan to upgrade to next-gen components in the future, remember your baseline power requirement will exceed {estimated_watts}W."

    return {
        "success": True,
        "message": "Local hardware successfully scanned and analyzed.",
        "data": {
            "cpu": {"name": scanned_cpu, "score": cpu_rating},
            "gpu": {"name": scanned_gpu, "score": gpu_rating},
            "ram_gb": scanned_ram,
            "storage_gb": scanned_storage,
            "psu": scanned_psu,
            "analysis": {
                "bottleneck_detected": bottleneck, 
                "system_status": "Optimal" if bottleneck == "None" else "Upgrade Recommended",
                "overall_score": overall_score,  # <--- Send it to React
                "insight_text": insight
            }
        }
    }

@app.get("/api/game/{game_name}")
def get_game_requirements_endpoint(game_name: str):
    """
    Fetches the minimum and recommended specs for a given game from Steam.
    """
    specs = fetch_steam_specs_by_name(game_name)
    
    if "error" in specs:
         return {"success": False, "message": specs["error"]}
         
    return {"success": True, "data": specs}

HARDWARE_CATALOG = [
    {"type": "gpu", "name": "AMD Radeon RX 6600 8GB", "price": 199, "performance_boost": "+65%"},
    {"type": "gpu", "name": "NVIDIA RTX 4060 8GB", "price": 299, "performance_boost": "+110%"},
    {"type": "cpu", "name": "Intel Core i5-12600K", "price": 175, "performance_boost": "+80%"},
    {"type": "cpu", "name": "AMD Ryzen 5 5600X", "price": 145, "performance_boost": "+50%"},
    {"type": "ram", "name": "Corsair Vengeance 32GB DDR4", "price": 65, "performance_boost": "+30%"}
]

@app.get("/api/quick-upgrades")
def get_quick_upgrades(budget: int, bottleneck: str):
    """
    Returns candidate components matching the user's budget without requiring a game query.
    """
    bottleneck_type = bottleneck.lower()
    
    # Filter catalog by bottleneck category and max budget
    matching_parts = [
        part for part in HARDWARE_CATALOG 
        if part["type"] == bottleneck_type and part["price"] <= budget
    ]
    
    # Sort by highest price to show the best options at the top of their budget
    sorted_parts = sorted(matching_parts, key=lambda x: x["price"], reverse=True)
    return {"success": True, "budget": budget, "recommendations": sorted_parts[:3]}

# AI ADVISOR ---
@app.post("/api/advisor")
def get_ai_hardware_advice(request: ConsultationRequest):
    """
    Scrapes Steam and generates a dynamic AI hardware recommendation.
    """
    # 1. Fetch live Steam requirements using your imported function
    steam_data = fetch_steam_specs_by_name(request.game_name)
    
    if "error" in steam_data:
        return {"success": False, "message": steam_data["error"]}

    # 2. Extract the minimum GPU from the Steam data
    min_specs = steam_data.get("minimum", {})
    if isinstance(min_specs, dict):
        steam_gpu = min_specs.get("graphics", "Unknown GPU")
    else:
        steam_gpu = "Unknown GPU"
    
    # 3. Inject it into the Gemini Prompt
    prompt = f"""
    You are NextSpec AI, a PC hardware assistant. My system bottleneck is the {request.current_bottleneck}.
    I want to play {steam_data.get('game_name')}, which requires at least a {steam_gpu}.
    With a budget of ${request.budget}, recommend exactly ONE component upgrade that fixes this bottleneck and meets the game's requirements. 
    Keep your response to two brief, professional sentences.
    """
    
    try:
        # 4. Ask Gemini
        response = ai_client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )
        ai_text = response.text

    except Exception as e:
        error_msg = str(e)
        # 4b. The Presentation Safety Net: Catch server traffic jams
        if "503" in error_msg or "high demand" in error_msg.lower():
            ai_text = f"Due to current system constraints, I am operating in offline mode. To play {request.game_name}, which requires a {steam_gpu}, I recommend dedicating your ${request.budget} budget to the strongest GPU available in the catalog."
        else:
            return {"success": False, "error": error_msg}

    # 5. Return the Master JSON Payload (now includes the header_image you added!)
    return {
        "success": True, 
        "game_scraped": steam_data.get("game_name"),
        "steam_requirements": steam_data,
        "ai_insight": ai_text
    }