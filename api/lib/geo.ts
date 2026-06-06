// api/lib/geo.ts
// Server-side geo helpers.

export function fuzzLocation(lat: number, lng: number): { lat: number; lng: number } {
  const FUZZ_DEG = 0.005   // ~0.35 miles
  const angle    = Math.random() * 2 * Math.PI
  const dist     = Math.random() * FUZZ_DEG
  return {
    lat: lat + dist * Math.cos(angle),
    lng: lng + dist * Math.sin(angle) / Math.cos((lat * Math.PI) / 180),
  }
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344
}
