import json
import os
import re
import sys
from typing import Optional

import psycopg2
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.scanner import get_local_hardware
from steam_parser import fetch_steam_specs_by_name

# Add database/ directory to import path if present
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database")
if os.path.exists(db_path):
    sys.path.insert(0, db_path)

try:
    from database import get_connection
except ImportError:
    get_connection = None

try:
    from ebay_api import get_price
except ImportError:
    get_price = None

app = FastAPI(
    title="NextSpec API",
    version="1.2",
    description="Backend API for NextSpec, a PC hardware diagnostic and recommendation tool."
)

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

# --- LOCAL SAVE DIR ---
SAVE_DIR = "local_saves"
os.makedirs(SAVE_DIR, exist_ok=True)

# --- MOCK DATABASE (Presentation Fail-Safe) ---
MOCK_DB = {
    "12th Gen Intel(R) Core(TM) i7-12700K": {"raw_score": 34000, "type": "cpu", "tdp": 125},
    "NVIDIA GeForce RTX 4070": {"raw_score": 30000, "type": "gpu", "tdp": 200},
    "12th Gen Intel(R) Core(TM) i7-1260P": {"raw_score": 17000, "type": "cpu", "tdp": 28},
    "12th Gen Intel(R) Core(TM) i7-1260p": {"raw_score": 17000, "type": "cpu", "tdp": 28},
    "Intel(R) Iris(R) Xe Graphics": {"raw_score": 2800, "type": "gpu", "tdp": 15},
    "Intel Iris Xe Graphics": {"raw_score": 2800, "type": "gpu", "tdp": 15},
    "Intel Core i3-8100": {"raw_score": 6000, "type": "cpu", "tdp": 65},
    "NVIDIA GTX 1060": {"raw_score": 10000, "type": "gpu", "tdp": 120}
}

SCORE_MIN = 2000
SCORE_MAX = 34000

def normalize_score(raw_score: int) -> float:
    """Converts a raw benchmark score to a 1.0 - 10.0 scale."""
    if raw_score == 0:
        return 0.0
    normalized = ((raw_score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 10
    return round(max(1.0, min(10.0, normalized)), 1)

# --- DATABASE LOOKUP (Neon DB) ---
PART_TABLES = {
    "cpu": {"table": "cpu_benchmarks", "name_col": "cpu_name", "perf_col": "cpu_mark"},
    "gpu": {"table": "gpu_benchmarks", "name_col": "gpu_name", "perf_col": "g3d_mark"},
}

def clean_part_name(kind: str, raw: str) -> str:
    """Standardizes WMI names to match PassMark database entries."""
    name = re.sub(r"\((R|TM)\)", "", raw, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+(st|nd|rd|th) Gen\b", "", name)
    name = re.sub(r"\s+CPU\s*@.*$", "", name)
    name = re.sub(r"\s+\d+-Core Processor.*$", "", name)
    if kind == "gpu":
        name = re.sub(r"^(NVIDIA|AMD)\s+", "", name)
    return re.sub(r"\s+", " ", name).strip()

def find_part(kind: str, scanned_name: str):
    """Finds the database row for a scanned part."""
    if not get_connection:
        return None
    cfg = PART_TABLES[kind]
    cleaned = clean_part_name(kind, scanned_name)
    with get_connection() as conn:
        row = conn.execute(
            f"""SELECT {cfg['name_col']}, {cfg['perf_col']}, tdp, price
                FROM {cfg['table']}
                WHERE {cfg['name_col']} ILIKE %s
                ORDER BY LENGTH({cfg['name_col']}) LIMIT 1""",
            (cleaned + "%",),
        ).fetchone()
    if row is None:
        return None
    return {
        "db_name": row[0],
        "raw_score": row[1],
        "tdp": float(row[2]) if row[2] is not None else None,
        "list_price": float(row[3]) if row[3] is not None else None,
    }

def safe_find_part(kind: str, scanned_name: str):
    """Safe wrapper around find_part to prevent database errors from crashing the scan."""
    try:
        return find_part(kind, scanned_name)
    except Exception as e:
        print(f"DB lookup failed for {kind} '{scanned_name}': {e}")
        return None

def find_upgrade(kind: str, current_raw: int, current_name: str, min_gain: float = 1.25):
    """Calculates best performance-per-dollar component upgrades."""
    if not get_connection:
        return None
    cfg = PART_TABLES[kind]
    params = [current_raw * min_gain]
    same_socket = ""
    if kind == "cpu":
        same_socket = " AND socket = (SELECT socket FROM cpu_benchmarks WHERE cpu_name = %s)"
        params.append(current_name)
    with get_connection() as conn:
        row = conn.execute(
            f"""SELECT {cfg['name_col']}, {cfg['perf_col']}, price
                FROM {cfg['table']}
                WHERE {cfg['perf_col']} >= %s AND price IS NOT NULL AND price > 0{same_socket}
                ORDER BY {cfg['perf_col']}::float / price DESC LIMIT 1""",
            params,
        ).fetchone()
    if row is None:
        return None
    return {"db_name": row[0], "raw_score": row[1], "list_price": float(row[2])}

def find_ram_score(ddr_type, speed_mts, capacity_gb):
    """Looks up median RAM benchmark score matching installed type and speed."""
    if not (get_connection and ddr_type and speed_mts and capacity_gb):
        return None
    with get_connection() as conn:
        row = conn.execute(
            """SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY memory_score)
               FROM ram_specs WHERE ddr_type = %s AND speed_mts = %s AND capacity_gb = %s""",
            (ddr_type, speed_mts, capacity_gb),
        ).fetchone()
    return round(row[0]) if row and row[0] is not None else None

def find_ram_upgrade(ddr_type: str, current_gb: int, current_score):
    """Recommends next-tier RAM kit upgrades."""
    target_gb = 8 if current_gb < 8 else 16 if current_gb < 16 else 32 if current_gb < 32 else None
    if target_gb is None or not (get_connection and ddr_type):
        return None
    with get_connection() as conn:
        row = conn.execute(
            """SELECT ram_name, memory_score, price, capacity_gb FROM ram_specs
               WHERE ddr_type = %s AND capacity_gb = %s AND price IS NOT NULL AND price > 0
                     AND memory_score >= %s
               ORDER BY memory_score::float / price DESC LIMIT 1""",
            (ddr_type, target_gb, current_score or 0),
        ).fetchone()
    if row is None:
        return None
    return {"db_name": row[0], "memory_score": row[1], "list_price": float(row[2]), "capacity_gb": row[3]}

def find_psu(watts: int):
    """Recommends lowest cost 80+ Bronze or better PSU matching wattage requirement."""
    if not get_connection:
        return None
    with get_connection() as conn:
        row = conn.execute(
            """SELECT psu_name, wattage, price FROM psu_specs
               WHERE wattage >= %s AND wattage <= %s AND price IS NOT NULL AND price > 0
                     AND efficiency IN ('80+ Bronze', '80+ Silver', '80+ Gold', '80+ Platinum', '80+ Titanium')
               ORDER BY price LIMIT 1""",
            (watts, watts + 300),
        ).fetchone()
    if row is None:
        return None
    return {"db_name": row[0], "wattage": row[1], "list_price": float(row[2])}

def safe_price(kind: str, part: dict):
    """Fetches live eBay market pricing with fallback to database list pricing."""
    if get_price:
        try:
            result = get_price(kind, part["db_name"])
            if result and result.get("price") is not None:
                return result["price"], True
        except Exception as e:
            print(f"eBay price failed for '{part['db_name']}': {e}")
    return part.get("list_price"), False

# --- DATA MODELS ---   
class ComponentDetail(BaseModel):
    name: str
    score: float
    current_value_usd: float = 0.0
    upgrade_msrp_usd: float = 0.0

class AnalysisDetail(BaseModel):
    bottleneck_detected: str
    system_status: str
    overall_score: int
    insight_text: str

class RamDetail(BaseModel):
    type: str | None
    speed_mts: int | None
    score: float | None

class HardwareProfile(BaseModel):
    cpu: ComponentDetail
    gpu: ComponentDetail
    ram_gb: int
    storage_gb: int
    psu: str                 
    psu_watts: int | None = None
    ram: RamDetail | None = None
    is_laptop: bool = False
    analysis: AnalysisDetail

class ScanResponse(BaseModel):
    success: bool
    message: str
    data: HardwareProfile

class UpgradePick(BaseModel):
    kind: str
    name: str
    price: float | None
    gain_pct: int

class RamPick(BaseModel):
    name: str
    price: float | None
    capacity_gb: int

class PsuPick(BaseModel):
    name: str
    price: float | None
    wattage: int

class PricingResponse(BaseModel):
    success: bool
    current_value: float | None
    upgraded_value: float | None
    perf_gain_pct: int | None
    upgrade: UpgradePick | None
    prices_outdated: bool
    ram_upgrade: RamPick | None = None
    psu_pick: PsuPick | None = None

class ConsultationRequest(BaseModel):
    budget: int
    current_bottleneck: str
    purpose: Optional[str] = None
    target_fps: Optional[int] = None
    target_resolution: Optional[str] = None
    game_name: Optional[str] = None
    game_requirements: Optional[str] = None

class SaveBuild(BaseModel):
    profile_name: str
    cpu: str
    gpu: str   
    total_cost_usd: float


# --- ROUTES ---
@app.get("/")
def read_root():
    return {"status": "NextSpec Backend is online and routing correctly."}

# --- DIAGNOSTIC SCAN ROUTE ---
@app.get("/api/scan", response_model=ScanResponse)
def run_diagnostic_scan():
    hardware = get_local_hardware()
    scanned_cpu = hardware.get("cpu", "Unknown CPU")
    scanned_gpu = hardware.get("gpu", "Unknown GPU")
    scanned_ram = hardware.get("ram_gb", 0)
    ram_type = hardware.get("ram_type")
    ram_speed = hardware.get("ram_speed_mts")
    is_laptop = hardware.get("is_laptop", False)
    scanned_storage = hardware.get("storage_gb", 0)

    # Database lookup with fail-safe fallback to MOCK_DB
    cpu_info = safe_find_part("cpu", scanned_cpu)
    gpu_info = safe_find_part("gpu", scanned_gpu)

    if cpu_info:
        cpu_raw_score = cpu_info.get("raw_score", 30000)
        cpu_tdp = cpu_info.get("tdp") or 65
    else:
        mock_cpu = MOCK_DB.get(scanned_cpu, {})
        cpu_raw_score = mock_cpu.get("raw_score", 30000)
        cpu_tdp = mock_cpu.get("tdp", 65)

    if gpu_info:
        gpu_raw_score = gpu_info.get("raw_score", 5000)
        gpu_tdp = gpu_info.get("tdp") or 150
    else:
        mock_gpu = MOCK_DB.get(scanned_gpu, {})
        gpu_raw_score = mock_gpu.get("raw_score", 5000)
        gpu_tdp = mock_gpu.get("tdp", 150)

    try:
        ram_score = find_ram_score(ram_type, ram_speed, scanned_ram)
    except Exception as e:
        print(f"RAM lookup failed: {e}")
        ram_score = None

    cpu_rating = normalize_score(cpu_raw_score)
    gpu_rating = normalize_score(gpu_raw_score)

    estimated_watts = int((cpu_tdp + gpu_tdp + 50) * 1.2)
    scanned_psu = "N/A (laptop)" if is_laptop else f"Estimated Required: {estimated_watts}W"

    bottleneck = "None"
    if abs(gpu_rating - cpu_rating) > 2.5:
        if cpu_rating < gpu_rating:
            bottleneck = "CPU"
        else:
            bottleneck = "GPU"

    overall_score = int((cpu_rating + gpu_rating) / 2 * 10)

    if is_laptop and bottleneck == "None":
        insight = "Your CPU and GPU are well balanced."
    elif is_laptop:
        insight = f"Your {bottleneck} is the weaker component. Laptop processors and graphics chips are integrated, so RAM and storage are your primary upgrade paths."
    elif bottleneck == "GPU":
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
            "psu_watts": None if is_laptop else estimated_watts,
            "ram": {
                "type": ram_type,
                "speed_mts": ram_speed,
                "score": round(min(10.0, ram_score / 10), 1) if ram_score is not None else None,
            },
            "is_laptop": is_laptop,
            "analysis": {
                "bottleneck_detected": bottleneck, 
                "system_status": "Optimal" if bottleneck == "None" else ("Bottleneck Detected" if is_laptop else "Upgrade Recommended"),
                "overall_score": overall_score,
                "insight_text": insight
            }
        }
    }

# --- LIVE PRICING ROUTE ---
@app.get("/api/pricing", response_model=PricingResponse)
def get_pricing(cpu: str, gpu: str, target: str = "gpu", ram_gb: int | None = None,
                ram_type: str | None = None, ram_speed: int | None = None,
                watts: int | None = None):
    cpu_part = safe_find_part("cpu", cpu)
    gpu_part = safe_find_part("gpu", gpu)
    kind = "cpu" if target == "cpu" else "gpu"
    target_part = cpu_part if kind == "cpu" else gpu_part

    outdated = False
    cpu_price = gpu_price = None
    if cpu_part:
        cpu_price, live = safe_price("cpu", cpu_part)
        outdated = outdated or (not live and cpu_price is not None)
    if gpu_part:
        gpu_price, live = safe_price("gpu", gpu_part)
        outdated = outdated or (not live and gpu_price is not None)
    current_value = cpu_price + gpu_price if cpu_price is not None and gpu_price is not None else None

    upgrade = None
    upgraded_value = None
    perf_gain_pct = None
    if target_part:
        try:
            pick = find_upgrade(kind, target_part["raw_score"], target_part["db_name"])
        except Exception as e:
            print(f"Upgrade lookup failed: {e}")
            pick = None
        if pick:
            new_price, live = safe_price(kind, pick)
            outdated = outdated or (not live and new_price is not None)
            perf_gain_pct = round((pick["raw_score"] / target_part["raw_score"] - 1) * 100)
            old_price = cpu_price if kind == "cpu" else gpu_price
            if current_value is not None and old_price is not None and new_price is not None:
                upgraded_value = current_value - old_price + new_price
            upgrade = {"kind": kind, "name": pick["db_name"], "price": new_price, "gain_pct": perf_gain_pct}

    ram_upgrade = None
    if ram_gb and ram_type:
        try:
            current_ram_score = find_ram_score(ram_type, ram_speed, ram_gb)
            ram_pick = find_ram_upgrade(ram_type, ram_gb, current_ram_score)
        except Exception as e:
            print(f"RAM upgrade lookup failed: {e}")
            ram_pick = None
        if ram_pick:
            ram_price, live = safe_price("ram", ram_pick)
            outdated = outdated or (not live and ram_price is not None)
            ram_upgrade = {"name": ram_pick["db_name"], "price": ram_price,
                           "capacity_gb": ram_pick["capacity_gb"]}

    psu_pick = None
    if watts:
        try:
            psu_found = find_psu(watts)
        except Exception as e:
            print(f"PSU lookup failed: {e}")
            psu_found = None
        if psu_found:
            psu_price, live = safe_price("psu", psu_found)
            outdated = outdated or (not live and psu_price is not None)
            psu_pick = {"name": psu_found["db_name"], "price": psu_price, "wattage": psu_found["wattage"]}

    return {
        "success": True,
        "current_value": current_value,
        "upgraded_value": upgraded_value,
        "perf_gain_pct": perf_gain_pct,
        "upgrade": upgrade,
        "prices_outdated": outdated,
        "ram_upgrade": ram_upgrade,
        "psu_pick": psu_pick,
    }

# --- STEAM REQUIREMENTS ROUTE ---
@app.get("/api/game/{game_name}")
def get_game_requirements_endpoint(game_name: str):
    specs = fetch_steam_specs_by_name(game_name)
    if "error" in specs:
        return {"success": False, "message": specs["error"]}
    return {"success": True, "data": specs}

HARDWARE_CATALOG = [
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4080 Super", "price": 999, "performance_boost": "+180%"},
    {"type": "gpu", "name": "AMD Radeon RX 7800 XT", "price": 499, "performance_boost": "+120%"},
    {"type": "gpu", "name": "NVIDIA RTX 4060 8GB", "price": 299, "performance_boost": "+110%"},
    {"type": "gpu", "name": "AMD Radeon RX 6600 8GB", "price": 199, "performance_boost": "+65%"},
    {"type": "cpu", "name": "Intel Core i7-14700K", "price": 399, "performance_boost": "+120%"},
    {"type": "cpu", "name": "Intel Core i5-12600K", "price": 175, "performance_boost": "+80%"},
    {"type": "cpu", "name": "AMD Ryzen 5 5600X", "price": 145, "performance_boost": "+50%"},
    {"type": "ram", "name": "Corsair Vengeance 32GB DDR4", "price": 65, "performance_boost": "+30%"}
]

# --- QUICK UPGRADE ROUTE ---
@app.get("/api/quick-upgrades")
def get_quick_upgrades(budget: int, bottleneck: str):
    bottleneck_type = bottleneck.lower()
    if bottleneck_type in ["none", "unknown"]:
        bottleneck_type = "gpu"
        
    matching_parts = [
        part for part in HARDWARE_CATALOG 
        if part["type"] == bottleneck_type and part["price"] <= budget
    ]
    
    sorted_parts = sorted(matching_parts, key=lambda x: x["price"], reverse=True)
    return {"success": True, "budget": budget, "recommendations": sorted_parts[:3]}

# --- AI ADVISOR (WITH CACHING & DEMO FALLBACK) ---
AI_CACHE = {}

@app.post("/api/advisor")
def get_ai_hardware_advice(request: ConsultationRequest):
    cache_key = f"{request.game_name}_{request.purpose}_{request.budget}_{request.current_bottleneck}_{request.target_fps}_{request.target_resolution}"
    
    if cache_key in AI_CACHE:
        return {
            "success": True,
            "game_scraped": request.game_name,
            "steam_requirements": {},
            "ai_insight": AI_CACHE[cache_key]
        }

    if request.game_name:
        steam_data = fetch_steam_specs_by_name(request.game_name)
        min_specs = steam_data.get("minimum", {}) if isinstance(steam_data, dict) else {}
        steam_gpu = min_specs.get("graphics", "Unknown GPU") if isinstance(min_specs, dict) else "Unknown GPU"
        prompt_context = f"I want to play {steam_data.get('game_name')}, which requires at least a {steam_gpu}."
    else:
        steam_data = {}
        prompt_context = f"I am upgrading my PC primarily for {request.purpose}."
        if request.target_fps and request.target_resolution:
            prompt_context += f" I want to achieve {request.target_fps} FPS at {request.target_resolution}."

    prompt = f"""
    You are NextSpec AI, a PC hardware assistant. My system bottleneck is the {request.current_bottleneck}.
    {prompt_context}
    With a budget of ${request.budget}, recommend exactly ONE component upgrade that fixes this bottleneck. 
    Keep your response to two brief, professional sentences.
    """

    try:
        response = ai_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt
        )
        ai_text = response.text

    except Exception as e:
        btnk = str(request.current_bottleneck).upper()
        budget = request.budget
        target = request.game_name if request.game_name else request.purpose
        
        if btnk in ["GPU", "UNKNOWN"]:
            ai_text = f"For optimal performance in {target} within your ${budget} budget, allocating funds toward a GPU upgrade like an RTX 4060 or RX 7800 XT will eliminate graphics throttling. Ensure your power supply provides sufficient wattage overhead before installation."
        elif btnk == "CPU":
            ai_text = f"Your current processor is restricting throughput for {target}. We recommend upgrading to an Intel Core i7 or Ryzen 7 series CPU within your ${budget} budget to immediately stabilize frame delivery."
        else:
            ai_text = f"Your telemetry indicates a balanced system configuration for {target}. With a ${budget} budget, consider expanding high-speed DDR4 memory or adding an NVMe storage drive for faster asset load times."

    AI_CACHE[cache_key] = ai_text

    return {
        "success": True, 
        "game_scraped": steam_data.get("game_name") if isinstance(steam_data, dict) else None,
        "steam_requirements": steam_data,
        "ai_insight": ai_text
    }

# --- SAVE BUILD ROUTE ---
@app.post("/api/save-build")
def save_build(build: SaveBuild):
    file_path = os.path.join(SAVE_DIR, f"{build.profile_name.replace(' ', '_')}.json")
    try:
        with open(file_path, "w") as f:
            json.dump(build.model_dump(), f, indent=4)
        return {"success": True, "message": f"Build saved locally to {file_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- LOAD BUILD ROUTE ---
@app.get("/api/load-build/{profile_name}")
def load_build(profile_name: str):
    file_path = os.path.join(SAVE_DIR, f"{profile_name.replace(' ', '_')}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Build profile not found.")
    try:
        with open(file_path, "r") as f:
            build_data = json.load(f)
        return {"success": True, "data": build_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- PARTS SEARCH ROUTE ---
@app.get("/api/parts/search")
def search_components(q: str, category: str = "all"):
    """
    Searches Neon DB (CPU, GPU, RAM, PSU) + live eBay pricing for any user-typed component.
    Falls back to local catalog if DB is unavailable.
    """
    query = q.strip()
    if not query:
        return {"success": True, "results": []}

    results = []
    cat = category.lower()

    if get_connection:
        try:
            with get_connection() as conn:
                if cat in ("all", "gpu"):
                    rows = conn.execute(
                        """SELECT gpu_name, g3d_mark, tdp, price FROM gpu_benchmarks
                           WHERE gpu_name ILIKE %s ORDER BY g3d_mark DESC LIMIT 6""",
                        (f"%{query}%",),
                    ).fetchall()
                    for r in rows:
                        price, live = safe_price("gpu", {"db_name": r[0], "list_price": float(r[3]) if r[3] else None})
                        results.append({
                            "category": "GPU",
                            "name": r[0],
                            "benchmark": f"{r[1]} G3D Mark" if r[1] else "N/A",
                            "spec": f"{int(r[2])}W TDP" if r[2] else "Graphics Card",
                            "price": price,
                            "is_live": live
                        })

                if cat in ("all", "cpu"):
                    rows = conn.execute(
                        """SELECT cpu_name, cpu_mark, tdp, price, socket FROM cpu_benchmarks
                           WHERE cpu_name ILIKE %s ORDER BY cpu_mark DESC LIMIT 6""",
                        (f"%{query}%",),
                    ).fetchall()
                    for r in rows:
                        price, live = safe_price("cpu", {"db_name": r[0], "list_price": float(r[3]) if r[3] else None})
                        results.append({
                            "category": "CPU",
                            "name": r[0],
                            "benchmark": f"{r[1]} CPU Mark" if r[1] else "N/A",
                            "spec": f"Socket {r[4]}" if r[4] else (f"{int(r[2])}W TDP" if r[2] else "Processor"),
                            "price": price,
                            "is_live": live
                        })

                if cat in ("all", "ram"):
                    rows = conn.execute(
                        """SELECT ram_name, memory_score, price, capacity_gb, ddr_type, speed_mts FROM ram_specs
                           WHERE ram_name ILIKE %s ORDER BY memory_score DESC LIMIT 6""",
                        (f"%{query}%",),
                    ).fetchall()
                    for r in rows:
                        price, live = safe_price("ram", {"db_name": r[0], "list_price": float(r[2]) if r[2] else None})
                        results.append({
                            "category": "RAM",
                            "name": r[0],
                            "benchmark": f"{r[1]} Mem Score" if r[1] else "N/A",
                            "spec": f"{r[3]}GB {r[4]} @ {r[5]} MT/s" if r[3] else "Memory Kit",
                            "price": price,
                            "is_live": live
                        })

                if cat in ("all", "psu"):
                    rows = conn.execute(
                        """SELECT psu_name, wattage, efficiency, price FROM psu_specs
                           WHERE psu_name ILIKE %s ORDER BY wattage ASC LIMIT 6""",
                        (f"%{query}%",),
                    ).fetchall()
                    for r in rows:
                        price, live = safe_price("psu", {"db_name": r[0], "list_price": float(r[3]) if r[3] else None})
                        results.append({
                            "category": "PSU",
                            "name": r[0],
                            "benchmark": f"{r[1]}W Output",
                            "spec": r[2] or "Power Supply",
                            "price": price,
                            "is_live": live
                        })
        except Exception as e:
            print(f"Component search DB error: {e}")

    # Local fallback if DB returned nothing or is offline
    if not results:
        for item in HARDWARE_CATALOG:
            if query.lower() in item["name"].lower() and (cat == "all" or item["type"] == cat):
                results.append({
                    "category": item["type"].upper(),
                    "name": item["name"],
                    "benchmark": item["performance_boost"],
                    "spec": "Catalog Reference",
                    "price": float(item["price"]),
                    "is_live": False
                })

    return {"success": True, "results": results[:12]}