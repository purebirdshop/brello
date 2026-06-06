// mobile/app/onboarding/find-contacts.tsx
// Screen 8: scan phone contacts for existing LocalLoop users.
// Non-users get an invite. Fully skippable.

import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/onboarding/ProgressBar'
import { colors, spacing, typography, radius } from '../../lib/theme'
import { useOnboardingStep } from '../../hooks/useOnboardingStep'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

interface ContactMatch {
  name:      string
  phone:     string
  userId:    string | null   // null = not on LocalLoop yet
  hunterId:  string | null
  invited:   boolean
  requested: boolean
}

export default function OnboardingFindContacts() {
  const { advance, skip }  = useOnboardingStep()
  const { hunterProfile }  = useAuthStore()

  const [contacts, setContacts]   = useState<ContactMatch[]>([])
  const [scanned, setScanned]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [scanning, setScanning]   = useState(false)

  async function handleScanContacts() {
    // expo-contacts integration — install expo-contacts in a follow-up pass
    // Stubbed to show the full flow without the native module
    setScanning(true)

    // Simulate a scan result for UI development
    await new Promise((r) => setTimeout(r, 1200))

    setContacts([
      // Placeholder — real implementation hashes phone numbers,
      // sends to API, matches against users.phone, returns results
      // without exposing any user's phone number to the client
    ])

    setScanned(true)
    setScanning(false)
  }

  async function handleAddToCircle(contact: ContactMatch) {
    if (!hunterProfile || !contact.hunterId) return

    await supabase.from('circle_members').insert({
      requester_id: hunterProfile.id,
      recipient_id: contact.hunterId,
      status:       'pending',
    })

    setContacts((prev) =>
      prev.map((c) =>
        c.phone === contact.phone ? { ...c, requested: true } : c
      )
    )
  }

  async function handleInvite(contact: ContactMatch) {
    // Deep link invite — wired to share sheet in a follow-up pass
    setContacts((prev) =>
      prev.map((c) =>
        c.phone === contact.phone ? { ...c, invited: true } : c
      )
    )
  }

  function renderContact({ item }: { item: ContactMatch }) {
    const isOnApp = !!item.userId

    return (
      <View style={styles.contactRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactSub}>
            {isOnApp ? 'On LocalLoop' : 'Not on LocalLoop yet'}
          </Text>
        </View>

        {isOnApp ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.requested && styles.actionBtnDone,
            ]}
            onPress={() => handleAddToCircle(item)}
            disabled={item.requested}
          >
            <Text style={styles.actionBtnText}>
              {item.requested ? 'Sent ✓' : 'Add'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnInvite,
              item.invited && styles.actionBtnDone,
            ]}
            onPress={() => handleInvite(item)}
            disabled={item.invited}
          >
            <Text style={styles.actionBtnText}>
              {item.invited ? 'Invited ✓' : 'Invite'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <Screen padded>
      <ProgressBar currentStep="find_contacts" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={typography.h2}>Find people you know</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            We'll check your contacts for friends already on LocalLoop. We
            never store or share your contact list.
          </Text>
        </View>

        {!scanned ? (
          <View style={styles.center}>
            <Text style={styles.contactsIcon}>👥</Text>
            <Button
              label={scanning ? 'Scanning...' : 'Scan my contacts'}
              onPress={handleScanContacts}
              loading={scanning}
            />
            <Button
              label="Skip this step"
              variant="ghost"
              onPress={() => skip('find_contacts')}
              disabled={scanning}
            />
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.contactsIcon}>🔍</Text>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              No contacts on LocalLoop yet — but that'll change fast. Invite
              someone to grow your circle and your radius.
            </Text>
            <Button
              label="Continue"
              onPress={() => advance('find_contacts')}
            />
          </View>
        ) : (
          <>
            <FlatList
              data={contacts}
              keyExtractor={(c) => c.phone}
              renderItem={renderContact}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
            />
            <Button
              label="Continue"
              onPress={() => advance('find_contacts')}
              loading={loading}
            />
          </>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flex:       1,
    gap:        spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
  },
  contactsIcon: {
    fontSize: 48,
  },
  list: {
    flex: 1,
  },
  contactRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.md,
    paddingVertical: spacing.sm,
  },
  contactAvatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.surfaceLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  contactInitial: {
    ...typography.body,
    fontWeight: '700',
    color:      colors.textSecondary,
  },
  contactInfo: {
    flex: 1,
    gap:  2,
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
  },
  contactSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    backgroundColor:   colors.primary,
  },
  actionBtnInvite: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  actionBtnDone: {
    backgroundColor: colors.surfaceLight,
    borderColor:     colors.surfaceLight,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },
  separator: {
    height:          1,
    backgroundColor: colors.border,
    opacity:         0.4,
  },
})
