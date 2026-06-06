// mobile/app/employer/locations/add.tsx
// Add a new employer location.
// Accepts address input, geocodes via OpenStreetMap Nominatim
// (free, no API key), previews on a map, then saves.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../../lib/supabase'
import { colors, spacing, radius, typography } from '../../../lib/theme'

interface GeoResult {
  lat:         number
  lng:         number
  displayName: string
}

async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const encoded = encodeURIComponent(address)
    const res     = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'LocalLoop/1.0' } }
    )
    const data = await res.json()
    if (!data || data.length === 0) return null

    return {
      lat:         parseFloat(data[0].lat),
      lng:         parseFloat(data[0].lon),
      displayName: data[0].display_name,
    }
  } catch {
    return null
  }
}

export default function AddLocationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [locationName, setLocationName] = useState('')
  const [address, setAddress]           = useState('')
  const [geoResult, setGeoResult]       = useState<GeoResult | null>(null)
  const [geocoding, setGeocoding]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [errors, setErrors]             = useState<Record<string, string>>({})

  async function handleGeocode() {
    if (!address.trim()) return
    setGeocoding(true)
    setGeoResult(null)

    const result = await geocodeAddress(address.trim())
    setGeocoding(false)

    if (!result) {
      Alert.alert(
        'Address not found',
        'We couldn\'t find that address. Try adding more detail like city and state.'
      )
      return
    }
    setGeoResult(result)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!locationName.trim()) errs.name    = 'Location name is required'
    if (!address.trim())      errs.address = 'Address is required'
    if (!geoResult)           errs.geo     = 'Please verify the address first'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate() || !geoResult) return
    setSaving(true)

    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/employer/locations`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name:    locationName.trim(),
            address: address.trim(),
            lat:     geoResult.lat,
            lng:     geoResult.lng,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to save location')
      }

      Alert.alert(
        'Location added! 🏢',
        `${locationName} has been added to your locations.`,
        [{ text: 'Done', onPress: () => router.back() }]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add location</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Location name */}
        <View style={styles.field}>
          <Text style={styles.label}>Location name *</Text>
          <Text style={styles.hint}>
            e.g. "Downtown flagship", "North campus office"
          </Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Main office, Westside branch…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Address */}
        <View style={styles.field}>
          <Text style={styles.label}>Street address *</Text>
          <View style={styles.addressRow}>
            <TextInput
              style={[styles.input, styles.addressInput, errors.address && styles.inputError]}
              value={address}
              onChangeText={(t) => { setAddress(t); setGeoResult(null) }}
              placeholder="123 Main St, San Diego, CA"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleGeocode}
            />
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleGeocode}
              disabled={geocoding || !address.trim()}
            >
              {geocoding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.verifyBtnText}>Verify</Text>
              }
            </TouchableOpacity>
          </View>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
          {errors.geo     && <Text style={styles.errorText}>{errors.geo}</Text>}
        </View>

        {/* Map preview */}
        {geoResult && (
          <View style={styles.mapSection}>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Address verified</Text>
            </View>
            <Text style={styles.geoName} numberOfLines={2}>
              {geoResult.displayName}
            </Text>
            <View style={styles.mapWrap}>
              <MapView
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                customMapStyle={darkMapStyle}
                initialRegion={{
                  latitude:       geoResult.lat,
                  longitude:      geoResult.lng,
                  latitudeDelta:  0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: geoResult.lat, longitude: geoResult.lng }}
                />
              </MapView>
            </View>
            <Text style={styles.privacyNote}>
              🔒 Your exact address is never shown to hunters.
              The pin will be generalized on the map.
            </Text>
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, (!geoResult || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!geoResult || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save location</Text>
          }
        </TouchableOpacity>

        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn:      { padding: spacing.xs },
  backText:     { fontSize: 22, color: colors.textPrimary },
  headerTitle:  { ...typography.h3, flex: 1 },
  content:      { padding: spacing.md, gap: spacing.lg },
  field:        { gap: spacing.xs },
  label:        { ...typography.label, textTransform: 'uppercase' },
  hint:         { ...typography.caption, color: colors.textMuted },
  input: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1.5,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...typography.body,
    color:             colors.textPrimary,
    height:            52,
  },
  inputError:   { borderColor: colors.error },
  errorText:    { ...typography.caption, color: colors.error },
  addressRow:   { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  addressInput: { flex: 1 },
  verifyBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    height:          52,
    paddingHorizontal: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  verifyBtnText:  { ...typography.body, fontWeight: '700', color: '#fff' },
  mapSection:     { gap: spacing.sm },
  verifiedBadge: {
    backgroundColor:   colors.primary + '20',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
    alignSelf:         'flex-start',
  },
  verifiedText:   { ...typography.caption, color: colors.primary, fontWeight: '700' },
  geoName:        { ...typography.caption, color: colors.textSecondary },
  mapWrap: {
    height:       200,
    borderRadius: radius.md,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  colors.border,
  },
  privacyNote:    { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { ...typography.body, fontWeight: '700', color: '#fff' },
})

const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8a8a9a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road',   elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water',  elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',    stylers: [{ visibility: 'off' }] },
]
