// mobile/app/tabs/map.tsx
// The core product screen. Renders the MapView with:
//   - Hunter's location marker
//   - Radius ring (earned, animated)
//   - Job listing pins (jobs layer)
//   - Business location pins (businesses layer)
//   - Layer toggle pill
//   - Radius badge HUD
//   - Listing / business bottom sheets

import React, { useRef, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native'
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import { useMapData } from '../../hooks/useMapData'
import { useLiveLocation } from '../../hooks/useLiveLocation'

import { RadiusRing } from '../../components/map/RadiusRing'
import { ListingMarker } from '../../components/map/ListingMarker'
import { BusinessMarker } from '../../components/map/BusinessMarker'
import { LayerToggle } from '../../components/map/LayerToggle'
import { RadiusBadge } from '../../components/map/RadiusBadge'
import { ListingBottomSheet } from '../../components/listings/ListingBottomSheet'
import { BusinessBottomSheet } from '../../components/listings/BusinessBottomSheet'

import { colors } from '../../lib/theme'
import { ActiveSwapBanner } from '../../components/circle/ActiveSwapBanner'
import { useCircle } from '../../hooks/useCircle'

// Default region — San Diego
const DEFAULT_REGION: Region = {
  latitude:       32.7157,
  longitude:     -117.1611,
  latitudeDelta:  0.08,
  longitudeDelta: 0.08,
}

export default function MapTab() {
  const insets  = useSafeAreaInsets()
  const mapRef  = useRef<MapView>(null)

  const { hunterProfile } = useAuthStore()
  const {
    activeLayer,
    listingPins,
    businessPins,
    selectedListingId,
    selectedBusinessId,
    loadingListings,
    loadingBusinesses,
    mapReady,
    setActiveLayer,
    setSelectedListing,
    setSelectedBusiness,
    setMapReady,
  } = useMapStore()

  useMapData()
  useLiveLocation()
  useCircle()

  // Center on user when location first arrives
  useEffect(() => {
    if (
      hunterProfile?.current_lat &&
      hunterProfile?.current_lng &&
      !mapReady &&
      mapRef.current
    ) {
      mapRef.current.animateToRegion(
        {
          latitude:       hunterProfile.current_lat,
          longitude:      hunterProfile.current_lng,
          latitudeDelta:  milesToDelta(hunterProfile.radius_miles ?? 1),
          longitudeDelta: milesToDelta(hunterProfile.radius_miles ?? 1),
        },
        800
      )
      setMapReady(true)
    }
  }, [hunterProfile?.current_lat, hunterProfile?.current_lng])

  const handleRecenter = useCallback(() => {
    if (!hunterProfile?.current_lat || !hunterProfile?.current_lng) return
    mapRef.current?.animateToRegion(
      {
        latitude:       hunterProfile.current_lat,
        longitude:      hunterProfile.current_lng,
        latitudeDelta:  milesToDelta(hunterProfile.radius_miles ?? 1),
        longitudeDelta: milesToDelta(hunterProfile.radius_miles ?? 1),
      },
      600
    )
  }, [hunterProfile])

  const selectedListing  = listingPins.find((p) => p.id === selectedListingId) ?? null
  const selectedBusiness = businessPins.find((p) => p.id === selectedBusinessId) ?? null
  const isLoading        = activeLayer === 'jobs' ? loadingListings : loadingBusinesses

  return (
    <View style={styles.root}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => {
          setSelectedListing(null)
          setSelectedBusiness(null)
        }}
      >
        {hunterProfile?.current_lat && hunterProfile?.current_lng && (
          <RadiusRing
            lat={hunterProfile.current_lat}
            lng={hunterProfile.current_lng}
            radiusMiles={hunterProfile.radius_miles ?? 1}
          />
        )}

        {activeLayer === 'jobs' && listingPins.map((pin) => (
          <ListingMarker
            key={pin.id}
            pin={pin}
            isSelected={pin.id === selectedListingId}
            onPress={setSelectedListing}
          />
        ))}

        {activeLayer === 'businesses' && businessPins.map((pin) => (
          <BusinessMarker
            key={pin.id}
            pin={pin}
            isSelected={pin.id === selectedBusinessId}
            onPress={setSelectedBusiness}
          />
        ))}
      </MapView>

      {/* Top HUD */}
      <View style={[styles.topHud, { top: insets.top + 12 }]}>
        {hunterProfile && (
          <RadiusBadge
            radiusMiles={hunterProfile.radius_miles ?? 1}
            circlePoints={hunterProfile.circle_points ?? 0}
          />
        )}
        {isLoading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>
              {activeLayer === 'jobs' ? 'Loading jobs…' : 'Loading businesses…'}
            </Text>
          </View>
        )}
      </View>

      {/* Pin count */}
      {!isLoading && (
        <View style={[styles.countBadge, { top: insets.top + 72 }]}>
          <Text style={styles.countText}>
            {activeLayer === 'jobs'
              ? `${listingPins.length} listing${listingPins.length !== 1 ? 's' : ''}`
              : `${businessPins.length} location${businessPins.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      {/* Active swap banner */}
      <View style={[styles.swapBannerRow, { bottom: insets.bottom + 148 }]}>
        <ActiveSwapBanner />
      </View>

      {/* Layer toggle */}
      <View style={[styles.layerToggleRow, { bottom: insets.bottom + 80 }]}>
        <LayerToggle active={activeLayer} onChange={setActiveLayer} />
      </View>

      {/* Recenter */}
      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: insets.bottom + 80 }]}
        onPress={handleRecenter}
        activeOpacity={0.85}
      >
        <Text style={styles.recenterIcon}>⊙</Text>
      </TouchableOpacity>

      {/* Bottom sheets */}
      <ListingBottomSheet
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
      />
      <BusinessBottomSheet
        business={selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
      />
    </View>
  )
}

function milesToDelta(miles: number) {
  return miles * 0.022
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  topHud: {
    position:      'absolute',
    left:          16,
    right:         16,
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  loadingPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   colors.surface,
    borderRadius:      20,
    paddingVertical:   8,
    paddingHorizontal: 14,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  loadingText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  swapBannerRow: {
    position: 'absolute',
    left:     0,
    right:    0,
  },
  layerToggleRow: {
    position:   'absolute',
    left:       0,
    right:      0,
    alignItems: 'center',
  },
  recenterBtn: {
    position:          'absolute',
    right:             16,
    width:             44,
    height:            44,
    borderRadius:      22,
    backgroundColor:   colors.surface,
    alignItems:        'center',
    justifyContent:    'center',
    borderWidth:       1,
    borderColor:       colors.border,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.3,
    shadowRadius:      6,
    elevation:         5,
  },
  recenterIcon: {
    fontSize: 22,
    color:    colors.primary,
  },
  countBadge: {
    position:          'absolute',
    alignSelf:         'center',
    backgroundColor:   colors.surface + 'ee',
    borderRadius:      20,
    paddingVertical:   4,
    paddingHorizontal: 12,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  countText: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
})

const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8a8a9a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road',               elementType: 'geometry',
    stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',
    stylers: [{ color: '#303050' }] },
  { featureType: 'road.highway',       elementType: 'geometry',
    stylers: [{ color: '#383858' }] },
  { featureType: 'water',              elementType: 'geometry',
    stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
]
