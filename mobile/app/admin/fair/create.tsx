// mobile/app/admin/fair/create.tsx
// Platform admin screen to create a digital job fair.
// Sets location, date range, override radius, and
// invites employer participants.
// Only accessible to users with role = 'admin'.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native'
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../../lib/supabase'
import { colors, spacing, radius, typography } from '../../../lib/theme'

async function geocodeAddress(address: string) {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'LocalLoop/1.0' } }
    )
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

export default function CreateFairScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress]         = useState('')
  const [startDate, setStartDate]     = useState('')   // ISO string
  const [endDate, setEndDate]         = useState('')
  const [overrideRadius, setRadius]   = useState('0.5')
  const [geoResult, setGeoResult]     = useState<{ lat: number; lng: number } | null>(null)
  const [geocoding, setGeocoding]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  async function handleGeocode() {
    if (!address.trim()) return
    setGeocoding(true)
    const result = await geocodeAddress(address.trim())
    setGeocoding(false)
    if (!result) {
      Alert.alert('Address not found', 'Try a more specific address.')
      return
    }
    setGeoResult(result)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim())       errs.name      = 'Name required'
    if (!address.trim())    errs.address   = 'Address required'
    if (!geoResult)         errs.geo       = 'Verify the address first'
    if (!startDate.trim())  errs.startDate = 'Start date required'
    if (!endDate.trim())    errs.endDate   = 'End date required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    if (!validate() || !geoResult) return
    setSaving(true)

    try {
      const session = await supabase.auth.getSession()
      const userId  = session.data.session?.user?.id

      const { data: fair, error } = await supabase
        .from('job_fairs')
        .insert({
          name:                  name.trim(),
          description:           description.trim() || null,
          lat:                   geoResult.lat,
          lng:                   geoResult.lng,
          display_lat:           geoResult.lat,
          display_lng:           geoResult.lng,
          override_radius_miles: parseFloat(overrideRadius) || 0.5,
          status:                'upcoming',
          starts_at:             new Date(startDate).toISOString(),
          ends_at:               new Date(endDate).toISOString(),
          hosted_by:             userId,
        })
        .select()
        .single()

      if (error) throw error

      Alert.alert(
        'Job fair created! 🎪',
        `${name} has been created and hunters near the location will be notified.`,
        [{ text: 'Done', onPress: () => router.back() }]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create fair')
    } finally {
      setSaving(false)
    }
  }

  const radiusMeters = (parseFloat(overrideRadius) || 0.5) * 1609.344

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create job fair</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Fair name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={setName}
            placeholder="LocalLoop Spring Career Fair"
            placeholderTextColor={colors.textMuted}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this fair about? Who's participating?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Address */}
        <View style={styles.field}>
          <Text style={styles.label}>Location *</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex, errors.address && styles.inputError]}
              value={address}
              onChangeText={(t) => { setAddress(t); setGeoResult(null) }}
              placeholder="SDSU campus, 5500 Campanile Dr, San Diego"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleGeocode}
            />
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleGeocode}
              disabled={geocoding}
            >
              {geocoding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.verifyText}>Verify</Text>
              }
            </TouchableOpacity>
          </View>
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
          {errors.geo     && <Text style={styles.errorText}>{errors.geo}</Text>}
        </View>

        {/* Map preview */}
        {geoResult && (
          <View style={styles.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              customMapStyle={darkMapStyle}
              initialRegion={{
                latitude:       geoResult.lat,
                longitude:      geoResult.lng,
                latitudeDelta:  0.03,
                longitudeDelta: 0.03,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: geoResult.lat, longitude: geoResult.lng }}>
                <View style={styles.fairPin}>
                  <Text style={styles.fairPinText}>🎪</Text>
                </View>
              </Marker>
              <Circle
                center={{ latitude: geoResult.lat, longitude: geoResult.lng }}
                radius={radiusMeters}
                fillColor="rgba(245, 158, 11, 0.15)"
                strokeColor="rgba(245, 158, 11, 0.6)"
                strokeWidth={1.5}
              />
            </MapView>
          </View>
        )}

        {/* Override radius */}
        <View style={styles.field}>
          <Text style={styles.label}>Fair radius (miles)</Text>
          <Text style={styles.hint}>
            Hunters within this radius see the fair regardless of their personal radius
          </Text>
          <TextInput
            style={styles.input}
            value={overrideRadius}
            onChangeText={setRadius}
            keyboardType="decimal-pad"
            placeholder="0.5"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Dates */}
        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Starts *</Text>
            <TextInput
              style={[styles.input, errors.startDate && styles.inputError]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-06-01T10:00"
              placeholderTextColor={colors.textMuted}
            />
            {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Ends *</Text>
            <TextInput
              style={[styles.input, errors.endDate && styles.inputError]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-06-01T17:00"
              placeholderTextColor={colors.textMuted}
            />
            {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔔 Creating this fair will send an announcement notification to all hunters
            currently near the location. When the fair goes live, another notification fires.
          </Text>
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, saving && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createBtnText}>Create fair 🎪</Text>
          }
        </TouchableOpacity>

        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn:     { padding: spacing.xs },
  backText:    { fontSize: 22, color: colors.textPrimary },
  headerTitle: { ...typography.h3, flex: 1 },
  adminBadge: {
    backgroundColor:   colors.error + '25',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  adminBadgeText: { ...typography.caption, color: colors.error, fontWeight: '800', fontSize: 10 },
  content:    { padding: spacing.md, gap: spacing.md },
  field:      { gap: spacing.xs },
  row:        { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex:       { flex: 1 },
  label:      { ...typography.label, textTransform: 'uppercase' },
  hint:       { ...typography.caption, color: colors.textMuted },
  errorText:  { ...typography.caption, color: colors.error },
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
  multiline:  { height: 88, paddingTop: spacing.sm },
  inputError: { borderColor: colors.error },
  verifyBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    height:          52,
    paddingHorizontal: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  verifyText: { ...typography.body, fontWeight: '700', color: '#fff' },
  mapWrap: {
    height:       180,
    borderRadius: radius.md,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  colors.border,
  },
  fairPin: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  fairPinText: { fontSize: 20 },
  infoBox: {
    backgroundColor: colors.accent + '15',
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  infoText:    { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText:     { ...typography.body, fontWeight: '700', color: '#fff' },
})

const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8a8a9a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road',  elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',   stylers: [{ visibility: 'off' }] },
]
