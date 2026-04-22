/**
 * Haversine formula — returns straight-line distance in kilometres
 * between two WGS-84 coordinate pairs.
 *
 * @param lat1  Latitude  of point A (degrees)
 * @param lng1  Longitude of point A (degrees)
 * @param lat2  Latitude  of point B (degrees)
 * @param lng2  Longitude of point B (degrees)
 */
export function haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearestRegionResult {
    regionId: string;
    regionName: string;
    distanceKm: number;
}

/**
 * Given a user's latitude/longitude, finds the closest active Region
 * from the provided list of region documents.
 *
 * Each region document must expose:
 *   _id, name, coordinate.coordinates  → [longitude, latitude]  (GeoJSON order)
 */
export function findNearestRegion(
    userLat: number,
    userLng: number,
    regions: Array<{ _id: any; name: string; coordinate?: { coordinates?: number[] } }>
): NearestRegionResult | null {
    if (!regions.length) return null;

    let nearest: NearestRegionResult | null = null;

    for (const region of regions) {
        const coords = region.coordinate?.coordinates;
        if (!coords || coords.length < 2) continue;

        // GeoJSON stores [longitude, latitude]
        const [regionLng, regionLat] = coords;
        const distanceKm = haversineKm(userLat, userLng, regionLat, regionLng);

        if (!nearest || distanceKm < nearest.distanceKm) {
            nearest = {
                regionId: region._id.toString(),
                regionName: region.name,
                distanceKm
            };
        }
    }

    return nearest;
}
