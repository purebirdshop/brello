// mobile/app/onboarding/follow-business.tsx
// Screen 9: follow your first employer location.
// Teaches the follow mechanic before the main map experience.

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { EmployerLocation } from '@localloop/shared'

interface LocationWithEmployer extends EmployerLocation {
  employer_name: string
  employer_logo: string | null
}

export default function OnboardingFollowBusiness() {
  const { advance, skip } = useOnboardingStep()
  const { hunterProfile } = useAuthStore()

  const [locations, setLocations]   = useState<LocationWithEmployer[]>([])
  const [followed, setFollowed]     = useState<Set<string>>(new Set())
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    loadNearbyLocations()
  }, [])

  async function loadNearbyLocations() {
    if (!hunterProfile?.current_lat || !hunterProfile?.current_lng) {
      // No location — load a few featured locations instead
      const { data } = await supabase
        .from('employer_locations')
        .select(`
          *,
          employer_profiles ( business_name, logo_url )
        `)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(8)

      if (data) {
        setLocations(
          data.map((l: any) => ({
            ...l,
            employer_name: l.employer_profiles?.business_name ?? 'Unknown',
            employer_logo: l.employer_profiles?.logo_url ?? null,
          }))
        )
      }
      setLoading(false)
      return
    }

    // PostGIS radius query via RPC — returns locations within 10 miles
    // (wider than normal for onboarding discovery)
    const { data } = await supabase.rpc('locations_near_point', {
      lat:          hunterProfile.current_lat,
      lng:          hunterProfile.current_lng,
      radius_miles: 10,
      limit_count:  8,
    })

    if (data) setLocations(data)
    setLoading(false)
  }

  async function handleFollow(locationId: string) {
    if (!hunterProfile) return

    if (followed.has(locationId)) {
      // Unfollow
      await supabase
        .from('location_follows')
        .delete()
        .eq('hunter_id', hunterProfile.id)
        .eq('employer_location_id', locationId)

      setFollowed((prev) => {
        const next = new Set(prev)
        next.delete(locationId)
        return next
      })
    } else {
      // Follow
      await supabase.from('location_follows').insert({
        hunter_id:            hunterProfile.id,
        employer_location_id: locationId,
        notify_all:           true,
        notify_matched_only:  false,
      })

      setFollowed((prev) => new Set(prev).add(locationId))
    }
  }

  function renderLocation({ item }: { item: LocationWithEmployer }) {
    const isFollowed = followed.has(item.id)

    return (
      <TouchableOpacity
        style={[styles.card, isFollowed && styles.cardFollowed]}
        onPress={() => handleFollow(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>
            {item.employer_name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.employer_name}</Text>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {item.name}  ·  {item.address}
          </Text>
        </View>

        <View style={[styles.followBtn, isFollowed && styles.followBtnActive]}>
          <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
            {isFollowed ? '✓' : '+'}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Screen padded>
      <ProgressBar currentStep="follow_business" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={typography.h2}>Follow a business</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            When a business you follow posts a new opening, you'll be the first
            to know — even before it shows up on your map.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textMuted }}>Finding businesses near you…</Text>
          </View>
        ) : locations.length === 0 ? (
          <View style={styles.center}>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              No businesses in your area yet — you'll be able to follow them
              directly from the map.
            </Text>
          </View>
        ) : (
          <FlatList
            data={locations}
            keyExtractor={(l) => l.id}
            renderItem={renderLocation}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.actions}>
          <Button
            label={followed.size > 0 ? `Continue with ${followed.size} followed` : 'Continue'}
            onPress={() => advance('follow_business')}
          />
          {followed.size === 0 && (
            <Button
              label="Skip for now"
              variant="ghost"
              onPress={() => skip('follow_business')}
            />
          )}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flex:          1,
    gap:           spacing.lg,
    paddingTop:    spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     'transparent',
  },
  cardFollowed: {
    borderColor:     colors.primary + '60',
    backgroundColor: colors.primary + '10',
  },
  cardAvatar: {
    width:           44,
    height:          44,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardAvatarText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  cardInfo: {
    flex: 1,
    gap:  2,
  },
  cardName: {
    ...typography.body,
    fontWeight: '600',
  },
  cardAddress: {
    ...typography.caption,
    color: colors.textMuted,
  },
  followBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.surface,
    borderWidth:     1.5,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  followBtnActive: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  followBtnText: {
    fontSize:   18,
    color:      colors.textSecondary,
    fontWeight: '600',
    lineHeight: 22,
  },
  followBtnTextActive: {
    color: '#fff',
  },
  actions: {
    gap: spacing.sm,
  },
  separator: {
    height:          1,
    backgroundColor: colors.border,
    opacity:         0.3,
    marginVertical:  2,
  },
})
