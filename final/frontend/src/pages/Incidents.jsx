import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

function SevDots({ severity }) {
  return (
    <div className="sev-dots">
      {[1,2,3].map(i => (
        <div key={i} className={`sev-dot ${i <= severity ? `s${severity}` : ''}`}></div>
      ))}
    </div>
  )
}

function TypeBadge({ type }) {
  const map = {
    ACCIDENT:    'badge-red',
    ROAD_CLOSED: 'badge-red',
    CONGESTION:  'badge-amber',
    CLEAR:       'badge-green',
  }
  return <span className={`badge ${map[type] || 'badge-muted'}`}>{type}</span>
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${status === 'ACTIVE' ? 'badge-red' : 'badge-muted'}`}>
      {status === 'ACTIVE' && <span className="dot dot-red" style={{ width: 6, height: 6 }}></span>}
      {status}
    </span>
  )
}

export default function Incidents() {
  const [data, setData] = useState({ active: [], resolved: [], total: 0, avg_response: 8.4 })

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/incidents`)
        setData(await r.json())
      } catch {}
    }
    poll()
    const t = setInterval(poll, 2000)
    return () => clearInterval(t)
  }, [])

  const all = [...data.active, ...data.resolved]

  return (
    <div className="page">
      <div className="page-title">INCIDENT LOG</div>
      <div className="page-sub">{data.total} incidents · {data.active.length} active</div>

      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-val">{data.total}</div>
          <div className="metric-lbl">TOTAL INCIDENTS</div>
        </div>
        <div className="metric-card">
          <div className="metric-val red">{data.active.length}</div>
          <div className="metric-lbl">ACTIVE</div>
        </div>
        <div className="metric-card">
          <div className="metric-val green">{data.resolved.length}</div>
          <div className="metric-lbl">RESOLVED</div>
        </div>
        <div className="metric-card">
          <div className="metric-val accent">{data.avg_response}s</div>
          <div className="metric-lbl">AVG RESPONSE</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>ALL INCIDENTS</span>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: 11 }}>
            + MANUAL REPORT
          </button>
        </div>

        {all.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center' }}>
            No incidents recorded yet. Feed is active.
          </div>
        ) : (
          <table className="inc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>LOCATION</th>
                <th>TYPE</th>
                <th>SEVERITY</th>
                <th>TIME</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {all.map(inc => (
                <tr key={inc.id}>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{inc.id}</td>
                  <td>{inc.location}</td>
                  <td><TypeBadge type={inc.type} /></td>
                  <td><SevDots severity={inc.severity} /></td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{inc.time}</td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-clear" style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}>
                        VIEW
                      </button>
                      <button className="btn btn-clear" style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}>
                        REPORT
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}