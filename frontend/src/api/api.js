//API Endpoints here
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SCAN_URL = `${BASE}/api/scan`;

//function that will fetch scanned data from the backend API
export async function fetchScannedData() {
    const res = await fetch(SCAN_URL, {
        
    });
    if(!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to fetch data from the Database');
    }
    return res.json();
}

//function that fetches live eBay prices + the best upgrade for the scanned parts
//ram and watts are optional: they add a RAM upgrade pick and a PSU pick
export async function fetchPricing(cpu, gpu, target, ram = {}, watts = null) {
    const params = new URLSearchParams({ cpu, gpu, target });
    if (ram.gb) params.set('ram_gb', ram.gb);
    if (ram.type) params.set('ram_type', ram.type);
    if (ram.speed) params.set('ram_speed', ram.speed);
    if (watts) params.set('watts', watts);
    const res = await fetch(`${BASE}/api/pricing?${params}`);
    if(!res.ok) throw new Error('Failed to fetch pricing');
    return res.json();
}