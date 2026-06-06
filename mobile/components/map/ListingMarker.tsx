// mobile/components/map/ListingMarker.tsx
// Custom callout-free marker for job listings.
// Tapping selects the listing and opens the bottom sheet.

import React, { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Marker } from 'react-native-maps'
import { colors, radius, typography } from '../../lib/theme'
import { ListingPin } from '../../store/mapStore'

interface ListingMarkerProps {
  pin:        ListingPin
  isSelected: boolean
  onPress:    (id: string) => void
}

export const ListingMarker = memo(function ListingMarker({
  pin,
  isSelected,
  onPress,
}: ListingMarkerProps) {
  return (
    <Marker
      coordinate={{ latitude: pin.display_lat, longitude: pin.display_lng }}
      onPress={() => onPress(pin.id)}
      tracksViewChanges={isSelected}  // performance: only re-render when selected
      zIndex={isSelected ? 10 : 1}
    >
      <View style={[styles.pin, isSelected && styles.pinSelected]}>
        <Text style={styles.pinIcon}>💼</Text>
        {isSelected && (
          <Text style={styles.pinLabel} numberOfLines={1}>
            {pin.employer_name}
          </Text>
        )}
      </View>
      {/* Stem */}
      <View style={[styles.stem, isSelected && styles.stemSelected]} />
    </Marker>
  )
})

const styles = StyleSheet.create({
  pin: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: colors.surface,
    borderRadius:    radius.full,
    paddingVertical:  6,
    paddingHorizontal: 10,
    borderWidth:     1.5,
    borderColor:     colors.pinJob,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    4,
    elevation:       4,
  },
  pinSelected: {
    backgroundColor: colors.pinJob,
    borderColor:     colors.pinJob,
  },
  pinIcon: {
    fontSize: 14,
  },
  pinLabel: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
    maxWidth:   100,
  },
  stem: {
    width:           2,
    height:          8,
    backgroundColor: colors.pinJob,
    alignSelf:       'center',
    borderRadius:    1,
  },
  stemSelected: {
    backgroundColor: colors.pinJob,
  },
})
