// mobile/components/skills/SkillTagSelector.tsx
// Searchable skill tag selector. Shows selected tags at top,
// lets you search the full skill_tags table, and add/remove.
// Used on the hunter profile and employer listing form.

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius, typography } from '../../lib/theme'

interface SkillTag {
  id:    string
  label: string
}

interface SkillTagSelectorProps {
  selectedIds: string[]
  onChange:    (ids: string[]) => void
  maxTags?:    number
}

export function SkillTagSelector({
  selectedIds,
  onChange,
  maxTags = 20,
}: SkillTagSelectorProps) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<SkillTag[]>([])
  const [selectedTags, setSelected]   = useState<SkillTag[]>([])
  const [loading, setLoading]         = useState(false)

  // Load initial selected tags
  useEffect(() => {
    if (selectedIds.length === 0) { setSelected([]); return }
    supabase
      .from('skill_tags')
      .select('id, label')
      .in('id', selectedIds)
      .then(({ data }) => setSelected(data ?? []))
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)

    const { data } = await supabase
      .from('skill_tags')
      .select('id, label')
      .ilike('label', `%${q}%`)
      .eq('is_active', true)
      .not('id', 'in', `(${selectedIds.join(',') || 'null'})`)
      .limit(20)

    setResults(data ?? [])
    setLoading(false)
  }, [selectedIds])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  function addTag(tag: SkillTag) {
    if (selectedIds.includes(tag.id) || selectedIds.length >= maxTags) return
    const newSelected = [...selectedTags, tag]
    setSelected(newSelected)
    onChange(newSelected.map((t) => t.id))
    setQuery('')
    setResults([])
  }

  function removeTag(tagId: string) {
    const newSelected = selectedTags.filter((t) => t.id !== tagId)
    setSelected(newSelected)
    onChange(newSelected.map((t) => t.id))
  }

  return (
    <View style={styles.container}>
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <View style={styles.selectedWrap}>
          {selectedTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={styles.selectedTag}
              onPress={() => removeTag(tag.id)}
            >
              <Text style={styles.selectedTagText}>{tag.label}</Text>
              <Text style={styles.removeIcon}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={
            selectedIds.length >= maxTags
              ? `Max ${maxTags} skills selected`
              : 'Search skills…'
          }
          placeholderTextColor={colors.textMuted}
          editable={selectedIds.length < maxTags}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
      </View>

      {/* Search results */}
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={styles.resultRow}
              onPress={() => addTag(tag)}
            >
              <Text style={styles.resultText}>{tag.label}</Text>
              <Text style={styles.addIcon}>+</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.count}>
        {selectedIds.length}/{maxTags} selected
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { gap: spacing.sm },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  selectedTag: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   colors.primary + '20',
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       colors.primary + '60',
  },
  selectedTagText:  { ...typography.caption, color: colors.primary, fontWeight: '700' },
  removeIcon:       { fontSize: 10, color: colors.primary },
  searchRow:        { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex:              1,
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1.5,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...typography.body,
    color:             colors.textPrimary,
    height:            48,
  },
  loader:   { position: 'absolute', right: spacing.md },
  results: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  resultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: { ...typography.body, flex: 1 },
  addIcon:    { fontSize: 20, color: colors.primary, fontWeight: '700' },
  count:      { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
})
