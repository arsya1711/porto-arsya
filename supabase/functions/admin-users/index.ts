import { createClient } from 'npm:@supabase/supabase-js@2'

type RequestBody = {
  action: 'create' | 'update' | 'delete' | 'set_active' | 'reset_password'
  user_id?: string
  full_name?: string
  email?: string
  password?: string
  role?: 'admin' | 'guru' | 'siswa'
  student_number?: string | null
  class_id?: string | null
  active?: boolean
}

const allowedOrigins = () => (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const originAllowed = (request: Request) => {
  const origin = request.headers.get('origin')
  return !origin || allowedOrigins().includes(origin)
}

const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin')
  const allowed = allowedOrigins()
  return {
    ...(origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (!originAllowed(request)) return json(request, { error: 'Origin tidak diizinkan.' }, 403)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Metode tidak didukung.' }, 405)
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 16384) return json(request, { error: 'Request terlalu besar.' }, 413)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json(request, { error: 'Konfigurasi layanan admin belum lengkap.' }, 500)

    const authorization = request.headers.get('Authorization')
    if (!authorization) return json(request, { error: 'Sesi tidak ditemukan.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const token = authorization.replace('Bearer ', '')
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return json(request, { error: 'Sesi tidak valid.' }, 401)

    const { data: caller } = await admin.from('profiles').select('role,active').eq('id', callerData.user.id).single()
    if (!caller?.active || caller.role !== 'admin') return json(request, { error: 'Hanya admin yang dapat mengelola akun.' }, 403)

    const body = await request.json() as RequestBody
    if (body.action === 'create') {
      if (!body.full_name?.trim() || !body.email?.trim() || !body.password || !body.role) return json(request, { error: 'Data akun belum lengkap.' }, 400)
      if (body.password.length < 8) return json(request, { error: 'Kata sandi minimal 8 karakter.' }, 400)
      const studentNumber = body.role === 'siswa' ? body.student_number?.trim() || null : null
      if (body.role === 'siswa' && !studentNumber) return json(request, { error: 'NIS siswa wajib diisi.' }, 400)

      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim(), role: body.role },
      })
      if (error) return json(request, { error: error.message }, 400)

      const profileResult = await admin.rpc('save_managed_user_profile', {
        actor_user_id: callerData.user.id,
        target_user_id: data.user.id,
        target_full_name: body.full_name.trim(),
        target_email: body.email.trim().toLowerCase(),
        target_role: body.role,
        target_student_number: studentNumber,
        target_class_id: body.class_id ?? null,
        audit_action: 'user.created',
      })
      if (profileResult.error) {
        await admin.auth.admin.deleteUser(data.user.id)
        return json(request, { error: profileResult.error.message }, 400)
      }
      return json(request, { user_id: data.user.id }, 201)
    }

    if (!body.user_id) return json(request, { error: 'ID pengguna wajib diisi.' }, 400)
    if (body.action === 'update') {
      if (!body.full_name?.trim() || !body.email?.trim() || !body.role) return json(request, { error: 'Data akun belum lengkap.' }, 400)
      if (body.user_id === callerData.user.id && body.role !== 'admin') return json(request, { error: 'Admin tidak dapat menurunkan role akunnya sendiri.' }, 400)
      const email = body.email.trim().toLowerCase()
      const studentNumber = body.role === 'siswa' ? body.student_number?.trim() || null : null
      if (body.role === 'siswa' && !studentNumber) return json(request, { error: 'NIS siswa wajib diisi.' }, 400)

      const previousAuth = await admin.auth.admin.getUserById(body.user_id)
      if (previousAuth.error || !previousAuth.data.user) return json(request, { error: 'Akun pengguna tidak ditemukan.' }, 404)
      const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, {
        email,
        user_metadata: { full_name: body.full_name.trim(), role: body.role },
      })
      if (authError) return json(request, { error: authError.message }, 400)

      const profileResult = await admin.rpc('save_managed_user_profile', {
        actor_user_id: callerData.user.id,
        target_user_id: body.user_id,
        target_full_name: body.full_name.trim(),
        target_email: email,
        target_role: body.role,
        target_student_number: studentNumber,
        target_class_id: body.class_id ?? null,
        audit_action: 'user.updated',
      })
      if (profileResult.error) {
        const restoreResult = await admin.auth.admin.updateUserById(body.user_id, {
          email: previousAuth.data.user.email,
          user_metadata: previousAuth.data.user.user_metadata,
        })
        const suffix = restoreResult.error ? ' Pemulihan Auth juga gagal; periksa akun secara manual.' : ''
        return json(request, { error: `${profileResult.error.message}.${suffix}` }, 400)
      }
      return json(request, { updated: true })
    }

    if (body.action === 'delete') {
      if (body.user_id === callerData.user.id) return json(request, { error: 'Admin tidak dapat menghapus akunnya sendiri.' }, 400)
      const { error } = await admin.auth.admin.deleteUser(body.user_id)
      if (error) return json(request, { error: `Akun tidak dapat dihapus: ${error.message}. Nonaktifkan akun bila masih memiliki data terkait.` }, 400)
      const audit = await admin.from('audit_logs').insert({ actor_id: callerData.user.id, action: 'user.deleted', entity_type: 'profile', entity_id: body.user_id })
      return json(request, { deleted: true, audit_warning: audit.error?.message })
    }

    if (body.action === 'set_active') {
      if (body.user_id === callerData.user.id && body.active === false) return json(request, { error: 'Admin tidak dapat menonaktifkan akunnya sendiri.' }, 400)
      const active = Boolean(body.active)
      const previousProfile = await admin.from('profiles').select('active').eq('id', body.user_id).single()
      if (previousProfile.error) return json(request, { error: 'Profil pengguna tidak ditemukan.' }, 404)
      const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: active ? 'none' : '876000h' })
      if (authError) return json(request, { error: authError.message }, 400)
      const profileResult = await admin.rpc('set_managed_user_active', {
        actor_user_id: callerData.user.id,
        target_user_id: body.user_id,
        target_active: active,
      })
      if (profileResult.error) {
        const restoreResult = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: previousProfile.data.active ? 'none' : '876000h' })
        const suffix = restoreResult.error ? ' Pemulihan status Auth juga gagal; periksa akun secara manual.' : ''
        return json(request, { error: `${profileResult.error.message}.${suffix}` }, 400)
      }
      return json(request, { active })
    }

    if (body.action === 'reset_password') {
      if (!body.password || body.password.length < 8) return json(request, { error: 'Kata sandi minimal 8 karakter.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password })
      if (error) return json(request, { error: error.message }, 400)
      const audit = await admin.from('audit_logs').insert({ actor_id: callerData.user.id, action: 'user.password_reset', entity_type: 'profile', entity_id: body.user_id })
      return json(request, { updated: true, audit_warning: audit.error?.message })
    }
    return json(request, { error: 'Aksi tidak dikenali.' }, 400)
  } catch {
    return json(request, { error: 'Terjadi kesalahan server.' }, 500)
  }
})
