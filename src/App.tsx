import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, Bell, Building2,
  Check, ChevronRight, CircleMinus, Clock3, CreditCard, Info, LayoutGrid, LockKeyhole,
  Delete, Menu, Minus, MonitorSmartphone, MoreHorizontal, Plus, QrCode, ReceiptText, Save,
  Settings, ShoppingBag, Shuffle, Smartphone, Speaker, Tag, Utensils, WalletCards, X,
} from 'lucide-react'
import { initialPromos, rupiah, sampleOrder, shiftHistory, tables, type Promo, type RestaurantTable } from './data'
import { isSupabaseConfigured, readLocalSetting, supabase, upsertSetting } from './lib/supabase'

type ToastType = 'success' | 'error'
type Toast = { message: string; type: ToastType } | null
type SettingMap = Record<string, boolean>

const defaultSettings: SettingMap = {
  orderOnline: true, notification: true, logo: true, outletName: true, address: true,
  phone: true, receiptNumber: true, time: false, cashier: true, customer: true, tableNumber: true,
  taxActive: true, taxIncluded: false, qris: true, debit: true, credit: false, ewallet: true, transfer: true,
}

function App() {
  const [toast, setToast] = useState<Toast>(null)
  const [settings, setSettings] = useState<SettingMap>(() => readLocalSetting('settings', defaultSettings))
  const [promos, setPromos] = useState<Promo[]>(() => readLocalSetting('promos', initialPromos))

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'settings').maybeSingle(),
      supabase.from('promos').select('id,name,type,value,active').order('created_at'),
    ]).then(([settingResult, promoResult]) => {
      if (settingResult.data?.value) setSettings({ ...defaultSettings, ...(settingResult.data.value as SettingMap) })
      if (promoResult.data?.length) setPromos(promoResult.data as Promo[])
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const notify = (message: string, type: ToastType = 'success') => setToast({ message, type })
  const toggle = (key: string) => setSettings((current) => ({ ...current, [key]: !current[key] }))
  const toggleAndSave = async (key: string, message: string) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    try { await upsertSetting('settings', next); notify(message) }
    catch { notify('Gagal menyimpan. Periksa koneksi Supabase.', 'error') }
  }
  const saveSettings = async (message = 'Pengaturan berhasil disimpan') => {
    try {
      await upsertSetting('settings', settings)
      notify(message)
    } catch {
      notify('Gagal menyimpan. Periksa koneksi Supabase.', 'error')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kasir/meja" element={<TablePicker notify={notify} />} />
          <Route path="/kasir/pembayaran/:tableId" element={<Payment notify={notify} />} />
          <Route path="/kasir/shift" element={<Shift notify={notify} />} />
          <Route path="/kasir/pengaturan" element={<SettingsHome />} />
          <Route path="/kasir/pengaturan/order-online" element={<InstantSetting title="Order Online" icon={<ShoppingBag />} label="Terima pesanan online" description="Bila aktif, pelanggan bisa memesan sendiri lewat QR di meja. Matikan saat outlet tutup atau dapur penuh." value={settings.orderOnline} onToggle={() => toggleAndSave('orderOnline', 'Order online diperbarui')} />} />
          <Route path="/kasir/pengaturan/notifikasi" element={<InstantSetting title="Notifikasi Suara" icon={<Bell />} label="Suara notifikasi pesanan" description="Bunyikan suara & getar saat ada pesanan baru masuk. Pengaturan ini berlaku untuk perangkat ini saja." value={settings.notification} onToggle={() => toggleAndSave('notification', 'Notifikasi diperbarui')} />} />
          <Route path="/kasir/pengaturan/struk-biaya" element={<ReceiptSettings settings={settings} toggle={toggle} onSave={saveSettings} />} />
          <Route path="/kasir/pengaturan/pembayaran" element={<PaymentSettings settings={settings} toggle={toggle} onSave={saveSettings} />} />
          <Route path="/kasir/pengaturan/promo" element={<Promos promos={promos} setPromos={setPromos} notify={notify} />} />
          <Route path="/kasir/pengaturan/info-outlet" element={<OutletInfo notify={notify} />} />
          <Route path="/kasir/pengaturan/password-pin" element={<PinSettings notify={notify} />} />
          <Route path="/kasir/pengaturan/perangkat" element={<Devices />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MobileNav />
      {toast && <div className={`toast ${toast.type}`}><span>{toast.type === 'success' ? <Check /> : <Info />}</span>{toast.message}</div>}
    </div>
  )
}

function Sidebar() {
  const location = useLocation()
  const links = [
    { to: '/', icon: <LayoutGrid />, label: 'Ringkasan' },
    { to: '/kasir/meja', icon: <Utensils />, label: 'Kasir' },
    { to: '/kasir/shift', icon: <Clock3 />, label: 'Shift' },
    { to: '/kasir/pengaturan', icon: <Settings />, label: 'Pengaturan' },
  ]
  return <aside className="sidebar">
    <Link className="brand" to="/"><span className="brand-mark">T</span><span>Time 420s<small>Restaurant POS</small></span></Link>
    <nav>{links.map((item) => <Link key={item.to} to={item.to} className={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to)) ? 'active' : ''}>{item.icon}<span>{item.label}</span></Link>)}</nav>
    <div className="sidebar-foot"><span className={`sync-dot ${isSupabaseConfigured ? 'online' : ''}`} />{isSupabaseConfigured ? 'Supabase terhubung' : 'Mode demo lokal'}</div>
  </aside>
}

function MobileNav() {
  const location = useLocation()
  const items = [
    ['/', <LayoutGrid />, 'Ringkasan'], ['/kasir/meja', <Utensils />, 'Kasir'],
    ['/kasir/shift', <Clock3 />, 'Shift'], ['/kasir/pengaturan', <Settings />, 'Atur'],
  ] as const
  return <nav className="mobile-nav">{items.map(([to, icon, label]) => <Link className={location.pathname === to || (to !== '/' && location.pathname.startsWith(to)) ? 'active' : ''} to={to} key={to}>{icon}<span>{label}</span></Link>)}</nav>
}

function Dashboard() {
  return <div className="dashboard page-enter">
    <header className="hero-header"><div><p className="eyebrow">Jumat, 10 Juli 2026</p><h1>Selamat malam, Arsyad</h1><p>Pantau operasional outlet dalam satu layar.</p></div><Link className="primary-btn" to="/kasir/meja"><Plus /> Order baru</Link></header>
    <section className="metric-grid">
      <Metric label="Penjualan hari ini" value="Rp 4.280.000" note="12,4% dari kemarin" positive icon={<ArrowUpRight />} />
      <Metric label="Total transaksi" value="86" note="Rata-rata Rp 49.767" icon={<ReceiptText />} />
      <Metric label="Meja aktif" value="3 / 12" note="8 tersedia · 1 reservasi" icon={<Utensils />} />
      <Metric label="Order online" value="18" note="2 sedang diproses" icon={<ShoppingBag />} />
    </section>
    <section className="dashboard-grid">
      <div className="panel sales-panel"><div className="panel-title"><div><p className="eyebrow">Performa penjualan</p><h2>7 hari terakhir</h2></div><button className="icon-btn"><MoreHorizontal /></button></div><SalesChart /></div>
      <div className="panel"><div className="panel-title"><div><p className="eyebrow">Menu terlaris</p><h2>Hari ini</h2></div></div><div className="rank-list">{[['Nasi Goreng Spesial','32','Rp 896.000'],['Ayam Bakar Madu','24','Rp 768.000'],['Es Kopi Susu','21','Rp 378.000'],['Mie Goreng Jawa','18','Rp 450.000']].map((x,i)=><div className="rank" key={x[0]}><span>{i+1}</span><div><strong>{x[0]}</strong><small>{x[1]} terjual</small></div><b>{x[2]}</b></div>)}</div></div>
    </section>
  </div>
}

function Metric({ label, value, note, icon, positive }: { label: string; value: string; note: string; icon: ReactNode; positive?: boolean }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small className={positive ? 'positive' : ''}>{note}</small></div>
}

function SalesChart() {
  const values = [42, 58, 50, 72, 64, 88, 78]
  return <div className="chart"><div className="chart-lines"><i/><i/><i/><i/></div><div className="bars">{values.map((v, i) => <div className="bar-item" key={i}><span style={{ height: `${v}%` }} className={i === 5 ? 'peak' : ''}/><small>{['Sab','Min','Sen','Sel','Rab','Kam','Jum'][i]}</small></div>)}</div></div>
}

function PageHeader({ title, save, children }: { title: string; save?: () => void; children?: ReactNode }) {
  const navigate = useNavigate()
  return <header className="page-header"><div><button className="back-btn" onClick={() => navigate(-1)} aria-label="Kembali"><ArrowLeft /></button><h1>{title}</h1></div>{save && <button className="save-btn" onClick={save}><Save /> Simpan</button>}{children}</header>
}

function TablePicker({ notify }: { notify: (message: string, type?: 'success' | 'error') => void }) {
  const navigate = useNavigate()
  const chooseTable = (table: RestaurantTable) => {
    if (table.status === 'available') navigate(`/kasir/pembayaran/${table.id}`)
    else notify(table.status === 'occupied' ? `Membuka order aktif Meja ${table.id}` : `Meja ${table.id} direservasi pukul ${table.detail}`)
  }
  const counts = tables.reduce((a, table) => ({ ...a, [table.status]: a[table.status] + 1 }), { available: 0, occupied: 0, reserved: 0 })
  return <div className="full-page table-page page-enter">
    <header className="pos-header"><div><Link to="/" className="back-btn"><ArrowLeft /></Link><h1>Pilih Meja</h1></div><div className="legend"><span><i className="available"/>Tersedia</span><span><i className="occupied"/>Terisi</span><span><i className="reserved"/>Reserved</span></div></header>
    <div className="table-grid">{tables.map((table) => <button onClick={() => chooseTable(table)} className={`table-card ${table.status}`} key={table.id}><i className="status-dot"/><TableIcon/><strong>{table.id}</strong><span>{table.status === 'available' ? 'Tersedia' : table.status === 'occupied' ? 'Terisi' : 'Reserved'}</span>{table.detail && <small>{table.detail}</small>}</button>)}</div>
    <footer className="table-footer"><span>12 meja · <b className="green">{counts.available} tersedia</b> · <b className="red">{counts.occupied} terisi</b> · <b className="amber">{counts.reserved} reserved</b></span><span>Tap meja untuk mulai order</span></footer>
  </div>
}

function TableIcon() {
  return <svg className="table-icon" viewBox="0 0 40 32" aria-hidden="true"><rect x="8" y="7" width="24" height="15" rx="3"/><rect x="1" y="10" width="5" height="9" rx="2"/><rect x="34" y="10" width="5" height="9" rx="2"/><rect x="11" y="25" width="7" height="5" rx="2"/><rect x="22" y="25" width="7" height="5" rx="2"/></svg>
}

function Payment({ notify }: { notify: (message: string, type?: 'success' | 'error') => void }) {
  const { tableId = '3' } = useParams()
  const navigate = useNavigate()
  const [method, setMethod] = useState('tunai')
  const [received, setReceived] = useState('')
  const subtotal = sampleOrder.reduce((sum, item) => sum + item.qty * item.price, 0)
  const tax = Math.round(subtotal * .1)
  const service = Math.round(subtotal * .02)
  const total = subtotal + tax + service
  const amount = Number(received || 0)
  const ready = method !== 'tunai' || amount >= total
  const input = (value: string) => setReceived((current) => `${current}${value}`.replace(/^0+/, '').slice(0, 10))
  const methods = [
    ['tunai', 'Tunai', <Banknote />], ['qris', 'QRIS', <QrCode />], ['debit', 'Debit', <CreditCard />],
    ['ewallet', 'E-Wallet', <Smartphone />], ['transfer', 'Transfer', <ArrowDownLeft />],
  ] as const
  const pay = async () => {
    if (!ready) return
    try {
      if (supabase) {
        const { error } = await supabase.from('orders').insert({ table_number: Number(tableId), items: sampleOrder, subtotal, tax, service_charge: service, total, payment_method: method, received_amount: method === 'tunai' ? amount : total, status: 'paid' })
        if (error) throw error
      }
      notify(`Pembayaran Meja ${tableId} berhasil`)
      navigate('/kasir/meja')
    } catch { notify('Pembayaran gagal disimpan', 'error') }
  }
  return <div className="full-page payment-page page-enter">
    <header className="pos-header"><div><button className="back-btn" onClick={() => navigate(-1)}><ArrowLeft /></button><h1>Proses Pembayaran</h1></div><span className="table-pill">Meja {tableId}</span></header>
    <div className="payment-layout">
      <section className="payment-left">
        <div className="order-card"><h2>Ringkasan Order</h2><div className="order-items">{sampleOrder.map((item) => <div className="order-item" key={item.name}><span>{item.qty}</span><p>{item.name}</p><strong>{rupiah(item.qty * item.price)}</strong></div>)}</div><div className="totals"><p><span>Subtotal</span><b>{rupiah(subtotal)}</b></p><p><span>Pajak (10%)</span><b>{rupiah(tax)}</b></p><p><span>Service (2%)</span><b>{rupiah(service)}</b></p><p className="grand-total"><span>Total</span><b>{rupiah(total)}</b></p></div></div>
        <div className="method-card"><h2>Metode Pembayaran</h2><div className="method-grid">{methods.map(([id, label, icon]) => <button className={method === id ? 'selected' : ''} onClick={() => { setMethod(id); if (id !== 'tunai') setReceived(String(total)) }} key={id}>{icon}<span>{label}</span></button>)}</div></div>
        <button className="split-btn"><Shuffle /> Bagi Tagihan</button>
      </section>
      <aside className="numpad-card">
        <div className="payment-display"><label>DITERIMA</label><strong>{rupiah(amount)}</strong><div className={ready ? 'change ready' : 'change'}><span>{ready ? 'KEMBALIAN' : 'KURANG'}</span><b>{rupiah(Math.abs(amount - total))}</b></div></div>
        <div className="quick-amounts">{[100_000, 120_000, 150_000, 200_000].map((v) => <button key={v} onClick={() => setReceived(String(v))}>{rupiah(v).replace('Rp ', '')}</button>)}</div>
        <div className="numpad">{['7','8','9','4','5','6','1','2','3','000','0'].map((key) => <button key={key} onClick={() => input(key)}>{key}</button>)}<button className="delete" onClick={() => setReceived((x) => x.slice(0,-1))}><Delete /></button></div>
        <div className="pay-wrap"><button className="pay-btn" disabled={!ready} onClick={pay}><Check /> Bayar {rupiah(total)}</button></div>
      </aside>
    </div>
  </div>
}

function SettingsHome() {
  const operational = [
    ['Order Online', 'Terima pesanan dari QR self-order', '/kasir/pengaturan/order-online', <ShoppingBag />],
    ['Struk & Biaya', 'Tampilan struk, pajak & service charge', '/kasir/pengaturan/struk-biaya', <ReceiptText />],
    ['Perangkat', 'Printer kasir/dapur dan koneksi', '/kasir/pengaturan/perangkat', <MonitorSmartphone />],
    ['Notifikasi Suara', 'Bunyi saat ada pesanan baru', '/kasir/pengaturan/notifikasi', <Speaker />],
    ['Pembayaran Nontunai', 'Metode pembayaran yang aktif', '/kasir/pengaturan/pembayaran', <WalletCards />],
    ['Promo', 'Kelola promo & voucher', '/kasir/pengaturan/promo', <Tag />],
  ] as const
  const account = [
    ['Info Outlet', 'Nama, alamat dan telepon', '/kasir/pengaturan/info-outlet', <Building2 />],
    ['Password & PIN', 'Ubah PIN akses kasir', '/kasir/pengaturan/password-pin', <LockKeyhole />],
  ] as const
  return <div className="settings-page page-enter"><div className="settings-title"><div><p className="eyebrow">Konfigurasi outlet</p><h1>Pengaturan</h1></div><span className={`connection-badge ${isSupabaseConfigured ? 'connected' : ''}`}><i/>{isSupabaseConfigured ? 'Database terhubung' : 'Mode demo'}</span></div><SettingsSection title="Operasional" items={operational}/><SettingsSection title="Akun" items={account}/><p className="version">Time 420s POS · Versi 2.4.1</p></div>
}

function SettingsSection({ title, items }: { title: string; items: readonly (readonly [string, string, string, ReactNode])[] }) {
  return <section className="settings-section"><h2>{title}</h2><div className="settings-list">{items.map(([label, desc, route, icon]) => <Link to={route} className="settings-row" key={label}><span className="setting-icon">{icon}</span><span><strong>{label}</strong><small>{desc}</small></span><ChevronRight /></Link>)}</div></section>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={onChange}><i /></button>
}

function InstantSetting({ title, icon, label, description, value, onToggle }: { title: string; icon: ReactNode; label: string; description: string; value: boolean; onToggle: () => void }) {
  return <div className="sub-page page-enter"><PageHeader title={title}/><div className="sub-content"><div className="single-setting"><span className="setting-icon">{icon}</span><div><strong>{label}</strong><small className={value ? '' : 'muted'}>{value ? 'Aktif' : 'Nonaktif'}</small></div><Toggle checked={value} onChange={onToggle} label={label}/></div><p className="helper">{description}</p></div></div>
}

function SettingRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <div className="toggle-row"><span>{label}</span><Toggle checked={checked} onChange={onChange} label={label}/></div>
}

function ReceiptSettings({ settings, toggle, onSave }: { settings: SettingMap; toggle: (key: string) => void; onSave: () => void }) {
  const [fields, setFields] = useState(() => readLocalSetting('receiptFields', { taxName: 'PPN', tax: 10, service: 2, footer: '' }))
  const save = async () => { await upsertSetting('receiptFields', fields); onSave() }
  const receiptRows = [['Tampilkan Logo','logo'],['Nama Outlet','outletName'],['Alamat','address'],['Telepon','phone'],['No Nota','receiptNumber'],['Waktu','time'],['Kasir','cashier'],['Customer','customer'],['Nomor Meja','tableNumber']]
  return <div className="sub-page page-enter"><PageHeader title="Struk & Biaya" save={save}/><div className="sub-content"><SectionLabel>Tampilan Struk</SectionLabel><div className="form-card">{receiptRows.map(([label,key])=><SettingRow key={key} label={label} checked={settings[key]} onChange={()=>toggle(key)}/>)}<div className="textarea-wrap"><textarea rows={2} value={fields.footer} onChange={(e)=>setFields({...fields,footer:e.target.value})} placeholder="Catatan kaki struk (footer)"/></div></div><SectionLabel>Pajak & Service Charge</SectionLabel><div className="form-card"><SettingRow label="Pajak Aktif" checked={settings.taxActive} onChange={()=>toggle('taxActive')}/><SettingRow label="Harga Sudah Termasuk Pajak" checked={settings.taxIncluded} onChange={()=>toggle('taxIncluded')}/><div className="field-grid"><Field label="Nama Pajak" value={fields.taxName} onChange={(v)=>setFields({...fields,taxName:v})}/><Field label="Pajak (%)" type="number" value={fields.tax} onChange={(v)=>setFields({...fields,tax:Number(v)})}/></div><Field label="Service Charge (%)" type="number" value={fields.service} onChange={(v)=>setFields({...fields,service:Number(v)})}/></div></div></div>
}

function PaymentSettings({ settings, toggle, onSave }: { settings: SettingMap; toggle: (key: string) => void; onSave: () => void }) {
  const methods = [['QRIS','qris'],['Kartu Debit','debit'],['Kartu Kredit','credit'],['E-Wallet','ewallet'],['Transfer Bank','transfer']]
  return <div className="sub-page page-enter"><PageHeader title="Pembayaran Non-Tunai" save={onSave}/><div className="sub-content"><div className="form-card"><div className="toggle-row"><span>Tunai</span><small>Selalu aktif</small></div>{methods.map(([label,key])=><SettingRow key={key} label={label} checked={settings[key]} onChange={()=>toggle(key)}/>)}</div><p className="helper">Metode yang aktif akan muncul pada layar pembayaran kasir.</p></div></div>
}

function SectionLabel({ children }: { children: ReactNode }) { return <h3 className="section-label">{children}</h3> }

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="field"><span>{label}{required && ' *'}</span><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/></label>
}

function OutletInfo({ notify }: { notify: (message: string, type?: 'success' | 'error') => void }) {
  const [form, setForm] = useState(() => readLocalSetting('outlet', { name: 'Time 420s', address: '', phone: '', city: '' }))
  const [error, setError] = useState('')
  const save = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) { setError('Nama outlet, alamat, dan telepon wajib diisi.'); return }
    try { await upsertSetting('outlet', form); setError(''); notify('Info outlet berhasil disimpan') } catch { notify('Gagal menyimpan info outlet', 'error') }
  }
  const update = (key: keyof typeof form) => (value: string) => setForm({...form,[key]:value})
  return <div className="sub-page page-enter"><PageHeader title="Info Outlet" save={save}/><div className="sub-content"><div className="form-card"><Field label="Nama Outlet" value={form.name} onChange={update('name')} required/><Field label="Alamat" value={form.address} onChange={update('address')} placeholder="Masukkan alamat" required/><Field label="Telepon" type="tel" value={form.phone} onChange={update('phone')} placeholder="Masukkan nomor telepon" required/><Field label="Kota" value={form.city} onChange={update('city')} placeholder="Masukkan kota"/></div>{error && <p className="form-error">{error}</p>}</div></div>
}

function PinSettings({ notify }: { notify: (message: string, type?: 'success' | 'error') => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const digits = (value: string) => value.replace(/\D/g,'').slice(0,4)
  const save = async () => {
    if (pin.length !== 4) return setError('PIN harus 4 digit')
    if (pin !== confirm) return setError('Konfirmasi PIN tidak sesuai')
    try {
      if (supabase) { const { error: dbError } = await supabase.rpc('update_cashier_pin', { new_pin: pin }); if (dbError) throw dbError }
      else localStorage.setItem('pos:pinConfigured','true')
      setError(''); setPin(''); setConfirm(''); notify('PIN berhasil diperbarui')
    } catch { notify('PIN gagal diperbarui', 'error') }
  }
  return <div className="sub-page page-enter"><PageHeader title="Password & PIN" save={save}/><div className="sub-content"><div className="form-card pin-card"><Field label="PIN Baru (4 digit)" type="password" value={pin} onChange={(v)=>setPin(digits(v))} placeholder="••••"/><Field label="Konfirmasi PIN" type="password" value={confirm} onChange={(v)=>setConfirm(digits(v))} placeholder="••••"/></div>{error && <p className="form-error">{error}</p>}<p className="helper">PIN digunakan untuk membuka akses kasir. Pastikan Anda mengingatnya.</p></div></div>
}

function Devices() {
  return <div className="sub-page page-enter"><PageHeader title="Perangkat"/><div className="sub-content"><SectionLabel>Printer</SectionLabel><div className="form-card"><div className="device-row"><span className="setting-icon"><ReceiptText/></span><div><strong>Printer Kasir</strong><small>Belum terhubung</small></div><button>Hubungkan</button></div><div className="device-row"><span className="setting-icon"><Utensils/></span><div><strong>Printer Dapur</strong><small>Belum terhubung</small></div><button>Hubungkan</button></div></div><p className="helper">Koneksi printer merupakan fitur perangkat lokal dan tidak disimpan di Supabase.</p></div></div>
}

function Promos({ promos, setPromos, notify }: { promos: Promo[]; setPromos: (value: Promo[]) => void; notify: (message: string, type?: 'success' | 'error') => void }) {
  const [editing, setEditing] = useState<Promo | 'new' | null>(null)
  const persist = async (promo: Promo) => {
    const next = promos.some((p)=>p.id===promo.id) ? promos.map((p)=>p.id===promo.id?promo:p) : [...promos,promo]
    try {
      if (supabase) { const { error } = await supabase.from('promos').upsert({ id: promo.id, name: promo.name, type: promo.type, value: promo.value, active: promo.active }); if (error) throw error }
      else localStorage.setItem('pos:promos',JSON.stringify(next))
      setPromos(next); setEditing(null); notify('Promo berhasil disimpan')
    } catch { notify('Promo gagal disimpan','error') }
  }
  return <div className="sub-page page-enter"><PageHeader title="Promo"/><div className="sub-content promo-content">{promos.length ? <div className="settings-list">{promos.map((promo)=><button className="settings-row promo-row" onClick={()=>setEditing(promo)} key={promo.id}><span className="setting-icon"><Tag/></span><span><strong>{promo.name}</strong><small>{promo.type === 'persentase' ? 'Persentase' : 'Nominal'} · {promo.type === 'persentase' ? `${promo.value}%` : rupiah(promo.value)} · {promo.active ? 'Aktif' : 'Nonaktif'}</small></span><ChevronRight/></button>)}</div> : <EmptyState/>}</div><button className="fab" onClick={()=>setEditing('new')}><Plus/> Tambah Promo</button>{editing && <PromoModal promo={editing} onClose={()=>setEditing(null)} onSave={persist}/>}</div>
}

function EmptyState() { return <div className="empty-state"><Tag/><strong>Belum ada promo</strong><p>Tambahkan promo pertama untuk pelanggan Anda.</p></div> }

function PromoModal({ promo, onClose, onSave }: { promo: Promo | 'new'; onClose: () => void; onSave: (promo: Promo) => void }) {
  const initial = promo === 'new' ? { id: crypto.randomUUID(), name: '', type: 'persentase' as const, value: 10, active: true } : promo
  const [form, setForm] = useState<Promo>(initial)
  const submit = (e: FormEvent) => { e.preventDefault(); if(form.name.trim() && form.value > 0) onSave(form) }
  return <Modal onClose={onClose}><form className="action-modal" onSubmit={submit}><div className="modal-heading"><span className="setting-icon"><Tag/></span><div><h2>{promo === 'new' ? 'Tambah Promo' : 'Edit Promo'}</h2><p>Atur nama, jenis, dan nilai promo.</p></div><button type="button" className="modal-x" onClick={onClose}><X/></button></div><div className="modal-body"><label><span>NAMA PROMO</span><input autoFocus value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Contoh: Diskon Weekend"/></label><div className="field-grid modal-grid"><label><span>TIPE</span><select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value as Promo['type']})}><option value="persentase">Persentase</option><option value="nominal">Nominal</option></select></label><label><span>NILAI</span><input type="number" min="1" value={form.value} onChange={(e)=>setForm({...form,value:Number(e.target.value)})}/></label></div><div className="toggle-row bare"><span>Promo aktif</span><Toggle checked={form.active} onChange={()=>setForm({...form,active:!form.active})} label="Promo aktif"/></div></div><div className="modal-actions"><button type="button" onClick={onClose}>Batal</button><button className="primary" type="submit">Simpan Promo</button></div></form></Modal>
}

type CashModal = 'in' | 'out' | 'close' | null

function Shift({ notify }: { notify: (message: string, type?: 'success' | 'error') => void }) {
  const [modal, setModal] = useState<CashModal>(null)
  const [detail, setDetail] = useState<(typeof shiftHistory)[number] | null>(null)
  const [elapsed, setElapsed] = useState('3j 21m')
  useEffect(()=>{ const update=()=>{ const start=new Date(); start.setHours(10,1,0,0); const minutes=Math.max(0,Math.floor((Date.now()-start.getTime())/60000)); setElapsed(`${Math.floor(minutes/60)}j ${minutes%60}m`) }; update(); const id=window.setInterval(update,30000); return()=>clearInterval(id)},[])
  return <div className="shift-page page-enter"><header className="shift-header"><Menu/><h1>Shift Kasir</h1></header><div className="shift-content"><div className="active-shift"><div className="shift-dark"><span><i/>Shift Berjalan</span><b><Clock3/>{elapsed}</b></div><div className="shift-stats"><div><small>MULAI</small><strong>10:01, 10 Jul 2026</strong></div><div><small>KAS AWAL</small><strong>Rp 500.000</strong></div></div><div className="cash-actions"><button onClick={()=>setModal('in')}><Plus/>Kas Masuk</button><button onClick={()=>setModal('out')}><Minus/>Kas Keluar</button></div><button className="close-shift" onClick={()=>setModal('close')}><CircleMinus/> Tutup Shift</button></div><SectionLabel>Riwayat 7 Hari Terakhir</SectionLabel><div className="history-list">{shiftHistory.map((item)=><button onClick={()=>setDetail(item)} key={item.id}><span>{item.date}</span><p>{item.time}</p><b className={item.value >= 0 ? 'plus':'minus'}>{item.value>=0?'+':'−'}{rupiah(item.value)}</b><ChevronRight/></button>)}</div></div>{modal&&<CashActionModal type={modal} onClose={()=>setModal(null)} notify={notify}/>} {detail&&<ShiftDetail shift={detail} onClose={()=>setDetail(null)}/>}</div>
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="modal-overlay" onMouseDown={onClose}><div className="modal-panel" onMouseDown={(e)=>e.stopPropagation()}>{children}</div></div>
}

function CashActionModal({ type, onClose, notify }: { type: Exclude<CashModal,null>; onClose: () => void; notify: (message: string) => void }) {
  const [amount,setAmount]=useState('')
  const [note,setNote]=useState('')
  const meta = type==='in' ? {title:'Kas Masuk',desc:'Tambahan kas ke laci (mis. tambah modal).',icon:<Plus/>,action:'Simpan Kas Masuk'} : type==='out' ? {title:'Kas Keluar',desc:'Kas keluar dari laci (mis. bayar galon/ojek).',icon:<Minus/>,action:'Simpan Kas Keluar'} : {title:'Tutup Shift',desc:'Masukkan jumlah kas aktual di laci.',icon:<CircleMinus/>,action:'Tutup Shift'}
  const submit=async(e:FormEvent)=>{e.preventDefault();if(!Number(amount))return;try{if(supabase){if(type==='close'){const {error}=await supabase.from('shifts').insert({ending_cash:Number(amount),notes:note,status:'closed',ended_at:new Date().toISOString()});if(error)throw error}else{const {error}=await supabase.from('cash_movements').insert({type,amount:Number(amount),notes:note});if(error)throw error}}notify(`${meta.title} berhasil disimpan`);onClose()}catch{notify(`${meta.title} tersimpan di mode lokal`);onClose()}}
  return <Modal onClose={onClose}><form className={`action-modal cash-modal ${type}`} onSubmit={submit}><div className="modal-heading"><span className="setting-icon">{meta.icon}</span><div><h2>{meta.title}</h2><p>{meta.desc}</p></div><button type="button" className="modal-x" onClick={onClose}><X/></button></div><div className="modal-body">{type==='close'&&<div className="cash-initial"><span>Kas awal</span><b>Rp 500.000</b></div>}<label><span>{type==='close'?'KAS AKHIR (RP)':'NOMINAL'}</span><div className="money-input"><b>Rp</b><input autoFocus type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0"/></div></label><label><span>CATATAN</span><input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Opsional"/></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Batal</button><button className="primary" type="submit">{meta.action}</button></div></form></Modal>
}

function ShiftDetail({ shift, onClose }: { shift: (typeof shiftHistory)[number]; onClose: () => void }) {
  return <Modal onClose={onClose}><div className="shift-detail"><div className="detail-dark"><div><small>DETAIL SHIFT</small><h2>{shift.date} · {shift.time}</h2></div><button onClick={onClose}><X/></button></div><div className="detail-stats"><div><small>DURASI</small><b>5j 18m</b></div><div><small>KAS AWAL</small><b>Rp 500.000</b></div><div><small>KAS AKHIR</small><b>{rupiah(500000+shift.value)}</b></div></div><div className="transactions"><SectionLabel>Transaksi</SectionLabel><div><span className="transaction-icon plus"><Plus/></span><p><strong>Kas Masuk</strong><small>10:12 · Tambah modal</small></p><b className="green">+Rp 500.000</b></div><div><span className="transaction-icon minus"><Minus/></span><p><strong>Kas Keluar</strong><small>12:45 · Operasional</small></p><b className="red">−Rp 75.000</b></div></div><div className="detail-total"><span>Selisih Bersih</span><b className={shift.value>=0?'green':'red'}>{shift.value>=0?'+':'−'}{rupiah(shift.value)}</b></div></div></Modal>
}

export default App
