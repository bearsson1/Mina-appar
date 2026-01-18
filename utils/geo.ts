
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export function getNextPoint(lat: number, lng: number, distanceInMeters: number): { lat: number; lng: number } {
  const R = 6378137; // Earth’s radius in meters
  const bearing = Math.random() * 360; // Random direction
  const brng = (bearing * Math.PI) / 180;
  
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distanceInMeters / R) +
      Math.cos(φ1) * Math.sin(distanceInMeters / R) * Math.cos(brng)
  );

  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceInMeters / R) * Math.cos(φ1),
      Math.cos(distanceInMeters / R) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (λ2 * 180) / Math.PI,
  };
}
