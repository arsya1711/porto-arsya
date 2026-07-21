import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue, type Profile } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
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
    let active = true
    let profileRequest = 0

    const clearSession = () => {
      profileRequest += 1
      if (!active) return
      setSession(null)
      setProfile(null)
      setLoading(false)
    }

    const loadSessionProfile = (nextSession: Session) => {
      const request = ++profileRequest
      if (!active) return
      setSession(nextSession)
      setProfile((current) => current?.id === nextSession.user.id ? current : null)

      // Jangan menunggu query Supabase lain di dalam callback Auth karena
      // keduanya memakai lock yang sama. Request lama juga tidak boleh
      // menghidupkan kembali profil setelah sesi sudah keluar atau berganti.
      window.setTimeout(() => {
        void fetchProfile(nextSession.user.id)
          .then((nextProfile) => {
            if (!active || request !== profileRequest) return
            setProfile(nextProfile)
            setLoading(false)
          })
          .catch(() => {
            if (!active || request !== profileRequest) return
            clearSession()
            // Bersihkan browser ini tanpa bergantung pada refresh token yang
            // mungkin sudah kedaluwarsa atau dicabut.
            void client.auth.signOut({ scope: 'local' })
          })
      }, 0)
    }

    // onAuthStateChange selalu mengirim INITIAL_SESSION. Bila refresh token
    // ditolak (HTTP 400), Supabase mengirim sesi null dan UI kembali ke login,
    // bukan tertahan di layar putih/loading.
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (!nextSession) {
        clearSession()
        return
      }
      loadSessionProfile(nextSession)
    })

    return () => {
      active = false
      profileRequest += 1
      listener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    passwordRecovery,
    login: async (email, password) => {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      let nextProfile: Profile
      try { nextProfile = await fetchProfile(data.user.id) }
      catch (error) { await supabase.auth.signOut({ scope: 'local' }); throw error }
      if (!nextProfile) throw new Error('Profil pengguna tidak ditemukan.')
      setSession(data.session); setProfile(nextProfile)
      return nextProfile
    },
    logout: async () => {
      try { await supabase?.auth.signOut({ scope: 'local' }) }
      finally { setSession(null); setProfile(null) }
    },
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
  }), [session, profile, loading, passwordRecovery, fetchProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
