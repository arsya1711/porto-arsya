import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Role } from '../mockData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type Profile = {
  id: string
  full_name: string
  email: string
  role: Role
  student_number: string | null
  active: boolean
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  demo: boolean
  passwordRecovery: boolean
  login: (email: string, password: string) => Promise<Profile>
  loginDemo: (role: Role) => void
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile> => {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
    const { data, error } = await supabase.from('profiles').select('id,full_name,email,role,student_number,active').eq('id', userId).single()
    if (error) throw error
    if (!data.active) throw new Error('Akun ini sudah dinonaktifkan.')
    return data as Profile
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) {
        try { setProfile(await fetchProfile(data.session.user.id)) }
        catch { await client.auth.signOut(); setProfile(null) }
      }
      setLoading(false)
    })
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (!nextSession) { setProfile(null); setDemo(false); return }
      window.setTimeout(() => fetchProfile(nextSession.user.id).then(setProfile).catch(async() => { setProfile(null); await client.auth.signOut() }), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [fetchProfile])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    demo,
    passwordRecovery,
    login: async (email, password) => {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      let nextProfile: Profile
      try { nextProfile = await fetchProfile(data.user.id) }
      catch (error) { await supabase.auth.signOut(); throw error }
      if (!nextProfile) throw new Error('Profil pengguna tidak ditemukan.')
      setSession(data.session); setProfile(nextProfile); setDemo(false)
      return nextProfile
    },
    loginDemo: (role) => {
      if (isSupabaseConfigured) return
      setDemo(true)
      setProfile({ id: `demo-${role}`, full_name: role === 'siswa' ? 'Alya Putri' : role === 'admin' ? 'Admin Sekolah' : 'Ibu Rina', email: `demo-${role}@local`, role, student_number: role === 'siswa' ? '24001' : null, active: true })
    },
    logout: async () => { await supabase?.auth.signOut(); setSession(null); setProfile(null); setDemo(false) },
    resetPassword: async (email) => {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })
      if (error) throw error
    },
    updatePassword: async (password) => {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPasswordRecovery(false)
    },
    refreshProfile: async () => { if (session) setProfile(await fetchProfile(session.user.id)) },
  }), [session, profile, loading, demo, passwordRecovery, fetchProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  return context
}
