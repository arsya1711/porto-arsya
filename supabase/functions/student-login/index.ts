import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

type LoginBody = {
  student_number?: unknown
  password?: unknown
}

const hashValue = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405)
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 8192) return json({ error: 'Request terlalu besar.' }, 413)

  try {
    const body = await request.json() as LoginBody
    const studentNumber = typeof body.student_number === 'string' ? body.student_number.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (studentNumber.length < 3 || password.length < 8) {
      return json({ error: 'NIS atau kata sandi salah.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Konfigurasi layanan login belum lengkap.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('cf-connecting-ip')?.trim()
      || ''
    const nisHash = await hashValue(`nis:${studentNumber.toLowerCase()}`)
    const ipHash = forwardedIp ? await hashValue(`ip:${forwardedIp}`) : null
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const cleanupResult = await admin
      .from('student_login_attempts')
      .delete()
      .lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    if (cleanupResult.error) {
      return json({ error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
    }
    const [nisAttempts, ipAttempts] = await Promise.all([
      admin
        .from('student_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('nis_hash', nisHash)
        .gte('attempted_at', windowStart),
      ipHash
        ? admin
          .from('student_login_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash)
          .gte('attempted_at', windowStart)
        : Promise.resolve({ count: 0, error: null }),
    ])
    if (nisAttempts.error || ipAttempts.error) {
      return json({ error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
    }
    if ((nisAttempts.count ?? 0) >= 8 || (ipAttempts.count ?? 0) >= 20) {
      return json({ error: 'Terlalu banyak percobaan login. Coba kembali dalam 15 menit.' }, 429)
    }

    const recordFailure = async () => {
      const { error } = await admin.from('student_login_attempts').insert({
        nis_hash: nisHash,
        ip_hash: ipHash,
      })
      return !error
    }
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,full_name,email,student_number')
      .eq('student_number', studentNumber)
      .eq('role', 'siswa')
      .eq('active', true)
      .maybeSingle()

    if (profileError || !profile?.email) {
      if (!await recordFailure()) {
        return json({ error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
      }
      return json({ error: 'NIS atau kata sandi salah.' }, 401)
    }

    const auth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: authData, error: authError } = await auth.auth.signInWithPassword({
      email: profile.email,
      password,
    })
    if (authError || !authData.session) {
      if (!await recordFailure()) {
        return json({ error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
      }
      return json({ error: 'NIS atau kata sandi salah.' }, 401)
    }

    const { data: classMembership } = await admin
      .from('class_students')
      .select('classes(name)')
      .eq('student_id', profile.id)
      .maybeSingle()
    const classRelation = classMembership?.classes
    const className = Array.isArray(classRelation)
      ? classRelation[0]?.name
      : classRelation?.name

    return json({
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      },
      profile: {
        full_name: profile.full_name,
        student_number: profile.student_number,
        class_name: className ?? '-',
      },
    })
  } catch {
    return json({ error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
  }
})
