import os
import re
import time
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from database import get_connection
 
load_dotenv()
 
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")
EBAY_ENV = os.getenv("EBAY_ENV", "https://api.ebay.com")
PRICE_CACHE_DAYS = int(os.getenv("PRICE_CACHE_DAYS", "7"))
 
# Maps the "cpu"/"gpu" you pass in to the real table/column names in your schema.
# category_id restricts eBay search to the right part of the site (164 = CPUs/Processors,
# can't outrank an actual card. min_price is a sanity floor to reject obvious junk
# listings (empty boxes, broken-for-parts, decals) that happen to be in-category.
GPU_EXCLUDE_TERMS = [
    "fan", "shroud", "backplate", "bracket", "heatsink", "cooler",
    "replacement", "repair", "broken", "box", "empty", "sticker",
    "decal", "cable", "adapter", "mount", "case", "sleeve", "skin",
    "bridge", "nvlink", "sli", "riser", "extension", "waterblock",
    "frame", "support", "holder", "stand",
]
 
GPU_REQUIRE_PATTERN = r"\d+\s?gb"
CPU_EXCLUDE_TERMS = [
    "cooler", "heatsink", "bracket", "socket", "replacement", "repair",
    "broken", "box", "empty", "sticker", "decal", "case", "stand", "mount",
]
 
TABLE_CONFIG = {
    "cpu": {"table": "cpu_benchmarks", "name_col": "cpu_name", "perf_col": "cpu_mark",
            "category_id": "164", "min_price": 15, "exclude_terms": CPU_EXCLUDE_TERMS,
            "require_pattern": None},
    "gpu": {"table": "gpu_benchmarks", "name_col": "gpu_name", "perf_col": "g3d_mark",
            "category_id": "27386", "min_price": 25, "exclude_terms": GPU_EXCLUDE_TERMS,
            "require_pattern": GPU_REQUIRE_PATTERN},
}
 
_token_cache = {"token": None, "expires_at": 0}
 
 
def _get_token():
    """OAuth client-credentials token, cached in memory until it's close to expiring."""
    if _token_cache["token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["token"]
 
    if not (EBAY_CLIENT_ID and EBAY_CLIENT_SECRET):
        raise RuntimeError("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set in .env")
 
    resp = requests.post(
        f"{EBAY_ENV}/identity/v1/oauth2/token",
        auth=(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        },
        timeout=10,
    )
    resp.raise_for_status()
    payload = resp.json()
    _token_cache["token"] = payload["access_token"]
    _token_cache["expires_at"] = time.time() + payload.get("expires_in", 7200) - 60
    return _token_cache["token"]
 
 
def _title_matches(query: str, title: str) -> bool:

    query_words = re.findall(r"\w+", query.lower())
    title_lower = title.lower()
    return all(re.search(rf"\b{re.escape(word)}\b", title_lower) for word in query_words)
 
 
def _has_ambiguous_model_numbers(title: str) -> bool:
    
    model_numbers = set(re.findall(r"\b\d{4}\b", title))
    return len(model_numbers) > 1
 
 
def fetch_ebay_price(query: str, category_id: str, min_price: float, exclude_terms=None, require_pattern=None):
    """
    Returns (price, url) for the cheapest plausible fixed-price match, or None.
    Restricts to the given eBay category, excludes "for parts/not working"
    listings and common accessory keywords (fans, brackets, heatsinks, etc,
    which share a product title with the real part), then fetches several
    candidates sorted by lowest price and returns the first one that also
    clears min_price as a final sanity check.
    """
    token = _get_token()
    search_text = query
    if exclude_terms:
        search_text += " " + " ".join(f"-{t}" for t in exclude_terms)
 
    resp = requests.get(
        f"{EBAY_ENV}/buy/browse/v1/item_summary/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "q": search_text,
            "category_ids": category_id,

            "filter": "buyingOptions:{FIXED_PRICE},conditionIds:{1000|1500|2000|2500|3000}",

            "limit": 30,
        },
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json().get("itemSummaries", [])
 
    valid_candidates = []
    for item in items:
        title = item.get("title", "")
        if not _title_matches(query, title):
            continue
        if require_pattern and not re.search(require_pattern, title.lower()):
            continue
        if _has_ambiguous_model_numbers(title):
            continue
        price = item.get("price", {}).get("value")
        if price is None:
            continue
        price = float(price)
        if price < min_price:
            continue
        valid_candidates.append((price, item.get("itemWebUrl")))
 
    if not valid_candidates:
        return None
 
    return min(valid_candidates, key=lambda c: c[0])
 
 
def _is_fresh(updated_at):
    if not updated_at:
        return False
    return datetime.now(timezone.utc) - updated_at < timedelta(days=PRICE_CACHE_DAYS)
 
 
def get_price(kind: str, item_name: str):
    """
    kind: "cpu" or "gpu"
    item_name: exact value stored in cpu_name / gpu_name
    Returns {"price": float|None, "value": float|None, "source": str|None, "cached": bool}
    or None if the item isn't in the database at all.
    """
    if kind not in TABLE_CONFIG:
        raise ValueError("kind must be 'cpu' or 'gpu'")
    cfg = TABLE_CONFIG[kind]
    table, name_col, perf_col = cfg["table"], cfg["name_col"], cfg["perf_col"]
    category_id, min_price = cfg["category_id"], cfg["min_price"]
    exclude_terms = cfg["exclude_terms"]
    require_pattern = cfg["require_pattern"]
 
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT {perf_col}, live_price, live_value, price_source, price_updated_at
                FROM {table} WHERE {name_col} = %s
                """,
                (item_name,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            perf, live_price, live_value, price_source, updated_at = row
 
            if live_price is not None and _is_fresh(updated_at):
                return {
                    "price": float(live_price),
                    "value": float(live_value) if live_value is not None else None,
                    "source": price_source,
                    "cached": True,
                }
 
            result = fetch_ebay_price(item_name, category_id, min_price, exclude_terms, require_pattern)
            if result is None:
                cur.execute(
                    f"UPDATE {table} SET price_updated_at = %s WHERE {name_col} = %s",
                    (datetime.now(timezone.utc), item_name),
                )
                conn.commit()
                return {
                    "price": float(live_price) if live_price is not None else None,
                    "value": float(live_value) if live_value is not None else None,
                    "source": price_source,
                    "cached": False,
                }
 
            price, url = result
            value = (perf / price) if (perf and price) else None
 
            cur.execute(
                f"""
                UPDATE {table}
                SET live_price = %s, live_value = %s, price_source = %s,
                    price_url = %s, price_updated_at = %s
                WHERE {name_col} = %s
                """,
                (price, value, "ebay", url, datetime.now(timezone.utc), item_name),
            )
            conn.commit()
 
            return {"price": price, "value": value, "source": "ebay", "cached": False}
    finally:
        conn.close()
 
 
if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print('Usage: python ebay_api.py <cpu|gpu> "<item name>"')
        sys.exit(1)
    print(get_price(sys.argv[1], sys.argv[2]))
 





















