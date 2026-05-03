import { useState } from 'react'
import axios from 'axios'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export function LoginPage() {
  const { isAuthenticated, isBusy, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      await login(form)
      navigate(from, { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Login failed.')
      } else {
        setError('Login failed.')
      }
    }
  }

  return (
    <div className="login-layout">
      <section className="login-hero">
        <div className="login-hero-copy">
          <p className="eyebrow">Gen Steel ERP</p>
          <h1>Sales, stock, and approvals in one workspace.</h1>
          <p>
            A focused counter and back-office system for daily stainless steel operations.
          </p>
        </div>
        <div className="login-proof-grid">
          <span>POS</span>
          <span>Inventory</span>
          <span>Reports</span>
        </div>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Secure Sign In</p>
          <h2>Access the system</h2>
        </div>

        <label className="field">
          <span>Username</span>
          <input
            value={form.username}
            onChange={(event) =>
              setForm((current) => ({ ...current, username: event.target.value }))
            }
            placeholder="owner or cashier"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Enter password"
            required
          />
        </label>

        {error ? <div className="error-panel">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={isBusy}>
          {isBusy ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="hint-panel">
          <strong>Seeded local accounts</strong>
          <span>owner / Owner123! and cashier / Cashier123!</span>
        </div>
      </form>
    </div>
  )
}
