// mobile/app/employer/post/index.tsx
// Employer job posting flow.
// Step 1: Select location (or create one)
// Step 2: Fill in listing details
// Step 3: Preview and publish

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../../lib/supabase'
import { colors, spacing, radius, typography } from '../../../lib/theme'

type PostStep = 'location' | 'details' | 'preview'

const SUGGESTED_TAGS = [
  'Full-time', 'Part-time', 'Flexible', 'Remote-friendly',
  'Entry-level', 'Senior', 'Customer service', 'Tech',
  'Management', 'Creative', 'Sales', 'Operations',
]

export default function EmployerPostScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const [step, setStep]                 = useState<PostStep>('location')
  const [locations, setLocations]       = useState<any[]>([])
  const [selectedLocation, setLocation] = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [publishing, setPublishing]     = useState(false)

  // Listing fields
  const [title, setTitle]               = useState('')
  const [description, setDescription]  = useState('')
  const [tags, setTags]                 = useState<string[]>([])
  const [closesAt, setClosesAt]         = useState('')
  const [resubCap, setResubCap]         = useState('')
  const [errors, setErrors]             = useState<Record<string, string>>({})

  useEffect(() => { fetchLocations() }, [])

  async function fetchLocations() {
    setLoading(true)
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const res  = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/employer/locations`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setLocations(data.locations ?? [])
    setLoading(false)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!title.trim())       errs.title       = 'Title is required'
    if (!description.trim()) errs.description = 'Description is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handlePublish() {
    if (!validate() || !selectedLocation) return
    setPublishing(true)

    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token

      // Create draft
      const createRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/employer/listings`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employer_location_id: selectedLocation.id,
            title:                title.trim(),
            description:          description.trim(),
            tags,
            listing_type:         'standard',
            closes_at:            closesAt || null,
            resubmission_cap:     resubCap ? parseInt(resubCap) : null,
          }),
        }
      )

      if (!createRes.ok) throw new Error('Failed to create listing')
      const { listing } = await createRes.json()

      // Publish (fires follow notifications via DB trigger)
      const publishRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/employer/listings/${listing.id}/publish`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )

      if (!publishRes.ok) throw new Error('Failed to publish listing')

      Alert.alert(
        'Listing published! 🎉',
        `${title} is now live on LocalLoop. Followers of ${selectedLocation.name} have been notified.`,
        [{ text: 'Done', onPress: () => router.back() }]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong')
    } finally {
      setPublishing(false)
    }
  }

  // ── Step renderers ────────────────────────────

  function renderLocationStep() {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Which location is hiring?</Text>
        <Text style={styles.stepSub}>
          Hunters near this location will see your listing on their map.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : locations.length === 0 ? (
          <View style={styles.emptyLocations}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyText}>
              You haven't added any locations yet. Add one to start posting.
            </Text>
            <TouchableOpacity
              style={styles.addLocationBtn}
              onPress={() => router.push('/employer/locations/add' as any)}
            >
              <Text style={styles.addLocationBtnText}>+ Add a location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationList}>
            {locations.map((loc) => (
              <TouchableOpacity
                key={loc.id}
                style={[
                  styles.locationCard,
                  selectedLocation?.id === loc.id && styles.locationCardSelected,
                ]}
                onPress={() => setLocation(loc)}
                activeOpacity={0.8}
              >
                <View style={styles.locationCardInner}>
                  <View style={styles.locationAvatar}>
                    <Text style={styles.locationAvatarText}>
                      {loc.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.locationAddress}>{loc.address}</Text>
                    <Text style={styles.locationFollowers}>
                      {loc.follower_count} follower{loc.follower_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {selectedLocation?.id === loc.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addAnotherBtn}
              onPress={() => router.push('/employer/locations/add' as any)}
            >
              <Text style={styles.addAnotherText}>+ Add another location</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedLocation && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setStep('details')}
          >
            <Text style={styles.nextBtnText}>Continue →</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  function renderDetailsStep() {
    return (
      <ScrollView
        style={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>Tell hunters about the role</Text>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Job title *</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Barista, Software Engineer, Store Manager"
            placeholderTextColor={colors.textMuted}
          />
          {errors.title && <Text style={styles.fieldError}>{errors.title}</Text>}
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, errors.description && styles.inputError]}
            value={description}
            onChangeText={setDescription}
            placeholder="What does this role involve? What are you looking for?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          {errors.description && <Text style={styles.fieldError}>{errors.description}</Text>}
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tags</Text>
          <Text style={styles.fieldHint}>Tap to add or remove</Text>
          <View style={styles.tagsGrid}>
            {SUGGESTED_TAGS.map((tag) => {
              const active = tags.includes(tag)
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                  onPress={() => setTags((t) =>
                    active ? t.filter((x) => x !== tag) : [...t, tag]
                  )}
                >
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Resubmission cap */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Resubmission limit</Text>
          <Text style={styles.fieldHint}>Max times a hunter can resubmit (leave blank for unlimited)</Text>
          <TextInput
            style={styles.input}
            value={resubCap}
            onChangeText={setResubCap}
            placeholder="e.g. 2"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.stepNavRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep('location')}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => { if (validate()) setStep('preview') }}
          >
            <Text style={styles.nextBtnText}>Preview →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    )
  }

  function renderPreviewStep() {
    return (
      <ScrollView
        style={styles.stepContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Preview your listing</Text>
        <Text style={styles.stepSub}>
          This is how it'll appear to hunters on the map.
        </Text>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewAvatarText}>
                {selectedLocation?.name?.charAt(0) ?? '?'}
              </Text>
            </View>
            <View>
              <Text style={styles.previewEmployer}>
                {selectedLocation?.name}
              </Text>
              <Text style={styles.previewAddress}>
                {selectedLocation?.address}
              </Text>
            </View>
          </View>

          <Text style={styles.previewTitle}>{title || 'Untitled listing'}</Text>

          <Text style={styles.previewDescription} numberOfLines={4}>
            {description || 'No description'}
          </Text>

          {tags.length > 0 && (
            <View style={styles.previewTags}>
              {tags.slice(0, 4).map((t) => (
                <View key={t} style={styles.previewTag}>
                  <Text style={styles.previewTagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.previewMeta}>
            <Text style={styles.previewMetaText}>
              📍 {selectedLocation?.follower_count ?? 0} followers will be notified
            </Text>
          </View>
        </View>

        <View style={styles.stepNavRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep('details')}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.publishBtnText}>Publish listing 🚀</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    )
  }

  // ── Step indicator ────────────────────────────

  const STEPS: PostStep[] = ['location', 'details', 'preview']
  const stepIndex = STEPS.indexOf(step)

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a listing</Text>
        <View style={styles.stepIndicator}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}
            />
          ))}
        </View>
      </View>

      {step === 'location' && renderLocationStep()}
      {step === 'details'  && renderDetailsStep()}
      {step === 'preview'  && renderPreviewStep()}
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
  headerBack:       { padding: spacing.xs },
  headerBackText:   { fontSize: 20, color: colors.textPrimary },
  headerTitle:      { ...typography.h3, flex: 1 },
  stepIndicator:    { flexDirection: 'row', gap: 6 },
  stepDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.surfaceLight,
  },
  stepDotActive:    { backgroundColor: colors.primary },
  stepContent:      { flex: 1, padding: spacing.md },
  stepTitle:        { ...typography.h2, marginBottom: spacing.xs },
  stepSub:          { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 },

  // Location step
  emptyLocations:   { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  emptyIcon:        { fontSize: 48 },
  emptyText:        { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  addLocationBtn: {
    backgroundColor:   colors.primary,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
  },
  addLocationBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
  locationList:       { gap: spacing.sm },
  locationCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  locationCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  locationCardInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    padding:       spacing.md,
  },
  locationAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  locationAvatarText:  { ...typography.h3, color: colors.textSecondary },
  locationInfo:        { flex: 1, gap: 2 },
  locationName:        { ...typography.body, fontWeight: '700' },
  locationAddress:     { ...typography.caption, color: colors.textMuted },
  locationFollowers:   { ...typography.caption, color: colors.primary, fontWeight: '600' },
  checkmark:           { fontSize: 20, color: colors.primary, fontWeight: '700' },
  addAnotherBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    borderStyle:     'dashed',
  },
  addAnotherText:   { ...typography.body, color: colors.textMuted },

  // Details step
  field:            { gap: spacing.xs, marginBottom: spacing.md },
  fieldLabel:       { ...typography.label, textTransform: 'uppercase' },
  fieldHint:        { ...typography.caption, color: colors.textMuted },
  fieldError:       { ...typography.caption, color: colors.error },
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
  inputMultiline:   { height: 120, paddingTop: spacing.sm },
  inputError:       { borderColor: colors.error },
  tagsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tagChip: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderWidth:       1.5,
    borderColor:       colors.border,
  },
  tagChipActive:     { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  tagChipText:       { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  tagChipTextActive: { color: colors.primary },

  // Preview step
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    marginBottom:    spacing.lg,
  },
  previewHeader:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  previewAvatarText:  { ...typography.h3, color: colors.textSecondary },
  previewEmployer:    { ...typography.body, fontWeight: '700' },
  previewAddress:     { ...typography.caption, color: colors.textMuted },
  previewTitle:       { ...typography.h3 },
  previewDescription: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  previewTags:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  previewTag: {
    backgroundColor:   colors.primary + '20',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  previewTagText:     { ...typography.caption, color: colors.primary, fontWeight: '600' },
  previewMeta:        { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  previewMetaText:    { ...typography.caption, color: colors.textSecondary },

  // Nav
  stepNavRow:      { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  backBtn: {
    flex:            1,
    backgroundColor: colors.surfaceLight,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  backBtnText:     { ...typography.body, fontWeight: '600', color: colors.textSecondary },
  nextBtn: {
    flex:            2,
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  nextBtnText:     { ...typography.body, fontWeight: '700', color: '#fff' },
  publishBtn: {
    flex:            2,
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText:     { ...typography.body, fontWeight: '700', color: '#fff' },
})
