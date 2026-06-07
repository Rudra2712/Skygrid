import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Incidents from './pages/Incidents.jsx'
import Alerts    from './pages/Alerts.jsx'

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="nav-clock mono">{time.toLocaleTimeString('en-IN', { hour12: false })}</span>
}

function Navbar({ feedActive }) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="#0ea5e9" strokeWidth="1.5"/>
          <path d="M5 9h8M9 5v8" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        SkyGrid
        <span className="city">| Gandhinagar</span>
      </div>

      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          DASHBOARD
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          INCIDENTS
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          ALERTS
        </NavLink>
      </div>

      <div className="nav-right">
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className={`dot ${feedActive ? 'dot-green' : 'dot-red'}`}></span>
          {feedActive ? 'FEED ACTIVE' : 'FEED OFFLINE'}
        </span>
        <Clock />
        <div className="nav-avatar">GV</div>
        <span style={{ color: '#0ea5e9', fontSize: 12, cursor: 'pointer' }}>OPEN</span>
      </div>
    </nav>
  )
}

export default function App() {
  const [feedActive, setFeedActive] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/feed')
      .then(() => setFeedActive(true))
      .catch(() => setFeedActive(false))
  }, [])

  return (
    <BrowserRouter>
      <Navbar feedActive={feedActive} />
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/alerts"    element={<Alerts />} />
      </Routes>
    </BrowserRouter>
  )
}