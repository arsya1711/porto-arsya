import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export async function signIn(email: string, password: string) {
  if (!supabase) return { role: 'guru' as const }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
  return { role: (profile?.role ?? 'guru') as 'admin' | 'guru' | 'siswa' }
}

export async function signOut() { await supabase?.auth.signOut() }

export function loadLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(`ruang-ujian:${key}`) ?? '') as T }
  catch { return fallback }
}

export function saveLocal<T>(key: string, value: T) {
  localStorage.setItem(`ruang-ujian:${key}`, JSON.stringify(value))
}
