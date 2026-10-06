import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { BRAND } from '../data/products'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/designer', label: 'Design Studio' },
  { to: '/bulk', label: 'Bulk Orders' },
]

export function Logo() {
  return (
    <Link to="/" className="logo">
      <svg viewBox="0 0 400 440" aria-hidden="true">
        <path d="M140 22 Q200 62 260 22 L338 48 Q370 90 396 128 L338 168 L320 146 L322 420 Q200 430 78 420 L80 146 L62 168 L4 128 Q30 90 62 48 Z" />
      </svg>
      {BRAND}
    </Link>
  )
}

export default function Navbar() {
  const { totals } = useCart()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <Link to="/cart" className="cart-button" aria-label={`Cart, ${totals.count} items`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {totals.count > 0 && <span className="badge-count">{totals.count}</span>}
          </Link>
          <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}
