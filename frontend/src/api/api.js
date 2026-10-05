//API Endpoints here
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SCAN_URL = `${BASE}/api/scan`;

//function that will fetch scanned data from the backend API
export async function fetchScannedData() {
    const res = await fetch(SCAN_URL, {
        
    });
    if(!res.ok) throw new Error('Failed to fetch data from the Database');
    return res.json();
}

export async function fetchGameRequirements(gameName) {
    const encodedGameName = encodeURIComponent(gameName);

    const response = await fetch(`${BASE}/api/game/${encodedGameName}`

    );

    const result = await response.json();


    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch game requirements');
    }

    return result.data;
}