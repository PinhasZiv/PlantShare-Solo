import { strings } from './strings'
import { supabase } from './supabase'
import type { Member, Plant, Profile, Space, WateringEvent } from './types'

// Thin wrappers over the queries the screens need. Errors are thrown rather
// than returned so callers can use one try/catch per user action, and RLS does
// the access control - none of these functions filter by user themselves.

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data as Profile
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

/**
 * Everyone the signed-in user shares a space with, plus themselves. RLS decides
 * the set; the app just needs the names to say "watered by Dana".
 */
export async function fetchPeople(): Promise<Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>[]> {
  const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_url, email')
  if (error) throw error
  return data ?? []
}

export async function fetchSpaces(): Promise<Space[]> {
  const { data, error } = await supabase.from('spaces').select('*').order('created_at')
  if (error) throw error
  return (data ?? []) as Space[]
}

export async function createSpace(name: string): Promise<Space> {
  const { data, error } = await supabase.rpc('create_space', { p_name: name }).single()
  if (error) throw error
  return data as Space
}

export async function joinSpace(code: string): Promise<Space> {
  const { data, error } = await supabase
    .rpc('join_space_by_code', { p_code: code.trim().toUpperCase() })
    .single()
  if (error) {
    // מסד הנתונים זורק קוד יבש; כאן הוא הופך למשהו קריא.
    throw new Error(
      error.message.includes('no_such_code') ? strings.errors.noSuchCode : error.message,
    )
  }
  return data as Space
}

export async function leaveSpace(spaceId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_space', { p_space: spaceId })
  if (error) {
    throw new Error(
      error.message.includes('last_owner') ? strings.errors.lastOwner : error.message,
    )
  }
}

export async function renameSpace(spaceId: string, name: string): Promise<void> {
  const { error } = await supabase.from('spaces').update({ name }).eq('id', spaceId)
  if (error) throw error
}

export async function deleteSpace(spaceId: string): Promise<void> {
  const { error } = await supabase.from('spaces').delete().eq('id', spaceId)
  if (error) throw error
}

export async function fetchMembers(spaceId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('space_members')
    .select('space_id, user_id, role, joined_at, profile:profiles(id, display_name, avatar_url, email)')
    .eq('space_id', spaceId)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as Member[]
}

export async function fetchPlants(spaceId: string): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('space_id', spaceId)
    .order('next_due_date')
  if (error) throw error
  return (data ?? []) as Plant[]
}

/** Every plant across every space the user belongs to, for the Tonight view. */
export async function fetchAllPlants(): Promise<Plant[]> {
  const { data, error } = await supabase.from('plants').select('*').order('next_due_date')
  if (error) throw error
  return (data ?? []) as Plant[]
}

export interface NewPlant {
  spaceId: string
  name: string
  periodDays: number
  firstDueDate: string
  notes?: string
}

export async function createPlant(plant: NewPlant, userId: string): Promise<Plant> {
  const { data, error } = await supabase
    .from('plants')
    .insert({
      space_id: plant.spaceId,
      name: plant.name.trim(),
      period_days: plant.periodDays,
      next_due_date: plant.firstDueDate,
      notes: plant.notes?.trim() || null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data as Plant
}

export async function updatePlant(plantId: string, patch: Partial<Plant>): Promise<Plant> {
  const { data, error } = await supabase
    .from('plants')
    .update(patch)
    .eq('id', plantId)
    .select()
    .single()
  if (error) throw error
  return data as Plant
}

export async function deletePlant(plantId: string): Promise<void> {
  const { error } = await supabase.from('plants').delete().eq('id', plantId)
  if (error) throw error
}

/**
 * Marks a plant watered today and starts its next period. Returns the event id
 * so the undo button has something to point at.
 */
export async function markWatered(plantId: string, today: string): Promise<WateringEvent> {
  const { data, error } = await supabase
    .rpc('mark_watered', { p_plant: plantId, p_today: today })
    .single()
  if (error) throw error
  return data as WateringEvent
}

export async function undoWatering(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_watering', { p_event: eventId })
  if (error) throw error
}

/** Recent waterings for a plant, newest first. */
export async function fetchHistory(plantId: string, limit = 10) {
  const { data, error } = await supabase
    .from('watering_events')
    .select('id, watered_on, user_id, created_at')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
