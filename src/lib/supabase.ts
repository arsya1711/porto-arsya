import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export function loadLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(`ruang-ujian:${key}`) ?? '') as T }
  catch { return fallback }
}

export function saveLocal<T>(key: string, value: T) {
  localStorage.setItem(`ruang-ujian:${key}`, JSON.stringify(value))
}
