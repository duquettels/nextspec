import os
import re
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.scanner import get_local_hardware

# The database/ folder sits next to backend/, so add it to the import path.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database"))
from database import get_connection
from ebay_api import get_price

app = FastAPI(title="NextSpec API", version="1.0")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCORE_MIN = 2000
SCORE_MAX = 40000

# --- MATH LOGIC ---
def normalize_score(raw_score: int) -> float:
    """Converts a raw benchmark score to a 1.0 - 10.0 scale."""
    if raw_score == 0:
        return 0.0
    normalized = ((raw_score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 10
    return round(max(1.0, min(10.0, normalized)), 1)

# --- DATABASE LOOKUP (real benchmark data from Neon) ---
PART_TABLES = {
    "cpu": {"table": "cpu_benchmarks", "name_col": "cpu_name", "perf_col": "cpu_mark"},
    "gpu": {"table": "gpu_benchmarks", "name_col": "gpu_name", "perf_col": "g3d_mark"},
}

def clean_part_name(kind: str, raw: str) -> str:
    """Turns a WMI name into something that matches the PassMark names in the DB.
    '12th Gen Intel(R) Core(TM) i7-12700K' -> 'Intel Core i7-12700K'
    'NVIDIA GeForce RTX 4070'              -> 'GeForce RTX 4070'"""
    name = re.sub(r"\((R|TM)\)", "", raw, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+(st|nd|rd|th) Gen\b", "", name)
    name = re.sub(r"\s+CPU\s*@.*$", "", name)
    name = re.sub(r"\s+\d+-Core Processor.*$", "", name)
    if kind == "gpu":
        name = re.sub(r"^(NVIDIA|AMD)\s+", "", name)
    return re.sub(r"\s+", " ", name).strip()

def find_part(kind: str, scanned_name: str):
    """Finds the DB row for a scanned part. Returns None if there is no match.
    Returns db_name, raw_score, tdp and list_price."""
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
    """find_part, but a DB problem returns None instead of crashing the scan."""
    try:
        return find_part(kind, scanned_name)
    except Exception as e:
        print(f"DB lookup failed for {kind} '{scanned_name}': {e}")
        return None

def find_upgrade(kind: str, current_raw: int, current_name: str, min_gain: float = 1.25):
    """Best performance-per-dollar part that is at least 25% faster than the current one.
    CPUs must also fit the same socket as the current CPU."""
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
    """Typical memory_score of kits with the same DDR type, speed and total size as
    the installed RAM. Windows doesn't report CAS latency, so we take the middle
    (median) of the matching kits. Returns None if nothing matches."""
    if not (ddr_type and speed_mts and capacity_gb):
        return None
    with get_connection() as conn:
        row = conn.execute(
            """SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY memory_score)
               FROM ram_specs WHERE ddr_type = %s AND speed_mts = %s AND capacity_gb = %s""",
            (ddr_type, speed_mts, capacity_gb),
        ).fetchone()
    return round(row[0]) if row and row[0] is not None else None

def find_ram_upgrade(ddr_type: str, current_gb: int, current_score):
    """Best performance-per-dollar kit of the same DDR type at the next size up
    (4 -> 8, 8 -> 16, 16 -> 32). Nothing is suggested once you have 32 GB or more."""
    target_gb = 8 if current_gb < 8 else 16 if current_gb < 16 else 32 if current_gb < 32 else None
    if target_gb is None or not ddr_type:
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
    """Cheapest 80+ Bronze or better PSU that covers the estimated need
    without being wildly oversized (up to 300W extra)."""
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
    """Returns (price, is_live). is_live is False when we had to fall back to
    the old list price in the DB because eBay gave us nothing."""
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

class AnalysisDetail(BaseModel):
    bottleneck_detected: str
    system_status: str
    overall_score: int
    insight_text: str

class RamDetail(BaseModel):
    type: str | None
    speed_mts: int | None
    score: float | None      # 1.0 - 10.0, None if no matching kit is in the database

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
    ram_type = hardware.get("ram_type")
    ram_speed = hardware.get("ram_speed_mts")
    is_laptop = hardware.get("is_laptop", False)

    #DEMO STUFF
    scanned_storage = hardware.get("storage_gb", 0)
    scanned_psu = "800W Corsair RM800x 80+ Gold"
    
    # Retrieve raw scores from the real database. No fake fallback: if a part
    # is not found we say so instead of inventing a score.
    try:
        cpu_info = find_part("cpu", scanned_cpu)
        gpu_info = find_part("gpu", scanned_gpu)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
    if cpu_info is None:
        raise HTTPException(status_code=404, detail=f"CPU '{scanned_cpu}' was not found in the benchmark database.")
    if gpu_info is None:
        raise HTTPException(status_code=404, detail=f"GPU '{scanned_gpu}' was not found in the benchmark database.")
    try:
        ram_score = find_ram_score(ram_type, ram_speed, scanned_ram)
    except Exception as e:  # e.g. the RAM table hasn't been loaded yet
        print(f"RAM lookup failed: {e}")
        ram_score = None
    cpu_raw_score = cpu_info["raw_score"]
    gpu_raw_score = gpu_info["raw_score"]

    # Normalize the scores to a 1.0 - 10.0 scale
    cpu_rating = normalize_score(cpu_raw_score)
    gpu_rating = normalize_score(gpu_raw_score)

    # TDP estimation logic (simplified for demo purposes)
    cpu_tdp = cpu_info.get("tdp") or 65
    gpu_tdp = gpu_info.get("tdp") or 150
    estimated_watts = int((cpu_tdp + gpu_tdp + 50) * 1.2)
    scanned_psu = "N/A (laptop)" if is_laptop else f"Estimated Required: {estimated_watts}W"

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
    if is_laptop and bottleneck == "None":
        insight = "Your CPU and GPU are well balanced."
    elif is_laptop:
        insight = f"Your {bottleneck} is the weaker part. Laptop CPUs and GPUs are soldered to the board, so they can't be upgraded. RAM and storage are usually the only parts you can upgrade."
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
                "overall_score": overall_score,  # <--- Send it to React
                "insight_text": insight
            }
        }
    }


@app.get("/api/pricing", response_model=PricingResponse)
def get_pricing(cpu: str, gpu: str, target: str = "gpu", ram_gb: int | None = None,
                ram_type: str | None = None, ram_speed: int | None = None,
                watts: int | None = None):
    """
    Live eBay prices for the scanned CPU + GPU, plus the best-value upgrade.
    target is 'cpu' or 'gpu' (which part to upgrade, normally the bottleneck).
    ram_gb / ram_type / ram_speed add a RAM upgrade pick, watts adds a PSU pick.
    """
    cpu_part = safe_find_part("cpu", cpu)
    gpu_part = safe_find_part("gpu", gpu)
    kind = "cpu" if target == "cpu" else "gpu"
    target_part = cpu_part if kind == "cpu" else gpu_part

    outdated = False  # becomes True if any price is an old list price instead of live eBay
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