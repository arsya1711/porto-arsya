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
  try {
    localStorage.setItem(`ruang-ujian:${key}`, JSON.stringify(value))
    return true
  } catch {
    // Storage dapat ditolak dalam mode privat atau ketika kuota penuh. Data
    // tetap hidup di state dan masih akan dikirim ke server oleh pemanggil.
    return false
  }
}
