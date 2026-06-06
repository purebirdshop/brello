// mobile/components/map/BusinessMarker.tsx
// Custom marker for employer locations in the business discovery layer.
// Shows follow state visually. Tapping opens the business bottom sheet.

import React, { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import { colors, radius, typography } from '../../lib/theme'
import { BusinessPin } from '../../store/mapStore'

interface BusinessMarkerProps {
  pin:        BusinessPin
  isSelected: boolean
  onPress:    (id: string) => void
}

export const BusinessMarker = memo(function BusinessMarker({
  pin,
  isSelected,
  onPress,
}: BusinessMarkerProps) {
  return (
    <Marker
      coordinate={{ latitude: pin.display_lat, longitude: pin.display_lng }}
      onPress={() => onPress(pin.id)}
      tracksViewChanges={isSelected}
      zIndex={isSelected ? 10 : 1}
    >
      <View style={[
        styles.pin,
        isSelected   && styles.pinSelected,
        pin.is_followed && styles.pinFollowed,
      ]}>
        <Text style={styles.pinIcon}>
          {pin.is_followed ? '⭐' : '🏢'}
        </Text>
        {isSelected && (
          <Text style={styles.pinLabel} numberOfLines={1}>
            {pin.employer_name}
          </Text>
        )}
      </View>
      <View style={[
        styles.stem,
        pin.is_followed && styles.stemFollowed,
      ]} />
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
    borderColor:     colors.pinBusiness,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    4,
    elevation:       4,
  },
  pinSelected: {
    backgroundColor: colors.pinBusiness,
    borderColor:     colors.pinBusiness,
  },
  pinFollowed: {
    borderColor: colors.accent,
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
    backgroundColor: colors.pinBusiness,
    alignSelf:       'center',
    borderRadius:    1,
  },
  stemFollowed: {
    backgroundColor: colors.accent,
  },
})
