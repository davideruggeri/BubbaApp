// utils/geocoding.ts
// Utility per la risoluzione automatica delle coordinate (OpenStreetMap Nominatim + Photon + cache)

const coordsCache = new Map<string, { latitude: number; longitude: number } | null>();

// Coordinate note di riferimento per le città / luoghi più frequenti dei tornei ed eventi
const PRESET_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
    'caorle': { latitude: 45.6028, longitude: 12.8794 },
    'bibione': { latitude: 45.6322, longitude: 13.0489 },
    'lignano': { latitude: 45.6908, longitude: 13.1311 },
    'lignano sabbiadoro': { latitude: 45.6908, longitude: 13.1311 },
    'jesolo': { latitude: 45.5033, longitude: 12.6464 },
    'cervia': { latitude: 44.2625, longitude: 12.3508 },
    'milano marittima': { latitude: 44.2754, longitude: 12.3582 },
    'bellaria': { latitude: 44.1481, longitude: 12.4589 },
    'igea marina': { latitude: 44.1481, longitude: 12.4589 },
    'rimini': { latitude: 44.0678, longitude: 12.5695 },
    'riccione': { latitude: 43.9992, longitude: 12.6558 },
    'misano': { latitude: 43.9781, longitude: 12.6967 },
    'cattolica': { latitude: 43.9636, longitude: 12.7428 },
    'pesaro': { latitude: 43.9125, longitude: 12.9155 },
    'fano': { latitude: 43.8407, longitude: 13.0163 },
    'senigallia': { latitude: 43.7147, longitude: 13.2181 },
    'ancona': { latitude: 43.6158, longitude: 13.5189 },
    'cesenatico': { latitude: 44.2014, longitude: 12.3995 },
    'cesena': { latitude: 44.1391, longitude: 12.2432 },
    'forli': { latitude: 44.2227, longitude: 12.0407 },
    'forlì': { latitude: 44.2227, longitude: 12.0407 },
    'ravenna': { latitude: 44.4184, longitude: 12.2035 },
    'faenza': { latitude: 44.2898, longitude: 11.8774 },
    'imola': { latitude: 44.3533, longitude: 11.7145 },
    'bologna': { latitude: 44.4949, longitude: 11.3426 },
    'modena': { latitude: 44.6471, longitude: 10.9252 },
    'reggio emilia': { latitude: 44.6983, longitude: 10.6312 },
    'parma': { latitude: 44.8015, longitude: 10.3279 },
    'ferrara': { latitude: 44.8381, longitude: 11.6198 },
    'padova': { latitude: 45.4064, longitude: 11.8768 },
    'venezia': { latitude: 45.4408, longitude: 12.3155 },
    'treviso': { latitude: 45.6669, longitude: 12.2430 },
    'vicenza': { latitude: 45.5455, longitude: 11.5354 },
    'verona': { latitude: 45.4384, longitude: 10.9916 },
    'udine': { latitude: 46.0711, longitude: 13.2346 },
    'trieste': { latitude: 45.6495, longitude: 13.7768 },
    'trento': { latitude: 46.0748, longitude: 11.1217 },
    'rovereto': { latitude: 45.8894, longitude: 11.0422 },
    'bolzano': { latitude: 46.4983, longitude: 11.3548 },
    'milano': { latitude: 45.4642, longitude: 9.1900 },
    'brescia': { latitude: 45.5416, longitude: 10.2118 },
    'bergamo': { latitude: 45.6983, longitude: 9.6773 },
    'torino': { latitude: 45.0703, longitude: 7.6869 },
    'firenze': { latitude: 43.7696, longitude: 11.2558 },
    'pisa': { latitude: 43.7228, longitude: 10.4017 },
    'lucca': { latitude: 43.8429, longitude: 10.5027 },
    'livorno': { latitude: 43.5485, longitude: 10.3106 },
    'siena': { latitude: 43.3188, longitude: 11.3308 },
    'perugia': { latitude: 43.1107, longitude: 12.3908 },
    'roma': { latitude: 41.9028, longitude: 12.4964 },
    'napoli': { latitude: 40.8518, longitude: 14.2681 },
    'bari': { latitude: 41.1171, longitude: 16.8719 },
    'palermo': { latitude: 38.1157, longitude: 13.3615 },
    'cagliari': { latitude: 39.2238, longitude: 9.1217 },
};

export function resolveKnownCoordinatesSync(
    locationName: string,
    knownSources?: Array<{
        location?: string;
        locationName?: string;
        title?: string;
        latitude?: number;
        longitude?: number;
    }>
): { latitude: number; longitude: number } | null {
    if (!locationName || !locationName.trim()) return null;

    const queryNorm = locationName.trim().toLowerCase();

    // 1. Check in-memory cache
    if (coordsCache.has(queryNorm)) {
        return coordsCache.get(queryNorm) || null;
    }

    // 2. Check preset dictionary
    for (const [key, coords] of Object.entries(PRESET_COORDINATES)) {
        if (queryNorm === key || queryNorm.includes(key) || key.includes(queryNorm)) {
            coordsCache.set(queryNorm, coords);
            return coords;
        }
    }

    // 3. Check knownSources
    if (knownSources && knownSources.length > 0) {
        for (const item of knownSources) {
            const lat = Number(item.latitude);
            const lng = Number(item.longitude);
            if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0) {
                const itemLoc = (item.locationName || item.location || item.title || '').trim().toLowerCase();
                if (itemLoc && (itemLoc === queryNorm || itemLoc.includes(queryNorm) || queryNorm.includes(itemLoc))) {
                    const coords = { latitude: lat, longitude: lng };
                    coordsCache.set(queryNorm, coords);
                    return coords;
                }
            }
        }
    }

    return null;
}

export async function resolveLocationCoordinates(
    locationName: string,
    knownSources?: Array<{
        location?: string;
        locationName?: string;
        title?: string;
        latitude?: number;
        longitude?: number;
    }>
): Promise<{ latitude: number; longitude: number } | null> {
    if (!locationName || !locationName.trim()) return null;

    // Prova prima la risoluzione sincrona
    const syncResult = resolveKnownCoordinatesSync(locationName, knownSources);
    if (syncResult) return syncResult;

    const queryNorm = locationName.trim().toLowerCase();

    // 1. OpenStreetMap Nominatim Geocoding (gratuito)
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName.trim())}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    const coords = { latitude: lat, longitude: lon };
                    coordsCache.set(queryNorm, coords);
                    return coords;
                }
            }
        }
    } catch {
        // Ignora e prova Photon fallback
    }

    // 2. Photon API (Komoot OpenStreetMap search, 100% gratuito e CORS-friendly)
    try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(locationName.trim())}&limit=1`;
        const res = await fetch(photonUrl);
        if (res.ok) {
            const data = await res.json();
            if (data?.features?.[0]?.geometry?.coordinates) {
                const [lon, lat] = data.features[0].geometry.coordinates;
                if (!isNaN(lat) && !isNaN(lon)) {
                    const coords = { latitude: Number(lat), longitude: Number(lon) };
                    coordsCache.set(queryNorm, coords);
                    return coords;
                }
            }
        }
    } catch {
        // Nessun risultato
    }

    // Salva null per evitare chiamate ripetute fallite
    coordsCache.set(queryNorm, null);
    return null;
}

export function findPlaceNameByCoords(lat: number, lng: number): string | null {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    for (const [key, coords] of Object.entries(PRESET_COORDINATES)) {
        if (Math.abs(coords.latitude - lat) < 0.06 && Math.abs(coords.longitude - lng) < 0.06) {
            return key.charAt(0).toUpperCase() + key.slice(1);
        }
    }
    return null;
}
