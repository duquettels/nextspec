import collections
import csv
import math
import os
import re
import sys
 
from database import DATABASE_URL, get_connection
 
HERE = os.path.dirname(os.path.abspath(__file__))
 
LIVE_COLUMNS = """
    live_price NUMERIC(10, 2),
    live_value NUMERIC(10, 2),
    price_source TEXT,
    price_url TEXT,
    price_updated_at TIMESTAMPTZ"""
 
CREATE_RAM = f"""
CREATE TABLE IF NOT EXISTS ram_specs (
    id BIGSERIAL PRIMARY KEY,
    ram_name TEXT NOT NULL UNIQUE,      -- unique label, e.g. 'Corsair Vengeance RGB 32 GB DDR5-6000 CL36 (2x16GB)'
    base_name TEXT NOT NULL,            -- product name from the CSV
    ddr_type TEXT NOT NULL,             -- DDR2, DDR3, DDR4 or DDR5
    speed_mts INTEGER NOT NULL,         -- transfer speed, e.g. 6000
    modules INTEGER NOT NULL,           -- number of sticks in the kit
    module_gb INTEGER NOT NULL,         -- size of one stick
    capacity_gb INTEGER NOT NULL,       -- whole kit
    cas_latency INTEGER NOT NULL,
    latency_ns NUMERIC(6, 2) NOT NULL,  -- lower is better
    bandwidth_gbs NUMERIC(7, 1) NOT NULL,  -- theoretical peak, higher is better
    memory_score INTEGER NOT NULL,      -- calculated, see load_ram_psu.py. 100 = DDR5-6000 CL30 dual channel
    price NUMERIC(10, 2),               -- lowest list price in the CSV (often empty)
    {LIVE_COLUMNS}
);
CREATE INDEX IF NOT EXISTS ram_specs_type_capacity_idx ON ram_specs (ddr_type, capacity_gb);
"""
 
CREATE_PSU = f"""
CREATE TABLE IF NOT EXISTS psu_specs (
    id BIGSERIAL PRIMARY KEY,
    psu_name TEXT NOT NULL UNIQUE,      -- unique label, e.g. 'Corsair RM850x 850W'
    base_name TEXT NOT NULL,            -- product name from the CSV
    wattage INTEGER NOT NULL,           -- PSUs have no benchmark, so this is the performance number
    efficiency TEXT,                    -- '80+ Gold' and so on, empty if unknown
    modular TEXT,                       -- Full, Semi or No
    form_factor TEXT,                   -- ATX, SFX, TFX, Flex ATX, Mini ITX
    price NUMERIC(10, 2),
    {LIVE_COLUMNS}
);
CREATE INDEX IF NOT EXISTS psu_specs_wattage_idx ON psu_specs (wattage);
"""
 
RAM_COLUMNS = ["ram_name", "base_name", "ddr_type", "speed_mts", "modules", "module_gb",
               "capacity_gb", "cas_latency", "latency_ns", "bandwidth_gbs", "memory_score", "price"]
PSU_COLUMNS = ["psu_name", "base_name", "wattage", "efficiency", "modular", "form_factor", "price"]
 
REF_BANDWIDTH = 96.0  # GB/s, dual channel DDR5-6000
REF_LATENCY = 10.0    # ns, DDR5-6000 CL30
 
EFFICIENCY = {"plus": "80+", "bronze": "80+ Bronze", "silver": "80+ Silver", "gold": "80+ Gold",
              "platinum": "80+ Platinum", "titanium": "80+ Titanium"}
 
 
def to_float(value):
    value = (value or "").strip().replace("$", "").replace(",", "")
    try:
        return float(value)
    except ValueError:
        return None
 
 
def to_price(value):
    price = to_float(value)
    return price if price is not None and price > 0 else None
 
 
def lowest(a, b):
    """Lowest of two prices where either can be None."""
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)
 
 
def memory_score(speed_mts, modules, cas):
    bandwidth = speed_mts * 8 / 1000 * min(modules, 2)
    latency = cas * 2000 / speed_mts
    score = round(100 * math.sqrt((bandwidth / REF_BANDWIDTH) * (REF_LATENCY / latency)))
    return bandwidth, latency, score
 
 
def parse_ram(path):
    skipped = collections.Counter()
    variants = {}
    total = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            total += 1
            name = (r.get("name") or "").strip()
            speed = re.fullmatch(r"([2-5]),(\d+)", (r.get("speed") or "").strip())
            kit = re.fullmatch(r"(\d+),(\d+)", (r.get("modules") or "").strip())
            cas = to_float(r.get("cas_latency"))
            if not name:
                skipped["no name"] += 1
                continue
            if not speed:
                skipped["speed is not in the 'DDR generation,speed' form"] += 1
                continue
            if not kit:
                skipped["modules is not in the 'count,size' form"] += 1
                continue
            gen, mts = int(speed[1]), int(speed[2])
            count, size = int(kit[1]), int(kit[2])
            if count < 1 or not 1 <= size <= 256:
                skipped["stick smaller than 1 GB"] += 1
                continue
            if cas is None or cas <= 0 or cas != int(cas):
                skipped["CAS latency missing or not a whole number"] += 1
                continue
            cas = int(cas)
 
            label = f"{name} DDR{gen}-{mts} CL{cas} ({count}x{size}GB)"
            price = to_price(r.get("price"))
            if label in variants:
                variants[label]["price"] = lowest(variants[label]["price"], price)
                variants[label]["rows"] += 1
                continue
            bandwidth, latency, score = memory_score(mts, count, cas)
            variants[label] = {
                "row": [label, name, f"DDR{gen}", mts, count, size, count * size, cas,
                        round(to_float(r.get("first_word_latency")) or latency, 2),
                        round(bandwidth, 1), score],
                "price": price,
                "rows": 1,
            }
    rows = [v["row"] + [v["price"]] for v in variants.values()]
    return rows, total, skipped
 
 
def parse_psu(path):
    skipped = collections.Counter()
    variants = {}
    total = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            total += 1
            name = (r.get("name") or "").strip()
            watts = to_float(r.get("wattage"))
            if not name:
                skipped["no name"] += 1
                continue
            if watts is None or watts < 50 or watts != int(watts):
                skipped["wattage missing or not a whole number"] += 1
                continue
            watts = int(watts)
            efficiency = EFFICIENCY.get((r.get("efficiency") or "").strip().lower())
            modular_raw = (r.get("modular") or "").strip().lower()
            modular = ("Full" if modular_raw.startswith("full") else
                       "Semi" if modular_raw.startswith("semi") else
                       "No" if modular_raw in ("false", "no", "non-modular") else None)
            form = (r.get("type") or "").strip() or None
            key = (name, watts, efficiency, modular, form)
            price = to_price(r.get("price"))
            if key in variants:
                variants[key]["price"] = lowest(variants[key]["price"], price)
            else:
                variants[key] = {"price": price}
 
    def base_label(name, watts):
        # names like 'EVGA 700 B1' or 'Corsair RM750x' already carry the wattage
        return name if re.search(rf"(?<!\d){watts}(?!\d)", name) else f"{name} {watts}W"
 
    by_label = collections.defaultdict(list)
    for key in variants:
        by_label[base_label(key[0], key[1])].append(key)
 
    rows, used = [], set()
    for label, keys in by_label.items():
        for key in keys:
            name, watts, efficiency, modular, form = key
            final = label
            if len(keys) > 1:  # same name and wattage, different specs: say which one
                details = ", ".join(x for x in (efficiency, modular and f"{modular} modular", form) if x)
                final = f"{label} ({details})" if details else label
            n = 2
            while final in used:  # last resort, should not happen
                final = f"{label} #{n}"
                n += 1
            used.add(final)
            rows.append([final, name, watts, efficiency, modular, form, variants[key]["price"]])
    return rows, total, skipped
 
 
def load(cur, table, columns, name_col, create_sql, rows):
    cur.execute(create_sql)
    cols = ", ".join(columns)
    cur.execute(f"CREATE TEMP TABLE stage AS SELECT {cols} FROM {table} WITH NO DATA")
    with cur.copy(f"COPY stage ({cols}) FROM STDIN") as copy:
        for row in rows:
            copy.write_row(row)
    updates = ", ".join(
        f"{c} = COALESCE(EXCLUDED.{c}, {table}.{c})" if c == "price" else f"{c} = EXCLUDED.{c}"
        for c in columns if c != name_col
    )
    cur.execute(f"INSERT INTO {table} ({cols}) SELECT {cols} FROM stage "
                f"ON CONFLICT ({name_col}) DO UPDATE SET {updates}")
    cur.execute("DROP TABLE stage")
    cur.execute(f"SELECT COUNT(*), COUNT(price) FROM {table}")
    return cur.fetchone()
 
 
def report(label, path, total, skipped, rows, counts):
    print(f"\n{label}: {os.path.basename(path)}")
    print(f"  {total} rows read, {len(rows)} unique products after merging color and duplicate rows")
    for reason, n in skipped.items():
        print(f"  skipped {n}: {reason}")
    print(f"  table now has {counts[0]} rows, {counts[1]} with a list price")
 
 
def main():
    args = sys.argv[1:]
    if len(args) not in (0, 2):
        print(__doc__)
        sys.exit(1)
    ram_path = args[0] if args else os.path.join(HERE, "memory.csv")
    psu_path = args[1] if args else os.path.join(HERE, "power-supply.csv")
    for path in (ram_path, psu_path):
        if not os.path.exists(path):
            print(f"Can't find {path}")
            print("Put memory.csv and power-supply.csv in this folder, or pass both paths.")
            sys.exit(1)
    if not DATABASE_URL:
        print("DATABASE_URL was not found. Check that database/.env exists and has it.")
        sys.exit(1)
 
    ram_rows, ram_total, ram_skipped = parse_ram(ram_path)
    psu_rows, psu_total, psu_skipped = parse_psu(psu_path)
 
    with get_connection() as conn:
        with conn.cursor() as cur:
            ram_counts = load(cur, "ram_specs", RAM_COLUMNS, "ram_name", CREATE_RAM, ram_rows)
            psu_counts = load(cur, "psu_specs", PSU_COLUMNS, "psu_name", CREATE_PSU, psu_rows)
 
    report("RAM", ram_path, ram_total, ram_skipped, ram_rows, ram_counts)
    report("PSU", psu_path, psu_total, psu_skipped, psu_rows, psu_counts)
    print("\nDone.")
 
 
if __name__ == "__main__":
    main()