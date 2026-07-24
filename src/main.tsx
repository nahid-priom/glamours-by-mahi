import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RootErrorBoundary } from '@/components/errors/RootErrorBoundary'
import { App } from './app/App'
import './index.css'

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
