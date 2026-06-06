// mobile/components/profile/ResumeUpload.tsx
// Picks a PDF resume and uploads it to Supabase Storage
// (resumes bucket, private). Updates the resumes table.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, radius, typography } from '../../lib/theme'

interface ResumeUploadProps {
  currentFileName?: string | null
  onUploaded: (fileUrl: string, fileName: string) => void
}

export function ResumeUpload({ currentFileName, onUploaded }: ResumeUploadProps) {
  const { user, hunterProfile } = useAuthStore()
  const [uploading, setUploading] = useState(false)

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type:      'application/pdf',
      copyToCacheDirectory: true,
    })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    await uploadResume(asset.uri, asset.name ?? 'resume.pdf')
  }

  async function uploadResume(uri: string, fileName: string) {
    if (!user || !hunterProfile) return
    setUploading(true)

    try {
      const response = await fetch(uri)
      const blob     = await response.blob()

      const path = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(path, blob, {
          contentType: 'application/pdf',
          upsert:      true,
        })

      if (uploadError) throw uploadError

      // Get private URL (signed, 1 hour)
      const { data: signedData } = await supabase.storage
        .from('resumes')
        .createSignedUrl(path, 3600)

      const fileUrl = signedData?.signedUrl ?? path

      // Upsert resume record
      await supabase.from('resumes').upsert({
        hunter_id:   hunterProfile.id,
        source:      'upload',
        file_url:    fileUrl,
        imported_at: new Date().toISOString(),
      }, { onConflict: 'hunter_id' })

      onUploaded(fileUrl, fileName)
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload resume.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <TouchableOpacity
      style={styles.dropZone}
      onPress={handlePick}
      disabled={uploading}
      activeOpacity={0.8}
    >
      {uploading ? (
        <ActivityIndicator color={colors.primary} />
      ) : currentFileName ? (
        <>
          <Text style={styles.fileIcon}>📄</Text>
          <Text style={styles.fileName}>{currentFileName}</Text>
          <Text style={styles.changeText}>Tap to replace</Text>
        </>
      ) : (
        <>
          <Text style={styles.fileIcon}>📄</Text>
          <Text style={styles.uploadText}>Upload PDF resume</Text>
          <Text style={styles.hintText}>Tap to browse your files</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  dropZone: {
    borderWidth:     1.5,
    borderColor:     colors.border,
    borderStyle:     'dashed',
    borderRadius:    radius.md,
    padding:         spacing.xl,
    alignItems:      'center',
    gap:             spacing.xs,
    backgroundColor: colors.surface,
  },
  fileIcon:    { fontSize: 36 },
  fileName:    { ...typography.body, fontWeight: '600' },
  changeText:  { ...typography.caption, color: colors.textMuted },
  uploadText:  { ...typography.body, fontWeight: '600' },
  hintText:    { ...typography.caption, color: colors.textMuted },
})
