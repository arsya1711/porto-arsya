import { createClient } from 'npm:@supabase/supabase-js@2'

// Ekstraksi soal dari teks naskah ujian menggunakan Cerebras Inference.
//
// Teks dikirim dari klien (sudah diekstrak pdfjs/mammoth/OCR), bukan berkas
// mentah: free tier Cerebras hanya melayani model teks dengan batas konteks
// 8.192 token, dan pipeline ekstraksi teks sudah ada di frontend.
//
// Kunci jawaban sengaja TIDAK diminta dari model. Naskah ujian umumnya tidak
// memuatnya, sehingga model hanya bisa menebak dari pengetahuan umum — tebakan
// yang salah membuat siswa dinilai keliru. Kunci diisi guru di layar preview.

const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions'
const MODEL = 'gpt-oss-120b'

// Batas konteks free tier 8.192 token dipakai bersama prompt, naskah, dan
// output JSON. Terukur pada naskah nyata: 3.565 karakter / 20 soal memakai
// 4.557 token (1.675 prompt + 2.882 output, termasuk ~1.700 token penalaran).
// Panjang output mengikuti JUMLAH SOAL, bukan panjang naskah — sekitar 145
// token per soal — sehingga naskah di atas ~30 soal berisiko melebihi konteks
// dan JSON-nya terpotong. Batas karakter di bawah kira-kira setara 30 soal.
const MAX_SOURCE_CHARS = 6000

const allowedOrigins = () => (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

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

const originAllowed = (request: Request) => {
  const origin = request.headers.get('origin')
  return !origin || allowedOrigins().includes(origin)
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
})

// Skema mengikuti aturan ketat Cerebras yang berlaku sejak 21 Juli 2026:
// root wajib `type: object` dan setiap objek wajib `additionalProperties: false`.
// Fitur yang tidak didukung (pattern, format, minItems/maxItems) tidak dipakai.
const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          number: { type: 'integer' },
          type: { type: 'string', enum: ['pilihan_ganda', 'essay'] },
          text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['number', 'type', 'text', 'options'],
      },
    },
  },
  required: ['questions'],
}

const SYSTEM_PROMPT = `Kamu mengekstrak soal ujian dari teks naskah sekolah Indonesia menjadi JSON.

Aturan:
- Ambil SEMUA soal, termasuk soal pertama yang kadang tidak bernomor.
- "pilihan_ganda" bila soal punya opsi jawaban; "essay" bila tidak.
- options berisi teks opsi saja, terurut a, b, c, d. Buang penanda huruf ("a.", "A)", dsb).
- Naskah sering memakai tata letak dua kolom, sehingga opsi a dan c bisa berada
  pada satu baris. Pisahkan dengan benar.
- Untuk essay, options adalah array kosong.
- text berisi pertanyaan saja, tanpa nomor soal di depannya.
- Abaikan kop surat, identitas sekolah, dan baris isian (Nama Siswa, Kelas, dsb).
- Penomoran yang mengulang dari 1 di bagian baru adalah hal wajar; pertahankan
  nomor asli sesuai yang tertulis pada naskah.
- Jangan menebak jawaban yang benar. Jangan mengarang soal yang tidak ada.
- Salin teks apa adanya; jangan memperbaiki ejaan atau tanda baca.`

Deno.serve(async (request) => {
  if (!originAllowed(request)) return json(request, { error: 'Origin tidak diizinkan.' }, 403)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Metode tidak didukung.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const cerebrasKey = Deno.env.get('CEREBRAS_API_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json(request, { error: 'Konfigurasi layanan belum lengkap.' }, 500)
    }
    if (!cerebrasKey) {
      return json(request, { error: 'Layanan impor AI belum dikonfigurasi.' }, 503)
    }

    // Hanya staf yang boleh memakai kuota AI.
    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(request, { error: 'Sesi tidak valid.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return json(request, { error: 'Sesi tidak valid.' }, 401)

    const { data: caller } = await admin
      .from('profiles')
      .select('role,active')
      .eq('id', callerData.user.id)
      .single()
    if (!caller?.active || (caller.role !== 'admin' && caller.role !== 'guru')) {
      return json(request, { error: 'Hanya admin dan guru yang dapat mengimpor soal.' }, 403)
    }

    const body = await request.json() as { text?: unknown }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return json(request, { error: 'Teks soal kosong.' }, 400)
    if (text.length > MAX_SOURCE_CHARS) {
      // Memotong diam-diam akan menghilangkan soal tanpa disadari guru.
      return json(request, {
        error: `Naskah terlalu panjang (${text.length} karakter, maksimal ${MAX_SOURCE_CHARS}). Impor per bagian, misalnya pilihan ganda dulu lalu essay.`,
      }, 413)
    }

    const completion = await fetch(CEREBRAS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cerebrasKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'soal_ujian', strict: true, schema: QUESTION_SCHEMA },
        },
      }),
    })

    if (!completion.ok) {
      const detail = await completion.text().catch(() => '')
      console.error('cerebras error', completion.status, detail.slice(0, 500))
      if (completion.status === 429) {
        return json(request, { error: 'Kuota AI harian habis. Coba lagi besok atau gunakan impor manual.' }, 429)
      }
      return json(request, { error: 'Layanan AI sedang bermasalah. Silakan coba lagi.' }, 502)
    }

    const payload = await completion.json()
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return json(request, { error: 'Respons AI tidak dapat dibaca.' }, 502)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return json(request, { error: 'Respons AI bukan JSON yang valid.' }, 502)
    }

    const questions = (parsed as { questions?: unknown }).questions
    if (!Array.isArray(questions)) {
      return json(request, { error: 'Respons AI tidak memuat daftar soal.' }, 502)
    }

    return json(request, { questions, usage: payload?.usage ?? null })
  } catch (error) {
    console.error('import-questions', error)
    return json(request, { error: 'Impor AI sedang bermasalah. Silakan coba lagi.' }, 500)
  }
})
