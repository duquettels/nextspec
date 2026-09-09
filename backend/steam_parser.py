import requests
from bs4 import BeautifulSoup
import re

def get_game_requirements(app_id: int):
    """
    Fetches and parses the minimum and recommended specs for a Steam game."""
    url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&cc=us&l=en"

    try:
        response = requests.get(url)
        data = response.json()

        # Steam API returns data under the app_id key
        if str(app_id) not in data or not data[str(app_id)]["success"]:
            return {"error": "Game not found or API error."}

        game_data = data[str(app_id)]["data"]
        game_name = game_data.get("name", "Unknown Game")
        pc_requirements = game_data.get("pc_requirements", {})

        # Extract raw HTML strings
        min_html = pc_requirements.get("minimum", "")
        rec_html = pc_requirements.get("recommended", "")

        return {
            "game_name": game_name,
            "minimum": extract_hardware_strings(min_html),
            "recommended": extract_hardware_strings(rec_html)
        }

    except Exception as e:
        return {"error": str(e)}

def extract_hardware_strings(html_text: str):
    """
    Strips HTML tags and parses the hardware requirements into a dictionary.
    """
    if not html_text:
        return {}

    # 1. Manually clean the formatting tags so labels and values stay on the same line
    html_text = html_text.replace("<strong>", "").replace("</strong>", "")
    html_text = html_text.replace("<br>", "\n").replace("<br/>", "\n").replace("</li>", "\n")

    # 2. Let BeautifulSoup strip any remaining stray HTML
    soup = BeautifulSoup(html_text, "html.parser")
    clean_text = soup.get_text()

    specs = {
        "processor": "Not found",
        "memory": "Not found",
        "graphics": "Not found",
        "storage": "Not found"
    }

    # 3. Parse line by line
    for line in clean_text.split('\n'):
        line = line.strip()
        line_lower = line.lower()
        
        if line_lower.startswith("processor:"):
            specs["processor"] = line.split(":", 1)[1].strip()
        elif line_lower.startswith("graphics:") or line_lower.startswith("video card:"):
            specs["graphics"] = line.split(":", 1)[1].strip()
        elif line_lower.startswith("memory:"):
            specs["memory"] = line.split(":", 1)[1].strip()
        elif line_lower.startswith("storage:"):
            specs["storage"] = line.split(":", 1)[1].strip()

    return specs

def search_game_by_name(game_name: str):
    """Searches Steam by game title and returns the best matching App ID."""
    search_url = f"https://store.steampowered.com/api/storesearch/?term={game_name}&l=english&cc=us"
    
    try:
        response = requests.get(search_url)
        data = response.json()
        
        # Check if any games matched the search term
        if data.get("total", 0) > 0:
            top_match = data["items"][0]
            return top_match["id"], top_match["name"]
            
        return None, None
    except Exception as e:
        print(f"Search error: {e}")
        return None, None

# --- Test the Script ---\
if __name__ == "__main__":
    # Let the user type a name instead of an ID
    user_query = input("Enter a game title (e.g., Cyberpunk 2077, Elden Ring, Palworld): ")
    
    print(f"Searching Steam for '{user_query}'...")
    app_id, official_name = search_game_by_name(user_query)
    
    if app_id:
        print(f"Found match: {official_name} (App ID: {app_id})")
        game_specs = get_game_requirements(app_id)
        
        import json
        print(json.dumps(game_specs, indent=4))
    else:
        print(f"❌ Could not find a Steam game matching '{user_query}'.")