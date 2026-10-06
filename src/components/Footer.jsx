import { Link } from 'react-router-dom'
import { Logo } from './Navbar'
import { BRAND } from '../data/products'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="muted">Custom t-shirt printing for brands, teams, events and everyone with an idea worth wearing.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <Link to="/shop">All products</Link>
          <Link to="/designer">Design Studio</Link>
          <Link to="/bulk">Bulk orders</Link>
        </div>
        <div>
          <h4>Help</h4>
          <Link to="/#faq">FAQ</Link>
          <Link to="/#contact">Contact</Link>
          <span className="muted">Shipping: 3–5 business days</span>
        </div>
        <div>
          <h4>Studio</h4>
          <span className="muted">Mon–Fri, 8:00–18:00</span>
          <span className="muted">hello@inkwave.example</span>
        </div>
      </div>
      <div className="container footer-bottom muted">© {new Date().getFullYear()} {BRAND}. All rights reserved.</div>
    </footer>
  )
}
