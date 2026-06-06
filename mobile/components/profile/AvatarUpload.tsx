// mobile/components/profile/AvatarUpload.tsx
// Handles picking an image from the camera roll and uploading
// it to Supabase Storage (avatars bucket).
// Returns the public URL on success.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { colors, spacing, radius, typography } from '../../lib/theme'

interface AvatarUploadProps {
  currentUrl:  string | null
  displayName: string
  onUploaded:  (url: string) => void
}

export function AvatarUpload({ currentUrl, displayName, onUploaded }: AvatarUploadProps) {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)

  async function handlePick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a profile photo.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:          ImagePicker.MediaTypeOptions.Images,
      allowsEditing:       true,
      aspect:              [1, 1],
      quality:             0.8,
      base64:              false,
    })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg')
  }

  async function uploadAvatar(uri: string, mimeType: string) {
    if (!user) return
    setUploading(true)

    try {
      // Read the file as a blob
      const response = await fetch(uri)
      const blob     = await response.blob()

      // Path: {userId}/avatar.jpg
      const ext      = mimeType.split('/')[1] ?? 'jpg'
      const path     = `${user.id}/avatar.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, {
          contentType: mimeType,
          upsert:      true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl

      // Update hunter_profile
      await supabase
        .from('hunter_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id)

      onUploaded(publicUrl)
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const initial = displayName.charAt(0).toUpperCase() || '?'

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePick}
      disabled={uploading}
      activeOpacity={0.8}
    >
      {currentUrl ? (
        <Image source={{ uri: currentUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      {/* Overlay */}
      <View style={styles.overlay}>
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.overlayText}>📷</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width:    88,
    height:   88,
    position: 'relative',
  },
  avatar: {
    width:        88,
    height:       88,
    borderRadius: 44,
  },
  avatarFallback: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitial: {
    fontSize:   40,
    fontWeight: '700',
    color:      '#fff',
  },
  overlay: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: colors.surface,
    borderWidth:     2,
    borderColor:     colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  overlayText: {
    fontSize: 14,
  },
})
