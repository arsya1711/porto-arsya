import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = () => (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const isAllowedOrigin = (origin: string | null) => {
  if (!origin || allowedOrigins().includes(origin)) return true
  try {
    const url = new URL(origin)
    return url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin')
  return {
    ...(origin && isAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }
}

const originAllowed = (request: Request) => {
  return isAllowedOrigin(request.headers.get('origin'))
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
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
  if (!originAllowed(request)) return json(request, { error: 'Origin tidak diizinkan.' }, 403)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Metode tidak didukung.' }, 405)
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 8192) return json(request, { error: 'Request terlalu besar.' }, 413)

  try {
    const body = await request.json() as LoginBody
    const studentNumber = typeof body.student_number === 'string' ? body.student_number.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (studentNumber.length < 3 || password.length < 8) {
      return json(request, { error: 'NIS atau kata sandi salah.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(request, { error: 'Konfigurasi layanan login belum lengkap.' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const forwardedIp = request.headers.get('cf-connecting-ip')?.trim()
      || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
      || ''
    const nisHash = await hashValue(`nis:${studentNumber.toLowerCase()}`)
    const ipHash = forwardedIp ? await hashValue(`ip:${forwardedIp}`) : null
    const reservation = await admin.rpc('reserve_student_login_attempt', {
      target_nis_hash: nisHash,
      target_ip_hash: ipHash,
    })
    if (reservation.error) return json(request, { error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
    if (!reservation.data) return json(request, { error: 'Terlalu banyak percobaan login. Coba kembali dalam 15 menit.' }, 429)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,full_name,email,student_number')
      .eq('student_number', studentNumber)
      .eq('role', 'siswa')
      .eq('active', true)
      .maybeSingle()

    if (profileError || !profile?.email) {
      return json(request, { error: 'NIS atau kata sandi salah.' }, 401)
    }

    const auth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: authData, error: authError } = await auth.auth.signInWithPassword({
      email: profile.email,
      password,
    })
    if (authError || !authData.session) {
      return json(request, { error: 'NIS atau kata sandi salah.' }, 401)
    }

    const { data: classMembership } = await admin
      .from('class_students')
      .select('classes(name)')
      .eq('student_id', profile.id)
      .maybeSingle()
    const classRelation = classMembership?.classes as { name?: string } | { name?: string }[] | null | undefined
    const className = Array.isArray(classRelation)
      ? classRelation[0]?.name
      : classRelation?.name

    return json(request, {
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
    return json(request, { error: 'Layanan login sedang bermasalah. Silakan coba lagi.' }, 500)
  }
})
