// api/routes/linkedin.ts
// LinkedIn import endpoints:
//   POST /linkedin/import     — accepts LinkedIn profile JSON export,
//                               parses it, and populates hunter profile fields
//   GET  /linkedin/status     — returns last import status

import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

export const linkedinRouter = Router()
linkedinRouter.use(requireAuth)

// ── POST /linkedin/import ─────────────────────
// Accepts a LinkedIn profile JSON export (from LinkedIn's
// Data Export > Profile.json) or a simplified object
// with the fields we care about. Populates:
//   - hunter_profile: display_name, bio, linkedin_url
//   - resumes: linkedin_raw_json
//   - hunter_skills: mapped from LinkedIn skills array

linkedinRouter.post('/import', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest
  const { profile_data } = req.body

  if (!profile_data) {
    return res.status(400).json({ error: 'profile_data required' })
  }

  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!hunter) return res.status(404).json({ error: 'Hunter profile not found' })

  // Create import tracking record
  const { data: importRecord } = await supabaseAdmin
    .from('linkedin_imports')
    .insert({
      hunter_id: hunter.id,
      status:    'processing',
    })
    .select()
    .single()

  try {
    const parsed = parseLinkedInData(profile_data)

    // Update hunter profile
    const profileUpdates: any = {}
    if (parsed.displayName) profileUpdates.display_name = parsed.displayName
    if (parsed.bio)         profileUpdates.bio          = parsed.bio
    if (parsed.linkedinUrl) profileUpdates.linkedin_url = parsed.linkedinUrl

    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin
        .from('hunter_profiles')
        .update(profileUpdates)
        .eq('id', hunter.id)
    }

    // Upsert resume with raw JSON
    await supabaseAdmin
      .from('resumes')
      .upsert({
        hunter_id:         hunter.id,
        source:            'linkedin_import',
        linkedin_raw_json: profile_data,
        imported_at:       new Date().toISOString(),
      }, { onConflict: 'hunter_id' })

    // Map LinkedIn skills to skill_tags
    if (parsed.skills.length > 0) {
      const matchedSkills = await matchSkillTags(parsed.skills)

      if (matchedSkills.length > 0) {
        // Upsert hunter_skills (don't blow away existing)
        const existing = await supabaseAdmin
          .from('hunter_skills')
          .select('skill_tag_id')
          .eq('hunter_id', hunter.id)

        const existingIds = new Set(
          (existing.data ?? []).map((r: any) => r.skill_tag_id)
        )

        const newSkills = matchedSkills
          .filter((id) => !existingIds.has(id))
          .map((skill_tag_id) => ({ hunter_id: hunter.id, skill_tag_id }))

        if (newSkills.length > 0) {
          await supabaseAdmin.from('hunter_skills').insert(newSkills)
        }
      }
    }

    // Mark import done
    await supabaseAdmin
      .from('linkedin_imports')
      .update({
        status:      'done',
        raw_payload: profile_data,
        imported_at: new Date().toISOString(),
      })
      .eq('id', importRecord!.id)

    return res.json({
      status:          'done',
      fields_imported: Object.keys(profileUpdates),
      skills_added:    (await matchSkillTags(parsed.skills)).length,
    })
  } catch (err: any) {
    await supabaseAdmin
      .from('linkedin_imports')
      .update({ status: 'failed', error: err.message })
      .eq('id', importRecord!.id)

    return res.status(500).json({ error: err.message })
  }
})

// ── GET /linkedin/status ──────────────────────

linkedinRouter.get('/status', async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest

  const { data: hunter } = await supabaseAdmin
    .from('hunter_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!hunter) return res.status(404).json({ error: 'Not found' })

  const { data } = await supabaseAdmin
    .from('linkedin_imports')
    .select('status, imported_at, error')
    .eq('hunter_id', hunter.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return res.json({ import: data ?? null })
})

// ── Helpers ───────────────────────────────────

interface ParsedLinkedIn {
  displayName: string | null
  bio:         string | null
  linkedinUrl: string | null
  skills:      string[]
}

function parseLinkedInData(raw: any): ParsedLinkedIn {
  // Handles two common LinkedIn export formats:
  // 1. LinkedIn Data Export JSON (Profile.json)
  // 2. Simplified object { name, headline, summary, skills, profileUrl }

  // LinkedIn Data Export format
  if (raw.firstName || raw.lastName) {
    return {
      displayName: [raw.firstName, raw.lastName].filter(Boolean).join(' ') || null,
      bio:         raw.summary ?? raw.headline ?? null,
      linkedinUrl: raw.profileUrl ?? null,
      skills:      (raw.skills ?? []).map((s: any) =>
        typeof s === 'string' ? s : s.name ?? ''
      ).filter(Boolean),
    }
  }

  // Simplified format
  return {
    displayName: raw.name ?? null,
    bio:         raw.headline ?? raw.summary ?? null,
    linkedinUrl: raw.profileUrl ?? null,
    skills:      (raw.skills ?? []).map((s: any) =>
      typeof s === 'string' ? s : s.name ?? ''
    ).filter(Boolean),
  }
}

async function matchSkillTags(skillLabels: string[]): Promise<string[]> {
  if (skillLabels.length === 0) return []

  // Case-insensitive match against skill_tags.label
  const { data } = await supabaseAdmin
    .from('skill_tags')
    .select('id, label')
    .in(
      'label',
      skillLabels.map((s) => s.toLowerCase())
    )
    .eq('is_active', true)

  // Also try partial matches for common variations
  const matched = new Set<string>((data ?? []).map((r: any) => r.id))

  if (skillLabels.length > 0) {
    // Fuzzy match via ilike for unmatched skills
    const unmatchedLabels = skillLabels.filter((label) =>
      !(data ?? []).some((d: any) =>
        d.label.toLowerCase() === label.toLowerCase()
      )
    )

    for (const label of unmatchedLabels.slice(0, 20)) {
      const { data: fuzzy } = await supabaseAdmin
        .from('skill_tags')
        .select('id')
        .ilike('label', `%${label}%`)
        .eq('is_active', true)
        .limit(1)

      if (fuzzy?.[0]) matched.add(fuzzy[0].id)
    }
  }

  return Array.from(matched)
}
