import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './styles-pages.css'
import './styles-extra.css'
import './styles-runner.css'
import './styles-auth.css'
import './styles-auth-recovery.css'
import './styles-users-crud.css'
import './styles-password.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
