// ─────────────────────────────────────────────
// shared/utils/geo.ts
// Haversine distance, radius checks, location fuzz.
// Runs on both client and server — no Node-only deps.
// ─────────────────────────────────────────────

import { LOCATION } from '../constants'

const EARTH_RADIUS_MILES = 3958.8

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Haversine great-circle distance between two points.
 * Returns distance in miles.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

/**
 * Returns true if point is within radiusMiles of center.
 */
export function isWithinRadius(
  center: LatLng,
  point: LatLng,
  radiusMiles: number
): boolean {
  return haversineDistance(center, point) <= radiusMiles
}

/**
 * Applies a random offset to a coordinate pair for client display.
 * Offset is bounded by LOCATION.FUZZ_OFFSET_MILES.
 * Re-randomized each call — never store the result as canonical.
 */
export function fuzzLocation(precise: LatLng): LatLng {
  const radiusDeg = LOCATION.FUZZ_OFFSET_MILES / 69.0  // ~69 miles per degree lat

  // Random angle and distance within the fuzz radius
  const angle    = Math.random() * 2 * Math.PI
  const distance = Math.random() * radiusDeg

  return {
    lat: precise.lat + distance * Math.cos(angle),
    lng: precise.lng + distance * Math.sin(angle) / Math.cos((precise.lat * Math.PI) / 180),
  }
}

/**
 * Snaps a coordinate to the centroid of its approximate zip-code area.
 * Uses a simple grid snap as a zip-centroid approximation.
 * For production, replace with a zip centroid lookup table or API.
 * Precision: ~0.01 degrees ≈ ~0.7 miles.
 */
export function snapToZipCentroid(precise: LatLng): LatLng {
  const precision = 0.05  // ~3.5 mile grid snap — tighten with real zip data
  return {
    lat: Math.round(precise.lat / precision) * precision,
    lng: Math.round(precise.lng / precision) * precision,
  }
}

/**
 * Converts miles to meters (for PostGIS ST_DWithin which uses meters).
 */
export function milesToMeters(miles: number): number {
  return miles * 1609.344
}
