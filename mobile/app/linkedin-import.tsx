// mobile/app/linkedin-import.tsx
// LinkedIn import screen. Lets hunters:
//   1. Upload their LinkedIn Data Export (Profile.json)
//   2. Or paste a simplified profile JSON manually
// Shows last import status and what was imported.

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors, spacing, radius, typography } from '../lib/theme'

export default function LinkedInImportScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const [lastImport, setLastImport] = useState<any>(null)
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<any>(null)
  const [manualJson, setManualJson] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => { fetchStatus() }, [])

  async function fetchStatus() {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const res  = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/linkedin/status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setLastImport(data.import)
  }

  async function handleFilePick() {
    const picked = await DocumentPicker.getDocumentAsync({
      type:                 'application/json',
      copyToCacheDirectory: true,
    })

    if (picked.canceled || !picked.assets?.[0]) return

    const fileUri = picked.assets[0].uri

    try {
      const text    = await fetch(fileUri).then((r) => r.text())
      const parsed  = JSON.parse(text)
      await runImport(parsed)
    } catch {
      Alert.alert('Invalid file', 'The file does not appear to be valid JSON.')
    }
  }

  async function handleManualImport() {
    if (!manualJson.trim()) return
    try {
      const parsed = JSON.parse(manualJson.trim())
      await runImport(parsed)
    } catch {
      Alert.alert('Invalid JSON', 'Please check your JSON and try again.')
    }
  }

  async function runImport(profileData: any) {
    setImporting(true)
    setResult(null)

    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    try {
      const res  = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/linkedin/import`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ profile_data: profileData }),
        }
      )

      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Import failed')

      setResult(data)
      fetchStatus()
    } catch (err: any) {
      Alert.alert('Import failed', err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import from LinkedIn</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💼 What gets imported</Text>
          <Text style={styles.infoText}>
            Your display name, headline, summary, and skills are pulled in automatically.
            Your profile URL is saved for employers to verify. Your raw LinkedIn data
            is stored securely as your resume record.
          </Text>
        </View>

        {/* Last import status */}
        {lastImport && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Last import</Text>
            <View style={styles.statusRow}>
              <View style={[
                styles.statusDot,
                { backgroundColor: lastImport.status === 'done' ? colors.success : colors.warning },
              ]} />
              <Text style={styles.statusText}>
                {lastImport.status === 'done'
                  ? `Completed ${new Date(lastImport.imported_at).toLocaleDateString()}`
                  : lastImport.status === 'failed'
                  ? `Failed: ${lastImport.error}`
                  : 'Processing…'}
              </Text>
            </View>
          </View>
        )}

        {/* Success result */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✓ Import complete</Text>
            {result.fields_imported?.length > 0 && (
              <Text style={styles.resultText}>
                Profile fields updated: {result.fields_imported.join(', ')}
              </Text>
            )}
            {result.skills_added > 0 && (
              <Text style={styles.resultText}>
                {result.skills_added} skill{result.skills_added !== 1 ? 's' : ''} added to your profile
              </Text>
            )}
          </View>
        )}

        {/* How to export */}
        <View style={styles.howTo}>
          <Text style={styles.howToTitle}>How to export from LinkedIn</Text>
          <Text style={styles.howToStep}>1. Go to linkedin.com → Me → Settings & Privacy</Text>
          <Text style={styles.howToStep}>2. Data Privacy → Get a copy of your data</Text>
          <Text style={styles.howToStep}>3. Select "Profile" and request the export</Text>
          <Text style={styles.howToStep}>4. Download the ZIP, find Profile.json, and upload it here</Text>
        </View>

        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadBtn, importing && styles.btnDisabled]}
          onPress={handleFilePick}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadBtnText}>Upload Profile.json</Text>
          )}
        </TouchableOpacity>

        {/* Manual JSON toggle */}
        <TouchableOpacity
          style={styles.manualToggle}
          onPress={() => setShowManual((v) => !v)}
        >
          <Text style={styles.manualToggleText}>
            {showManual ? '▲ Hide manual entry' : '▼ Or paste JSON manually'}
          </Text>
        </TouchableOpacity>

        {showManual && (
          <View style={styles.manualSection}>
            <Text style={styles.manualHint}>
              Paste a JSON object with any of: name, headline, summary, profileUrl, skills (array)
            </Text>
            <TextInput
              style={styles.jsonInput}
              value={manualJson}
              onChangeText={setManualJson}
              placeholder={'{\n  "name": "Your Name",\n  "headline": "Your role",\n  "skills": ["JavaScript", "React"]\n}'}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={8}
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.uploadBtn, (!manualJson.trim() || importing) && styles.btnDisabled]}
              onPress={handleManualImport}
              disabled={!manualJson.trim() || importing}
            >
              {importing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.uploadBtnText}>Import from JSON</Text>
              }
            </TouchableOpacity>
          </View>
        )}

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
  content:     { padding: spacing.md, gap: spacing.lg },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  infoTitle:   { ...typography.body, fontWeight: '700' },
  infoText:    { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  statusTitle:   { ...typography.label, textTransform: 'uppercase' },
  statusRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  statusText:   { ...typography.body, flex: 1 },
  resultCard: {
    backgroundColor: colors.primary + '15',
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
    borderWidth:     1,
    borderColor:     colors.primary + '40',
  },
  resultTitle: { ...typography.body, fontWeight: '700', color: colors.primary },
  resultText:  { ...typography.caption, color: colors.textSecondary },
  howTo: {
    gap:             spacing.xs,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  howToTitle:  { ...typography.body, fontWeight: '700', marginBottom: spacing.xs },
  howToStep:   { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  btnDisabled:    { opacity: 0.5 },
  uploadBtnText:  { ...typography.body, fontWeight: '700', color: '#fff' },
  manualToggle:   { alignItems: 'center', paddingVertical: spacing.xs },
  manualToggleText: { ...typography.body, color: colors.textMuted },
  manualSection:  { gap: spacing.md },
  manualHint:     { ...typography.caption, color: colors.textSecondary },
  jsonInput: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1.5,
    borderColor:       colors.border,
    padding:           spacing.md,
    ...typography.caption,
    color:             colors.textPrimary,
    fontFamily:        'monospace',
    minHeight:         160,
  },
})
