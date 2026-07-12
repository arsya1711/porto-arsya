import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  action: 'create' | 'set_active' | 'reset_password'
  user_id?: string
  full_name?: string
  email?: string
  password?: string
  role?: 'admin' | 'guru' | 'siswa'
  student_number?: string | null
  active?: boolean
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Sesi tidak ditemukan.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const token = authorization.replace('Bearer ', '')
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return json({ error: 'Sesi tidak valid.' }, 401)

    const { data: caller } = await admin.from('profiles').select('role,active').eq('id', callerData.user.id).single()
    if (!caller?.active || caller.role !== 'admin') return json({ error: 'Hanya admin yang dapat mengelola akun.' }, 403)

    const body = await request.json() as RequestBody
    if (body.action === 'create') {
      if (!body.full_name?.trim() || !body.email?.trim() || !body.password || !body.role) return json({ error: 'Data akun belum lengkap.' }, 400)
      if (body.password.length < 8) return json({ error: 'Kata sandi minimal 8 karakter.' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true,
        user_metadata: { full_name: body.full_name.trim(), role: body.role },
      })
      if (error) return json({ error: error.message }, 400)
      const { error: profileError } = await admin.from('profiles').update({
        full_name: body.full_name.trim(), role: body.role,
        student_number: body.role === 'siswa' ? body.student_number || null : null, active: true,
      }).eq('id', data.user.id)
      if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: profileError.message }, 400) }
      await admin.from('audit_logs').insert({ actor_id: callerData.user.id, action: 'user.created', entity_type: 'profile', entity_id: data.user.id, metadata: { role: body.role } })
      return json({ user_id: data.user.id }, 201)
    }

    if (!body.user_id) return json({ error: 'ID pengguna wajib diisi.' }, 400)
    if (body.action === 'set_active') {
      if (body.user_id === callerData.user.id && body.active === false) return json({ error: 'Admin tidak dapat menonaktifkan akunnya sendiri.' }, 400)
      const active = Boolean(body.active)
      const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: active ? 'none' : '876000h' })
      if (authError) return json({ error: authError.message }, 400)
      const { error } = await admin.from('profiles').update({ active }).eq('id', body.user_id)
      if (error) return json({ error: error.message }, 400)
      await admin.from('audit_logs').insert({ actor_id: callerData.user.id, action: active ? 'user.activated' : 'user.deactivated', entity_type: 'profile', entity_id: body.user_id })
      return json({ active })
    }

    if (body.action === 'reset_password') {
      if (!body.password || body.password.length < 8) return json({ error: 'Kata sandi minimal 8 karakter.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password })
      if (error) return json({ error: error.message }, 400)
      await admin.from('audit_logs').insert({ actor_id: callerData.user.id, action: 'user.password_reset', entity_type: 'profile', entity_id: body.user_id })
      return json({ updated: true })
    }
    return json({ error: 'Aksi tidak dikenali.' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan server.' }, 500)
  }
})
