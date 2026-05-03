import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="center-screen">
      <div className="panel narrow-panel">
        <p className="eyebrow">404</p>
        <h2>That page does not exist.</h2>
        <p className="muted">
          The route may not be wired yet, or the URL is outside the POS app shell.
        </p>
        <Link className="primary-button link-button" to="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </div>
  )
}
