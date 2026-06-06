// mobile/app/edit-profile.tsx
// Full hunter profile edit screen.
// Display name, bio, LinkedIn, GitHub, other links.
// Avatar upload stubbed for Phase 8 (S3/Supabase Storage).

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
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarUpload } from '../components/profile/AvatarUpload'
import { ResumeUpload } from '../components/profile/ResumeUpload'
import { colors, spacing, radius, typography } from '../lib/theme'

export default function EditProfileScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const { hunterProfile, user, setHunterProfile } = useAuthStore()

  const [avatarUrl, setAvatarUrl]     = useState(hunterProfile?.avatar_url ?? null)
  const [resumeFile, setResumeFile]   = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(hunterProfile?.display_name ?? '')
  const [bio, setBio]                 = useState(hunterProfile?.bio ?? '')
  const [linkedin, setLinkedin]       = useState(hunterProfile?.linkedin_url ?? '')
  const [github, setGithub]           = useState(hunterProfile?.github_url ?? '')
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'Display name is required'
    if (linkedin && !linkedin.startsWith('http')) {
      errs.linkedin = 'Enter a full URL starting with https://'
    }
    if (github && !github.startsWith('http')) {
      errs.github = 'Enter a full URL starting with https://'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate() || !hunterProfile) return
    setSaving(true)

    const { data, error } = await supabase
      .from('hunter_profiles')
      .update({
        display_name: displayName.trim(),
        bio:          bio.trim() || null,
        linkedin_url: linkedin.trim() || null,
        github_url:   github.trim() || null,
      })
      .eq('id', hunterProfile.id)
      .select()
      .single()

    setSaving(false)

    if (error) {
      Alert.alert('Error', 'Failed to save. Please try again.')
      return
    }

    setHunterProfile(data)
    Alert.alert('Saved!', 'Your profile has been updated.', [
      { text: 'Done', onPress: () => router.back() },
    ])
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar upload */}
        <View style={styles.avatarSection}>
          <AvatarUpload
            currentUrl={avatarUrl}
            displayName={displayName}
            onUploaded={(url) => {
              setAvatarUrl(url)
              if (hunterProfile) setHunterProfile({ ...hunterProfile, avatar_url: url })
            }}
          />
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>

        {/* Resume upload */}
        <View style={styles.field}>
          <Text style={styles.label}>Resume</Text>
          <ResumeUpload
            currentFileName={resumeFile}
            onUploaded={(url, name) => setResumeFile(name)}
          />
        </View>

        {/* Display name */}
        <View style={styles.field}>
          <Text style={styles.label}>Display name *</Text>
          <TextInput
            style={[styles.input, errors.displayName && styles.inputError]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we call you?"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
          {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="A sentence or two about yourself…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* LinkedIn */}
        <View style={styles.field}>
          <Text style={styles.label}>LinkedIn URL</Text>
          <TextInput
            style={[styles.input, errors.linkedin && styles.inputError]}
            value={linkedin}
            onChangeText={setLinkedin}
            placeholder="https://linkedin.com/in/yourname"
            placeholderTextColor={colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.linkedin && <Text style={styles.errorText}>{errors.linkedin}</Text>}
        </View>

        {/* GitHub */}
        <View style={styles.field}>
          <Text style={styles.label}>GitHub URL</Text>
          <TextInput
            style={[styles.input, errors.github && styles.inputError]}
            value={github}
            onChangeText={setGithub}
            placeholder="https://github.com/yourhandle"
            placeholderTextColor={colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.github && <Text style={styles.errorText}>{errors.github}</Text>}
        </View>

        {/* Email (read-only) */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{user?.email ?? '—'}</Text>
          </View>
          <Text style={styles.hint}>Email cannot be changed here.</Text>
        </View>

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
  backBtn:      { padding: spacing.xs },
  backText:     { fontSize: 22, color: colors.textPrimary },
  headerTitle:  { ...typography.h3, flex: 1 },
  saveBtn:      { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  saveBtnText:  { ...typography.body, fontWeight: '700', color: colors.primary },
  content:      { padding: spacing.md, gap: spacing.lg },
  avatarSection: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatarCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial:   { fontSize: 40, fontWeight: '700', color: '#fff' },
  changePhotoBtn:  { paddingVertical: spacing.xs },
  changePhotoText: { ...typography.body, color: colors.textMuted },
  field:           { gap: spacing.xs },
  label:           { ...typography.label, textTransform: 'uppercase' },
  hint:            { ...typography.caption, color: colors.textMuted },
  errorText:       { ...typography.caption, color: colors.error },
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
  multiline:      { height: 88, paddingTop: spacing.sm },
  inputError:     { borderColor: colors.error },
  readOnlyInput: {
    backgroundColor:   colors.surfaceLight,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    height:            52,
    justifyContent:    'center',
  },
  readOnlyText: { ...typography.body, color: colors.textMuted },
})
