// mobile/app/skills/index.tsx
// Hunter skill management screen.
// Shows current skills, lets you add/remove via SkillTagSelector.
// Accessible from the profile tab menu.

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { SkillTagSelector } from '../../components/skills/SkillTagSelector'
import { colors, spacing, radius, typography } from '../../lib/theme'

export default function SkillsScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const { hunterProfile } = useAuthStore()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [dirty, setDirty]             = useState(false)

  useEffect(() => {
    if (!hunterProfile) return
    loadSkills()
  }, [hunterProfile?.id])

  async function loadSkills() {
    setLoading(true)
    const { data } = await supabase
      .from('hunter_skills')
      .select('skill_tag_id')
      .eq('hunter_id', hunterProfile!.id)

    setSelectedIds((data ?? []).map((r: any) => r.skill_tag_id))
    setLoading(false)
  }

  async function handleSave() {
    if (!hunterProfile) return
    setSaving(true)

    try {
      // Delete all existing, re-insert selected
      await supabase
        .from('hunter_skills')
        .delete()
        .eq('hunter_id', hunterProfile.id)

      if (selectedIds.length > 0) {
        await supabase.from('hunter_skills').insert(
          selectedIds.map((skill_tag_id) => ({
            hunter_id: hunterProfile.id,
            skill_tag_id,
          }))
        )
      }

      setDirty(false)
      Alert.alert('Saved!', 'Your skills have been updated.', [
        { text: 'Done', onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save skills.')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(ids: string[]) {
    setSelectedIds(ids)
    setDirty(true)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My skills</Text>
        {dirty && (
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
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Skills help employers find you when they're looking for a specific match.
          They also power the future notification matching system.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <SkillTagSelector
            selectedIds={selectedIds}
            onChange={handleChange}
            maxTags={25}
          />
        )}

        {dirty && (
          <TouchableOpacity
            style={[styles.saveFullBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveFullBtnText}>Save skills</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  backBtn:       { padding: spacing.xs },
  backText:      { fontSize: 22, color: colors.textPrimary },
  headerTitle:   { ...typography.h3, flex: 1 },
  saveBtn:       { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  saveBtnText:   { ...typography.body, fontWeight: '700', color: colors.primary },
  content:       { padding: spacing.md, gap: spacing.lg },
  intro: {
    ...typography.body,
    color:      colors.textSecondary,
    lineHeight: 22,
  },
  saveFullBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  saveBtnDisabled:  { opacity: 0.5 },
  saveFullBtnText:  { ...typography.body, fontWeight: '700', color: '#fff' },
})
