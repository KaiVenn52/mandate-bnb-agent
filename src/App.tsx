import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BuilderScreen } from './screens/BuilderScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { ActivateScreen } from './screens/ActivateScreen'
import { EvidenceScreen } from './screens/EvidenceScreen'
import { FaucetScreen } from './screens/FaucetScreen'
import { CommerceScreen } from './screens/CommerceScreen'
import { OpenMandateScreen } from './screens/OpenMandateScreen'
import './App.css'

const RegistrationScreen = lazy(() =>
  import('./screens/RegistrationScreen').then((module) => ({ default: module.RegistrationScreen })),
)

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppShell>
        <Routes>
          <Route path="/" element={<BuilderScreen />} />
          <Route path="/results" element={<ResultsScreen />} />
          <Route path="/activate" element={<ActivateScreen />} />
          <Route path="/evidence" element={<EvidenceScreen />} />
          <Route path="/register" element={<Suspense fallback={<div className="route-loading">Loading registration…</div>}><RegistrationScreen /></Suspense>} />
          <Route path="/faucet" element={<FaucetScreen />} />
          <Route path="/commerce" element={<CommerceScreen />} />
          <Route path="/open-mandate" element={<OpenMandateScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
