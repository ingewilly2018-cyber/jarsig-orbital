export type LunarPoint = { latitude: number; longitude: number };
export type CountryRings = LunarPoint[][];
export type CountryFootprint = { rings: CountryRings; enclosure: LunarPoint[] };

type Feature = {
  type: "Feature";
  properties?: Record<string, string>;
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};
type FeatureCollection = { features: Feature[] };

const COUNTRY_GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
let countryFeatures: Promise<Feature[]> | undefined;
const aliases: Record<string, string[]> = {
  Cameroon: ["Cameroon"], France: ["France"], "United States": ["United States of America", "United States"],
  Canada: ["Canada"], Brazil: ["Brazil"], India: ["India"], Japan: ["Japan"],
};

function getFeatures() {
  countryFeatures ??= fetch(COUNTRY_GEOJSON_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Country outlines unavailable (${response.status})`);
      return response.json() as Promise<FeatureCollection>;
    })
    .then((collection) => collection.features);
  return countryFeatures;
}

function destination(center: LunarPoint, eastKm: number, northKm: number): LunarPoint {
  const radius = 1737.4;
  const distance = Math.hypot(eastKm, northKm);
  const angular = distance / radius;
  const bearing = Math.atan2(eastKm, northKm);
  const lat1 = center.latitude * Math.PI / 180;
  const lon1 = center.longitude * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: lat2 * 180 / Math.PI, longitude: ((lon2 * 180 / Math.PI + 540) % 360) - 180 };
}

export async function getCountryFootprint(country: string, moonCenter: LunarPoint): Promise<CountryFootprint> {
  const names = aliases[country] ?? [country];
  const features = await getFeatures();
  const feature = features.find((item) => names.includes(item.properties?.["ADMIN"] ?? item.properties?.["NAME"] ?? ""));
  if (!feature?.geometry) throw new Error(`No boundary found for ${country}`);
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as number[][][]]
    : feature.geometry.coordinates as number[][][][];
  const selectedPolygons = [...polygons]
    .filter((polygon) => !!polygon[0] && polygon[0]!.length > 2)
    .sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0))
    .slice(0, 24);
  const mainRing = selectedPolygons[0]?.[0];
  if (!mainRing) throw new Error(`No usable outline found for ${country}`);
  // Only draw country exteriors: interior GeoJSON rings can look like stray circles on a globe.
  const selectedRings = selectedPolygons.map((polygon) => polygon[0]!).filter((ring) => ring.length > 2);
  const firstLongitude = mainRing[0]![0]!;
  const unwrappedLongitudes = mainRing.map(([longitude]) => {
    let value = longitude!;
    while (value - firstLongitude > 180) value -= 360;
    while (value - firstLongitude < -180) value += 360;
    return value;
  });
  const countryCenter = {
    longitude: unwrappedLongitudes.reduce((sum, value) => sum + value, 0) / unwrappedLongitudes.length,
    latitude: mainRing.reduce((sum, point) => sum + point[1]!, 0) / mainRing.length,
  };
  const samples = selectedRings.map((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    const openRing = first && last && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
    const stride = Math.max(1, Math.ceil(openRing.length / 500));
    const earthRadius = 6371;
    const cosLat = Math.cos(countryCenter.latitude * Math.PI / 180);
    return openRing.filter((_point, index) => index % stride === 0).map(([longitude, latitude]) => {
      let centeredLongitude = longitude!;
      while (centeredLongitude - countryCenter.longitude > 180) centeredLongitude -= 360;
      while (centeredLongitude - countryCenter.longitude < -180) centeredLongitude += 360;
      const lonDelta = centeredLongitude - countryCenter.longitude;
      const eastKm = lonDelta * Math.PI / 180 * earthRadius * cosLat;
      const northKm = (latitude! - countryCenter.latitude) * Math.PI / 180 * earthRadius;
      return destination(moonCenter, eastKm, northKm);
    });
  });
  const radians = Math.PI / 180;
  let maxDistance = 0;
  for (const ring of samples) for (const point of ring) {
    const lat1 = moonCenter.latitude * radians;
    const lat2 = point.latitude * radians;
    const dLat = lat2 - lat1;
    const dLon = (point.longitude - moonCenter.longitude) * radians;
    const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    maxDistance = Math.max(maxDistance, 2 * 1737.4 * Math.asin(Math.min(1, Math.sqrt(haversine))));
  }
  const enclosureRadius = Math.min(maxDistance * 1.12 + 20, 1737.4 * Math.PI * 0.94);
  const enclosure = Array.from({ length: 120 }, (_, index) => {
    const bearing = index * Math.PI * 2 / 120;
    return destination(moonCenter, Math.sin(bearing) * enclosureRadius, Math.cos(bearing) * enclosureRadius);
  });
  return { rings: samples, enclosure };
}
