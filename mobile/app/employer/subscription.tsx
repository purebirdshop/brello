// mobile/app/employer/subscription.tsx
// Employer subscription management screen.
// Shows current plan, available plans, Stripe checkout,
// and customer portal link for billing management.

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius, typography } from '../../lib/theme'

interface Plan {
  tier:              string
  display_name:      string
  monthly_price_usd: number | null
  listing_cap:       number | null
  featured_fairs:    boolean
  analytics_access:  boolean
}

const PLAN_FEATURES: Record<string, string[]> = {
  free:         ['Up to 3 active listings', 'Basic map visibility', 'Introduction reviews'],
  pay_per_post: ['1 listing per purchase', 'All basic features', 'No monthly commitment'],
  base:         ['Unlimited listings', 'Analytics dashboard', 'Priority map placement'],
  founding:     ['Everything in Base', 'Featured at job fairs', 'Founding member badge', 'Rate locked forever'],
}

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  loading,
}: {
  plan:      Plan
  isCurrent: boolean
  onSelect:  (tier: string) => void
  loading:   boolean
}) {
  const features = PLAN_FEATURES[plan.tier] ?? []
  const isFree   = plan.tier === 'free'
  const price    = plan.monthly_price_usd

  return (
    <View style={[
      styles.planCard,
      isCurrent && styles.planCardCurrent,
      plan.tier === 'founding' && styles.planCardFounding,
    ]}>
      {plan.tier === 'founding' && (
        <View style={styles.foundingBadge}>
          <Text style={styles.foundingBadgeText}>⭐ FOUNDING MEMBER</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.display_name}</Text>
        <View style={styles.planPrice}>
          {isFree ? (
            <Text style={styles.planPriceFree}>Free</Text>
          ) : price === 0 ? (
            <Text style={styles.planPriceFree}>Free forever</Text>
          ) : plan.tier === 'pay_per_post' ? (
            <>
              <Text style={styles.planPriceAmount}>
                ${price?.toFixed(2)}
              </Text>
              <Text style={styles.planPricePer}>/post</Text>
            </>
          ) : (
            <>
              <Text style={styles.planPriceAmount}>
                ${price?.toFixed(2)}
              </Text>
              <Text style={styles.planPricePer}>/mo</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.featureList}>
        {features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {isCurrent ? (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current plan</Text>
        </View>
      ) : !isFree && plan.tier !== 'founding' ? (
        <TouchableOpacity
          style={[styles.selectBtn, loading && styles.selectBtnDisabled]}
          onPress={() => onSelect(plan.tier)}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.selectBtnText}>
                {plan.tier === 'pay_per_post' ? 'Buy a post' : 'Upgrade'}
              </Text>
          }
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export default function EmployerSubscriptionScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()

  const [plans, setPlans]             = useState<Plan[]>([])
  const [currentTier, setCurrentTier] = useState<string>('free')
  const [loading, setLoading]         = useState(true)
  const [checkoutLoading, setCheckout] = useState<string | null>(null)
  const [portalLoading, setPortal]    = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    const [plansRes, profileRes] = await Promise.all([
      fetch(`${process.env.EXPO_PUBLIC_API_URL}/stripe/plans`,
        { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${process.env.EXPO_PUBLIC_API_URL}/employer/profile`,
        { headers: { Authorization: `Bearer ${token}` } }),
    ])

    const plansData   = await plansRes.json()
    const profileData = await profileRes.json()

    setPlans(plansData.plans ?? [])

    // Get current subscription tier
    if (profileData.profile?.id) {
      const { data: sub } = await supabase
        .from('employer_subscriptions')
        .select('tier')
        .eq('employer_id', profileData.profile.id)
        .eq('status', 'active')
        .single()

      setCurrentTier(sub?.tier ?? 'free')
    }

    setLoading(false)
  }

  async function handleSelectPlan(tier: string) {
    setCheckout(tier)
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    try {
      const res  = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/stripe/checkout`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ tier }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Open Stripe checkout in browser
      await Linking.openURL(data.url)
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not start checkout')
    } finally {
      setCheckout(null)
    }
  }

  async function handleManageBilling() {
    setPortal(true)
    const session = await supabase.auth.getSession()
    const token   = session.data.session?.access_token

    try {
      const res  = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/stripe/portal`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    '{}',
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await Linking.openURL(data.url)
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not open billing portal')
    } finally {
      setPortal(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {plans.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                isCurrent={currentTier === plan.tier}
                onSelect={handleSelectPlan}
                loading={checkoutLoading === plan.tier}
              />
            ))}

            {currentTier !== 'free' && (
              <TouchableOpacity
                style={[styles.portalBtn, portalLoading && styles.portalBtnDisabled]}
                onPress={handleManageBilling}
                disabled={portalLoading}
              >
                {portalLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.portalBtnText}>Manage billing & invoices →</Text>
                }
              </TouchableOpacity>
            )}

            <Text style={styles.legalNote}>
              Payments processed securely by Stripe. Cancel anytime.
            </Text>
          </>
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
  content:     { padding: spacing.md, gap: spacing.md },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
  },
  planCardCurrent: {
    borderColor:     colors.primary,
    backgroundColor: colors.primary + '08',
  },
  planCardFounding: {
    borderColor:     colors.accent,
    backgroundColor: colors.accent + '08',
  },
  foundingBadge: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
    alignSelf:         'flex-start',
  },
  foundingBadgeText: { ...typography.caption, fontWeight: '800', color: '#fff', fontSize: 10 },
  planHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName:    { ...typography.h3 },
  planPrice:   { alignItems: 'flex-end' },
  planPriceFree: { ...typography.body, fontWeight: '700', color: colors.primary },
  planPriceAmount: { ...typography.h2, color: colors.textPrimary, fontSize: 22 },
  planPricePer:    { ...typography.caption, color: colors.textMuted },
  featureList: { gap: spacing.xs },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureCheck: { color: colors.primary, fontWeight: '700', width: 16 },
  featureText:  { ...typography.body, flex: 1, color: colors.textSecondary },
  currentBadge: {
    backgroundColor:   colors.primary + '20',
    borderRadius:      radius.md,
    paddingVertical:   spacing.sm,
    alignItems:        'center',
  },
  currentBadgeText: { ...typography.body, fontWeight: '700', color: colors.primary },
  selectBtn: {
    backgroundColor: colors.primary,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  selectBtnDisabled: { opacity: 0.5 },
  selectBtnText:     { ...typography.body, fontWeight: '700', color: '#fff' },
  portalBtn: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  portalBtnDisabled: { opacity: 0.5 },
  portalBtnText:     { ...typography.body, fontWeight: '600', color: colors.primary },
  legalNote:         { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
})
