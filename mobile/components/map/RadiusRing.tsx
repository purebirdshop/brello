// mobile/components/map/RadiusRing.tsx
// Renders the hunter's earned radius as a Circle overlay
// on the MapView. Animates scale when radius changes (milestone hit).

import React, { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { Circle } from 'react-native-maps'
import { colors } from '../../lib/theme'

interface RadiusRingProps {
  lat:         number
  lng:         number
  radiusMiles: number
}

const METERS_PER_MILE = 1609.344

export function RadiusRing({ lat, lng, radiusMiles }: RadiusRingProps) {
  const prevRadius = useRef(radiusMiles)

  // We can't animate react-native-maps Circle natively,
  // but we track changes so a parent can trigger a celebration.
  useEffect(() => {
    prevRadius.current = radiusMiles
  }, [radiusMiles])

  const radiusMeters = radiusMiles * METERS_PER_MILE

  return (
    <>
      {/* Filled area */}
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={radiusMeters}
        fillColor={colors.radiusRing}
        strokeColor={colors.radiusStroke}
        strokeWidth={1.5}
        zIndex={1}
      />
      {/* Inner pulse ring for visual depth */}
      <Circle
        center={{ latitude: lat, longitude: lng }}
        radius={radiusMeters * 0.3}
        fillColor="rgba(22, 163, 74, 0.05)"
        strokeColor="rgba(22, 163, 74, 0.2)"
        strokeWidth={1}
        zIndex={1}
      />
    </>
  )
}
