import json
import os
import re
import sys
import urllib.request
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()  # Load environment variables from .env before DB imports

from core.scanner import get_local_hardware
from steam_parser import fetch_steam_specs_by_name

# Check both ../database and ../../database to handle nested project folders
base_dir = os.path.dirname(os.path.abspath(__file__))
for rel_path in (("..", "database"), ("..", "..", "database")):
    candidate = os.path.abspath(os.path.join(base_dir, *rel_path))
    if os.path.exists(candidate) and candidate not in sys.path:
        sys.path.insert(0, candidate)

try:
    from database import get_connection  # type: ignore
except ImportError:
    get_connection = None

try:
    from ebay_api import get_price  # type: ignore
except ImportError:
    get_price = None

app = FastAPI(
    title="NextSpec API",
    version="1.2",
    description="Backend API for NextSpec, a PC hardware diagnostic and recommendation tool."
)

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOCAL SAVE DIR & TELEMETRY CACHE ---
SAVE_DIR = os.path.join(base_dir, "local_saves")
os.makedirs(SAVE_DIR, exist_ok=True)
LAST_SCAN: dict = {}

# --- MOCK DATABASE (Presentation Fail-Safe with Reference Pricing) ---
MOCK_DB = {
    "12th Gen Intel(R) Core(TM) i7-12700K": {"raw_score": 34650, "type": "cpu", "tdp": 125, "price": 279.99},
    "NVIDIA GeForce RTX 4070": {"raw_score": 26980, "type": "gpu", "tdp": 200, "price": 549.99},
    "12th Gen Intel(R) Core(TM) i7-1260P": {"raw_score": 17150, "type": "cpu", "tdp": 28, "price": 320.00},
    "12th Gen Intel(R) Core(TM) i7-1260p": {"raw_score": 17150, "type": "cpu", "tdp": 28, "price": 320.00},
    "Intel(R) Iris(R) Xe Graphics": {"raw_score": 2800, "type": "gpu", "tdp": 15, "price": 0.00},
    "Intel Iris Xe Graphics": {"raw_score": 2800, "type": "gpu", "tdp": 15, "price": 0.00},
    "Intel Core i3-8100": {"raw_score": 6000, "type": "cpu", "tdp": 65, "price": 65.00},
    "NVIDIA GTX 1060": {"raw_score": 10000, "type": "gpu", "tdp": 120, "price": 110.00}
}

SCORE_MIN = 2000
SCORE_MAX = 34000


# --- SCORE NORMALIZATION ---
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


# --- PART NAME CLEANING ---
def clean_part_name(kind: str, raw: str) -> str:
    """Standardizes WMI names to match PassMark database entries."""
    name = re.sub(r"\((R|TM)\)", "", raw, flags=re.IGNORECASE)
    name = re.sub(r"\b\d+(st|nd|rd|th) Gen\b", "", name)
    name = re.sub(r"\s+CPU\s*@.*$", "", name)
    name = re.sub(r"\s+\d+-Core Processor.*$", "", name)
    if kind == "gpu":
        name = re.sub(r"^(NVIDIA|AMD)\s+", "", name)
    return re.sub(r"\s+", " ", name).strip()


# --- FIND PART IN DATABASE ---
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


# --- SAFE DATABASE LOOKUP ---
def safe_find_part(kind: str, scanned_name: str):
    """Safe wrapper around find_part to prevent database errors from crashing the scan."""
    try:
        return find_part(kind, scanned_name)
    except Exception as e:
        print(f"DB lookup failed for {kind} '{scanned_name}': {e}")
        return None


# --- FIND UPGRADE ---
def find_upgrade(kind: str, current_raw: int, current_name: str, min_gain: float = 1.15, max_budget: Optional[float] = None):
    """Best performance-per-dollar part faster than current_raw, filtered by budget when provided."""
    if not get_connection:
        return None
    cfg = PART_TABLES[kind]
    params: list = [current_raw * min_gain]
    same_socket = ""
    if kind == "cpu":
        filters += " AND socket = (SELECT socket FROM cpu_benchmarks WHERE cpu_name = %s)"
        params.append(current_name)

    with get_connection() as conn:
        row = conn.execute(
            f"""SELECT {cfg['name_col']}, {cfg['perf_col']}, price
                FROM {cfg['table']}
                WHERE {filters}
                ORDER BY {cfg['perf_col']}::float / price DESC LIMIT 1""",
            params,
        ).fetchone()
    if row is None:
        return None
    return {"db_name": row[0], "raw_score": row[1], "list_price": float(row[2])}


# --- RAM SCORE & UPGRADE ---
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


# --- RAM UPGRADE RECOMMENDATION ---
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


# --- PSU RECOMMENDATION ---
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


# --- LIVE EBAY PRICING ---
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


# --- BENCHMARK CATALOG & DYNAMIC BOOST CALCULATION ---
HARDWARE_CATALOG = [
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4090", "raw_score": 38900, "price": 1599.99},
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4080 Super", "raw_score": 34650, "price": 999.99},
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4070 Ti Super", "raw_score": 31850, "price": 799.99},
    {"type": "gpu", "name": "AMD Radeon RX 7900 XTX", "raw_score": 31500, "price": 899.99},
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4070 Super", "raw_score": 30150, "price": 599.99},
    {"type": "gpu", "name": "AMD Radeon RX 7800 XT", "raw_score": 24350, "price": 479.99},
    {"type": "gpu", "name": "NVIDIA GeForce RTX 4060", "raw_score": 19580, "price": 299.99},
    {"type": "gpu", "name": "NVIDIA GeForce RTX 3060", "raw_score": 17100, "price": 279.99},
    {"type": "gpu", "name": "AMD Radeon RX 6600", "raw_score": 14950, "price": 199.99},
    {"type": "gpu", "name": "NVIDIA GeForce GTX 1660 Super", "raw_score": 12750, "price": 169.99},
    {"type": "cpu", "name": "Intel Core i9-14900K", "raw_score": 60100, "price": 529.99},
    {"type": "cpu", "name": "Intel Core i7-14700K", "raw_score": 53200, "price": 389.99},
    {"type": "cpu", "name": "Intel Core i7-13700K", "raw_score": 46450, "price": 349.99},
    {"type": "cpu", "name": "AMD Ryzen 7 7800X3D", "raw_score": 34280, "price": 389.99},
    {"type": "cpu", "name": "Intel Core i5-12600K", "raw_score": 27600, "price": 175.00},
    {"type": "cpu", "name": "AMD Ryzen 5 5600X", "raw_score": 21800, "price": 145.00},
    {"type": "ram", "name": "Corsair Vengeance 32GB DDR5-6000", "raw_score": 100, "price": 99.99},
    {"type": "ram", "name": "Corsair Vengeance 32GB DDR4-3600", "raw_score": 78, "price": 65.00}
]


def resolve_part_benchmark(kind: str, part_name: str) -> tuple[int, float]:
    """
    Resolves (raw_score, price) from Neon DB first, then MOCK_DB, then HARDWARE_CATALOG.
    """
    clean_name = part_name.strip()
    if kind in PART_TABLES:
        db_row = safe_find_part(kind, clean_name)
        if db_row and db_row.get("raw_score"):
            price, _ = safe_price(kind, db_row)
            return int(db_row["raw_score"]), float(price or db_row.get("list_price") or 0.0)

    if clean_name in MOCK_DB:
        entry = MOCK_DB[clean_name]
        return int(entry["raw_score"]), float(entry.get("price", 0.0))

    norm_query = clean_part_name(kind, clean_name).lower()
    for item in HARDWARE_CATALOG:
        if item["type"] == kind:
            item_norm = clean_part_name(kind, item["name"]).lower()
            if norm_query in item_norm or item_norm in norm_query:
                return int(item["raw_score"]), float(item["price"])

    return 0, 0.0

CATALOG_CACHE: dict = {}

def get_enriched_catalog(current_cpu: str = "", current_gpu: str = "") -> list[dict]:
    """
    Syncs HARDWARE_CATALOG with Neon DB benchmark scores and prices, and dynamically
    calculates real performance_boost (% gain) against the user's current hardware.
    """

    cache_key = f"{current_cpu.strip()}|{current_gpu.strip()}"
    if cache_key in CATALOG_CACHE:
        return CATALOG_CACHE[cache_key]


    cpu_raw, _ = resolve_part_benchmark("cpu", current_cpu) if current_cpu else (0, 0.0)
    gpu_raw, _ = resolve_part_benchmark("gpu", current_gpu) if current_gpu else (0, 0.0)

    enriched = []
    for item in HARDWARE_CATALOG:
        kind = item["type"]
        raw_score = item["raw_score"]
        price = item["price"]

        if kind in PART_TABLES:
            db_match = safe_find_part(kind, item["name"])
            if db_match:
                raw_score = int(db_match.get("raw_score") or raw_score)
                live_p, _ = safe_price(kind, db_match)
                if live_p is not None:
                    price = float(live_p)

        baseline_raw = cpu_raw if kind == "cpu" else (gpu_raw if kind == "gpu" else 65)
        gain_pct = round(((raw_score - baseline_raw) / baseline_raw) * 100) if baseline_raw > 0 else 0
        boost_label = f"+{gain_pct}%" if gain_pct > 0 else f"{gain_pct}%"

        enriched.append({
            "type": kind,
            "name": item["name"],
            "raw_score": raw_score,
            "normalized_score": normalize_score(raw_score) if kind in ("cpu", "gpu") else round(min(10.0, raw_score / 10), 1),
            "price": round(float(price), 2),
            "gain_pct": gain_pct,
            "performance_boost": boost_label,
            "is_upgrade": gain_pct > 5
        })

    CATALOG_CACHE[cache_key] = enriched
    return enriched


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
    cpu_name: Optional[str] = None
    gpu_name: Optional[str] = None
    ram_gb: Optional[int] = None


class SaveBuild(BaseModel):
    profile_name: str
    cpu: str
    gpu: str
    total_cost_usd: float
    ram_gb: Optional[int] = 32
    storage_gb: Optional[int] = 512
    upgraded_part: Optional[str] = None
    upgraded_category: Optional[str] = None
    new_score: Optional[int] = None
    perf_gain_pct: Optional[int] = None


# --- ROUTES ---
@app.get("/")
def read_root():
    return {"status": "NextSpec Backend is online and routing correctly."}


# --- DIAGNOSTIC SCAN ROUTE ---
@app.get("/api/scan", response_model=ScanResponse)
def run_diagnostic_scan():
    hardware = get_local_hardware()
    scanned_cpu = hardware.get("cpu", "Unknown CPU").strip()
    scanned_gpu = hardware.get("gpu", "Unknown GPU").strip()
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

    LAST_SCAN.update({
        "cpu": scanned_cpu,
        "gpu": scanned_gpu,
        "ram_gb": scanned_ram,
        "bottleneck": bottleneck,
        "overall_score": overall_score,
    })

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
                watts: int | None = None, budget: int | None = None):
    cpu_clean = cpu.strip()
    gpu_clean = gpu.strip()
    cpu_part = safe_find_part("cpu", cpu_clean)
    gpu_part = safe_find_part("gpu", gpu_clean)

    outdated = False
    cpu_price = None
    gpu_price = None

    if cpu_part:
        cpu_price, live = safe_price("cpu", cpu_part)
        outdated = outdated or (not live and cpu_price is not None)
    if cpu_price is None and cpu_clean in MOCK_DB:
        cpu_price = MOCK_DB[cpu_clean].get("price")
        outdated = True

    if gpu_part:
        gpu_price, live = safe_price("gpu", gpu_part)
        outdated = outdated or (not live and gpu_price is not None)
    if gpu_price is None and gpu_clean in MOCK_DB:
        gpu_price = MOCK_DB[gpu_clean].get("price")
        outdated = True

    current_value = round(cpu_price + gpu_price, 2) if cpu_price is not None and gpu_price is not None else None

    if target.lower() == "none":
        return {
            "success": True,
            "current_value": current_value,
            "upgraded_value": current_value,
            "perf_gain_pct": 0,
            "upgrade": None,
            "prices_outdated": outdated,
            "ram_upgrade": None,
            "psu_pick": None,
        }

    kind = "cpu" if target == "cpu" else "gpu"
    target_part = cpu_part if kind == "cpu" else gpu_part
    upgrade = None
    upgraded_value = current_value
    perf_gain_pct = 0

    if target_part:
        try:
            pick = find_upgrade(kind, target_part["raw_score"], target_part["db_name"], min_gain=1.10, max_budget=budget)
            if pick is None:
                pick = find_upgrade(kind, target_part["raw_score"], target_part["db_name"], min_gain=1.10, max_budget=None)
        except Exception as e:
            print(f"Upgrade lookup failed: {e}")
            pick = None

        if pick:
            new_price, live = safe_price(kind, pick)
            outdated = outdated or (not live and new_price is not None)
            perf_gain_pct = round((pick["raw_score"] / target_part["raw_score"] - 1) * 100)
            old_price = cpu_price if kind == "cpu" else gpu_price
            if current_value is not None and old_price is not None and new_price is not None:
                upgraded_value = round(current_value - old_price + new_price, 2)
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
            ram_upgrade = {"name": ram_pick["db_name"], "price": ram_price, "capacity_gb": ram_pick["capacity_gb"]}

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


# --- ENRICHED CATALOG ROUTE ---
@app.get("/api/catalog")
def get_hardware_catalog(cpu: Optional[str] = None, gpu: Optional[str] = None):
    return {"success": True, "catalog": get_enriched_catalog(cpu or "", gpu or "")}


# --- QUICK UPGRADE ROUTE ---
@app.get("/api/quick-upgrades")
def get_quick_upgrades(budget: int, bottleneck: str, cpu: Optional[str] = None, gpu: Optional[str] = None):
    btnk = bottleneck.strip().lower()
    if btnk in ("none", "unknown", ""):
        return {
            "success": True,
            "budget": budget,
            "no_upgrade_needed": True,
            "recommendations": []
        }

    current_name = ((cpu if btnk == "cpu" else gpu) or "").strip()
    current_raw, _ = resolve_part_benchmark(btnk, current_name)
    if current_raw == 0:
        current_raw = 15000

    recs = []
    if get_connection and btnk in PART_TABLES:
        cfg = PART_TABLES[btnk]
        try:
            with get_connection() as conn:
                socket_clause = ""
                params: list = [int(current_raw * 1.10), budget]
                if btnk == "cpu" and current_name:
                    db_cpu = safe_find_part("cpu", current_name)
                    if db_cpu:
                        socket_clause = " AND socket = (SELECT socket FROM cpu_benchmarks WHERE cpu_name = %s)"
                        params.append(db_cpu["db_name"])

                rows = conn.execute(
                    f"""SELECT {cfg['name_col']}, {cfg['perf_col']}, price
                        FROM {cfg['table']}
                        WHERE {cfg['perf_col']} >= %s AND price IS NOT NULL AND price > 0 AND price <= %s{socket_clause}
                        ORDER BY {cfg['perf_col']}::float / price DESC LIMIT 3""",
                    params,
                ).fetchall()

                for r in rows:
                    gain_pct = round(((r[1] - current_raw) / max(1, current_raw)) * 100)
                    recs.append({
                        "type": btnk,
                        "name": r[0],
                        "raw_score": int(r[1]),
                        "normalized_score": normalize_score(int(r[1])),
                        "price": round(float(r[2]), 2),
                        "gain_pct": gain_pct,
                        "performance_boost": f"+{gain_pct}%"
                    })
        except Exception as e:
            print(f"Quick upgrades DB query failed: {e}")

    if not recs:
        catalog = get_enriched_catalog(cpu or "", gpu or "")
        recs = [
            item for item in catalog
            if item["type"] == btnk and item["is_upgrade"] and item["price"] <= budget
        ]
        recs.sort(key=lambda x: x["gain_pct"], reverse=True)

    return {
        "success": True,
        "budget": budget,
        "no_upgrade_needed": len(recs) == 0,
        "recommendations": recs[:3]
    }


# --- AI ADVISOR (BENCHMARK-SCORE VERIFIED OLLAMA + PERSISTENT CACHE) ---
AI_CACHE_FILE = os.path.join(SAVE_DIR, "ai_cache.json")


def load_ai_cache() -> dict:
    if os.path.exists(AI_CACHE_FILE):
        try:
            with open(AI_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_ai_cache(cache: dict):
    try:
        with open(AI_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"Failed to write AI cache: {e}")


AI_CACHE = load_ai_cache()
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


def query_local_ollama(prompt: str) -> Optional[str]:
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "2h",
        "options": {
            "temperature": 0.2,
            "num_predict": 110
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "").strip() or None
    except Exception as e:
        print(f"Local Ollama unavailable: {e}")
        return None


def is_score_valid_advice(ai_text: str, cpu_raw: int, gpu_raw: int, overall_score: int, btnk: str) -> bool:
    """
    Validates Ollama output using real PassMark benchmark scores rather than hardcoded
    part blacklists: rejects any mentioned GPU/CPU whose score is <= the user's current hardware.
    """
    if not ai_text:
        return False

    gpu_mentions = re.findall(r"\b((?:RTX|GTX|RX|Arc)\s*\d{3,4}(?:\s*(?:Ti|SUPER|XT|XTX|GRE))?)\b", ai_text, flags=re.IGNORECASE)
    cpu_mentions = re.findall(r"\b((?:i[3579]-|Ryzen\s+[3579]\s+)\d{4,5}[A-Za-z0-9]*)\b", ai_text, flags=re.IGNORECASE)

    for gpu_name in gpu_mentions:
        mentioned_raw, _ = resolve_part_benchmark("gpu", gpu_name)
        if mentioned_raw > 0 and mentioned_raw <= gpu_raw:
            return False

    for cpu_name in cpu_mentions:
        mentioned_raw, _ = resolve_part_benchmark("cpu", cpu_name)
        if mentioned_raw > 0 and mentioned_raw <= cpu_raw:
            return False

    if btnk.lower() == "none" and overall_score >= 80 and not gpu_mentions and not cpu_mentions:
        if "upgrading your" in ai_text.lower() or "recommend upgrading" in ai_text.lower():
            return False

    return True


@app.post("/api/advisor")
def get_ai_hardware_advice(request: ConsultationRequest):
    if not LAST_SCAN:
        try:
            run_diagnostic_scan()
        except Exception:
            pass

    cpu_label = (request.cpu_name or LAST_SCAN.get("cpu") or "Intel Core i7-12700K").strip()
    gpu_label = (request.gpu_name or LAST_SCAN.get("gpu") or "NVIDIA GeForce RTX 4070").strip()
    ram_total = request.ram_gb or LAST_SCAN.get("ram_gb") or 32

    cpu_raw, _ = resolve_part_benchmark("cpu", cpu_label)
    gpu_raw, _ = resolve_part_benchmark("gpu", gpu_label)
    cpu_score = normalize_score(cpu_raw) if cpu_raw else 9.0
    gpu_score = normalize_score(gpu_raw) if gpu_raw else 8.8
    overall_score = LAST_SCAN.get("overall_score") or int(((cpu_score + gpu_score) / 2) * 10)

    raw_btnk = str(request.current_bottleneck or "").strip()
    btnk = LAST_SCAN.get("bottleneck", "None") if raw_btnk.lower() in ("", "unknown") else raw_btnk

    steam_data = {}
    if request.game_name:
        steam_data = fetch_steam_specs_by_name(request.game_name) or {}

    if request.game_name and isinstance(steam_data, dict):
        min_specs = steam_data.get("minimum", {})
        steam_gpu = min_specs.get("graphics", "Unknown GPU") if isinstance(min_specs, dict) else "Unknown GPU"
        game_title = steam_data.get("game_name") or request.game_name
        goal_line = f"play {game_title} (minimum GPU: {steam_gpu})"
    else:
        goal_line = f"{request.purpose or 'Gaming'}"
        if request.target_fps and request.target_resolution:
            goal_line += f" at {request.target_fps} FPS ({request.target_resolution})"

    cache_key = f"{request.game_name}_{request.purpose}_{request.budget}_{btnk}_{request.target_fps}_{request.target_resolution}_{cpu_label}_{gpu_label}"
    if cache_key in AI_CACHE:
        return {
            "success": True,
            "game_scraped": steam_data.get("game_name") if isinstance(steam_data, dict) else None,
            "steam_requirements": steam_data,
            "ai_insight": AI_CACHE[cache_key]
        }

    catalog = get_enriched_catalog(cpu_label, gpu_label)
    target_kind = "cpu" if btnk.lower() == "cpu" else "gpu"
    valid_upgrades = [
        item for item in catalog
        if item["type"] == target_kind and item["is_upgrade"] and item["price"] <= request.budget
    ]
    valid_upgrades.sort(key=lambda x: x["raw_score"], reverse=True)
    top_pick = valid_upgrades[0] if valid_upgrades else None

    is_optimal = btnk.lower() == "none" and overall_score >= 80
    if is_optimal and not top_pick:
        prompt = (
            f"You are NextSpec AI. The user's PC scores {overall_score}/100 ({cpu_label} at {cpu_score}/10, {gpu_label} at {gpu_score}/10, {ram_total}GB RAM) "
            f"with zero bottlenecks. Their goal is {goal_line} with a ${request.budget} budget. "
            f"In two brief sentences, confirm their system score ({overall_score}/100) already exceeds {goal_line} and advise saving their ${request.budget} budget."
        )
    elif top_pick:
        prompt = (
            f"You are NextSpec AI. The user's PC scores {overall_score}/100 ({cpu_label} at {cpu_score}/10, {gpu_label} at {gpu_score}/10). "
            f"For {goal_line} within ${request.budget}, recommend upgrading to the {top_pick['name']} (${top_pick['price']}, {top_pick['performance_boost']} performance gain, {top_pick['normalized_score']}/10 score) in two brief sentences."
        )
    else:
        prompt = (
            f"You are NextSpec AI. The user's PC has a {cpu_label} ({cpu_score}/10) and {gpu_label} ({gpu_score}/10) with a {btnk} bottleneck for {goal_line}. "
            f"Explain in two brief sentences that no {btnk} outperforming their current score fits within ${request.budget} and advise raising the budget."
        )

    ai_text = query_local_ollama(prompt)

    if not is_score_valid_advice(ai_text or "", cpu_raw, gpu_raw, overall_score, btnk):
        if is_optimal and not top_pick:
            ai_text = (
                f"Your {cpu_label} ({cpu_score}/10) and {gpu_label} ({gpu_score}/10) achieve a {overall_score}/100 optimal score with no bottlenecks and already exceed {goal_line}. "
                f"No upgrade is needed—save your ${request.budget} budget until you step up to a higher-tier generational card."
            )
        elif top_pick:
            ai_text = (
                f"Upgrading to the {top_pick['name']} (${top_pick['price']}, {top_pick['normalized_score']}/10 rating) delivers a {top_pick['performance_boost']} benchmark gain over your current hardware. "
                f"This fits within your ${request.budget} budget and directly optimizes performance for {goal_line}."
            )
        else:
            ai_text = (
                f"Your {btnk} is limiting performance for {goal_line}, but no higher-scoring {btnk} benchmarked above your current hardware fits under ${request.budget}. "
                f"Increasing your budget slightly will unlock a true next-tier upgrade."
            )

    AI_CACHE[cache_key] = ai_text
    save_ai_cache(AI_CACHE)

    return {
        "success": True,
        "game_scraped": steam_data.get("game_name") if isinstance(steam_data, dict) else None,
        "steam_requirements": steam_data,
        "ai_insight": ai_text
    }


# --- SAVE / LIST / LOAD / DELETE BUILD ROUTES ---
@app.post("/api/save-build")
def save_build(build: SaveBuild):
    safe_name = re.sub(r"[^a-zA-Z0-9_\- ]", "", build.profile_name).strip() or "My_NextSpec_Build"
    file_path = os.path.join(SAVE_DIR, f"{safe_name.replace(' ', '_')}.json")
    payload = build.model_dump()
    payload["profile_name"] = safe_name
    payload["file_path"] = os.path.abspath(file_path)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4)
        return {"success": True, "message": f"Build saved locally to {file_path}", "build": payload}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/saved-builds")
def list_saved_builds():
    builds = []
    if os.path.exists(SAVE_DIR):
        for fname in sorted(os.listdir(SAVE_DIR), key=lambda f: os.path.getmtime(os.path.join(SAVE_DIR, f)), reverse=True):
            if fname.endswith(".json") and fname != "ai_cache.json":
                fpath = os.path.join(SAVE_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        builds.append(json.load(f))
                except Exception:
                    continue
    return {"success": True, "builds": builds}


@app.get("/api/load-build/{profile_name}")
def load_build(profile_name: str):
    file_path = os.path.join(SAVE_DIR, f"{profile_name.replace(' ', '_')}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Build profile not found.")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            build_data = json.load(f)
        return {"success": True, "data": build_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/saved-builds/{profile_name}")
def delete_saved_build(profile_name: str):
    safe_name = re.sub(r"[^a-zA-Z0-9_\- ]", "", profile_name).strip().replace(" ", "_")
    file_path = os.path.join(SAVE_DIR, f"{safe_name}.json")
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"success": True}
    raise HTTPException(status_code=404, detail="Saved build not found.")


# --- PARTS SEARCH ROUTE ---
@app.get("/api/parts/search")
def search_components(q: str, category: str = "all"):
    """
    Searches Neon DB (CPU, GPU, RAM, PSU) + live eBay pricing for any user-typed component.
    Falls back to enriched catalog with real benchmark scores if DB is unavailable.
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

    # Enriched catalog fallback with real PassMark scores
    if not results:
        for item in get_enriched_catalog(LAST_SCAN.get("cpu", ""), LAST_SCAN.get("gpu", "")):
            if query.lower() in item["name"].lower() and (cat == "all" or item["type"] == cat):
                results.append({
                    "category": item["type"].upper(),
                    "name": item["name"],
                    "benchmark": f"{item['raw_score']} Score ({item['normalized_score']}/10)",
                    "spec": "Database Benchmark Reference",
                    "price": float(item["price"]),
                    "is_live": False
                })

    return {"success": True, "results": results[:12]}