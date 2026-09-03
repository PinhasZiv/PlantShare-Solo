import type { Language } from './i18n/types'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  reminder_hour: number
  reminder_minute: number
  timezone: string
  /**
   * Null until the person has been on a device once. Nullable rather than
   * defaulted so a browser-detected language is not overwritten by a server
   * default the moment they sign in.
   */
  language: Language | null
}

export interface Space {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface Member {
  space_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'> | null
}

export interface Plant {
  id: string
  space_id: string
  name: string
  period_days: number
  next_due_date: string
  last_watered_date: string | null
  last_watered_by: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface WateringEvent {
  id: string
  plant_id: string
  space_id: string
  user_id: string
  watered_on: string
}
