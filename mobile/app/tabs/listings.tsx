// mobile/app/tabs/listings.tsx
// Secondary list view of all job listings within radius,
// sorted by distance. The map is primary; this is for
// scanning without the spatial context.

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../components/ui/Screen'
import { useMapStore, ListingPin } from '../../store/mapStore'
import { colors, spacing, radius, typography } from '../../lib/theme'

function ListingCard({
  listing,
  onPress,
}: {
  listing:  ListingPin
  onPress:  () => void
}) {
  const postedDate = listing.posted_at
    ? new Date(listing.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>
            {listing.employer_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardEmployer}>{listing.employer_name}</Text>
          <Text style={styles.cardLocation}>{listing.location_name}</Text>
        </View>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>
            {listing.distance_miles.toFixed(1)} mi
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{listing.title}</Text>

      {listing.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {listing.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {listing.tags.length > 3 && (
            <Text style={styles.tagMore}>+{listing.tags.length - 3}</Text>
          )}
        </View>
      )}

      {postedDate && (
        <Text style={styles.cardPosted}>Posted {postedDate}</Text>
      )}
    </TouchableOpacity>
  )
}

export default function ListingsTab() {
  const router = useRouter()
  const { listingPins, loadingListings } = useMapStore()

  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? listingPins.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.employer_name.toLowerCase().includes(search.toLowerCase()) ||
        l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : listingPins

  const sorted = [...filtered].sort((a, b) => a.distance_miles - b.distance_miles)

  function handleCardPress(listing: ListingPin) {
    // Navigate to map and select the listing
    // In Phase 3 we use the map store; Phase 5 gets a detail route
    router.push('/tabs/map' as any)
  }

  return (
    <Screen padded={false}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs, employers, skills..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Count header */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {loadingListings
            ? 'Loading…'
            : `${sorted.length} listing${sorted.length !== 1 ? 's' : ''} within your radius`}
        </Text>
      </View>

      {sorted.length === 0 && !loadingListings ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💼</Text>
          <Text style={styles.emptyTitle}>
            {search ? 'No matches found' : 'No listings in your radius yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {search
              ? 'Try a different search term.'
              : 'Grow your circle to expand your radius, or follow businesses to get notified when they post.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => handleCardPress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap:               spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex:     1,
    ...typography.body,
    color:    colors.textPrimary,
    padding:  0,
  },
  countRow: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  list: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  cardAvatar: {
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardAvatarText: {
    ...typography.body,
    fontWeight: '700',
    color:      colors.textSecondary,
    fontSize:   14,
  },
  cardMeta: {
    flex: 1,
    gap:  1,
  },
  cardEmployer: {
    ...typography.caption,
    fontWeight: '700',
    color:      colors.textPrimary,
  },
  cardLocation: {
    ...typography.caption,
    color: colors.textMuted,
  },
  distanceBadge: {
    backgroundColor: colors.primary + '20',
    borderRadius:    radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  distanceText: {
    ...typography.caption,
    color:      colors.primary,
    fontWeight: '700',
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    alignItems:    'center',
  },
  tag: {
    backgroundColor:  colors.surfaceLight,
    borderRadius:     radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  tagText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tagMore: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cardPosted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  separator: {
    height:        spacing.sm,
  },
  empty: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
})
