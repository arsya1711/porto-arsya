import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'
import './styles-pages.css'
import './styles-extra.css'
import './styles-runner.css'
import './styles-auth.css'
import './styles-auth-recovery.css'
import './styles-users-crud.css'
import './styles-password.css'
import './styles-form-controls.css'
import './styles-question-bank.css'
import './styles-dashboards.css'
import './styles-admin.css'
import './styles-brand.css'
import './styles-mobile-nav.css'
import './styles-responsive.css'

// Pengguna yang membuka aplikasi saat deployment berganti masih dapat
// menjalankan entry bundle lama. Jika kemudian fitur lazy-loaded (PDF/OCR)
// dibuka, chunk lama mungkin sudah tidak tersedia di hosting. Vite menerbitkan
// event ini khusus untuk kondisi tersebut; muat ulang satu kali agar browser
// mengambil index dan daftar asset deployment terbaru.
const preloadReloadKey = 'awexam:preload-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  const lastReload = Number(sessionStorage.getItem(preloadReloadKey) ?? 0)
  if (Date.now() - lastReload < 15_000) return

  event.preventDefault()
  sessionStorage.setItem(preloadReloadKey, String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
