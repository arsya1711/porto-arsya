import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export async function upsertSetting<T>(key: string, value: T) {
  if (!supabase) {
    localStorage.setItem(`pos:${key}`, JSON.stringify(value))
    return { offline: true }
  }

  const { error } = await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
  return { offline: false }
}

export function readLocalSetting<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(`pos:${key}`)
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}
