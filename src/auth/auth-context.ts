import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Role } from '../types'

export type Profile = {
  id: string
  full_name: string
  email: string
  role: Role
  student_number: string | null
  active: boolean
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  passwordRecovery: boolean
  login: (email: string, password: string) => Promise<Profile>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  return context
}
