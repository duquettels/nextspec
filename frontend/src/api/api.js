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