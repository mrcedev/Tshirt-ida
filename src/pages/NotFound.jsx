import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container not-found">
      <div className="big">404</div>
      <h1>This page went missing in the wash</h1>
      <p className="muted">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="hero-actions" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Back home
        </Link>
        <Link to="/shop" className="btn btn-outline">
          Browse the shop
        </Link>
      </div>
    </div>
  )
}
