import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ShirtMockup from '../components/ShirtMockup'
import ProductCard from '../components/ProductCard'
import { useCart } from '../context/CartContext'
import { CATEGORIES, COLORS, PRODUCTS, getProduct } from '../data/products'
import { BULK_TIERS, PRINT_SIDE_PRICE, money, tierFor } from '../lib/pricing'
import NotFound from './NotFound'

export default function ProductPage() {
  const { id } = useParams()
  const product = getProduct(id)
  // Keyed by id so options reset when navigating between products.
  return product ? <ProductDetails key={id} product={product} /> : <NotFound />
}

function ProductDetails({ product }) {
  const [params] = useSearchParams()
  const { add } = useCart()
  const initialColor = product.colors.includes(params.get('color')) ? params.get('color') : product.colors[0]
  const [color, setColor] = useState(initialColor)
  const [size, setSize] = useState(null)
  const [qty, setQty] = useState(1)
  const [sizeError, setSizeError] = useState(false)

  const category = CATEGORIES.find((c) => c.id === product.type)
  const tier = tierFor(qty)
  const related = PRODUCTS.filter((p) => p.id !== product.id)
    .sort((a, b) => (b.type === product.type) - (a.type === product.type))
    .slice(0, 4)

  const addToCart = () => {
    if (!size) {
      setSizeError(true)
      return
    }
    add({ productId: product.id, name: product.name, color, size, qty, unitPrice: product.price })
  }

  return (
    <div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <Link to={`/shop?cat=${product.type}`}>{category?.label}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="product-layout">
        <div className="product-gallery">
          <ShirtMockup type={product.type} color={COLORS[color].hex} label={`${product.name} in ${COLORS[color].name}`} />
        </div>

        <div className="product-info">
          {product.badge && <span className="eyebrow">{product.badge}</span>}
          <h1>{product.name}</h1>
          <div className="product-meta" style={{ justifyContent: 'flex-start', gap: 16 }}>
            <span className="price">{money(product.price)}</span>
            <span className="rating">
              ★ {product.rating} <span className="muted">({product.reviews} reviews)</span>
            </span>
          </div>
          <p className="lead">{product.description}</p>

          <div className="option">
            <span className="option-label">
              Color: <span className="muted">{COLORS[color].name}</span>
            </span>
            <div className="swatches">
              {product.colors.map((c) => (
                <button
                  key={c}
                  className={`swatch ${c === color ? 'active' : ''}`}
                  style={{ background: COLORS[c].hex }}
                  onClick={() => setColor(c)}
                  aria-label={COLORS[c].name}
                  title={COLORS[c].name}
                />
              ))}
            </div>
          </div>

          <div className="option">
            <span className="option-label">Size</span>
            <div className="chips">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  className={`chip ${s === size ? 'active' : ''}`}
                  onClick={() => {
                    setSize(s)
                    setSizeError(false)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {sizeError && <p className="field-error" style={{ marginTop: 8 }}>Please choose a size.</p>}
          </div>

          <div className="buy-row">
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                −
              </button>
              <input
                type="number"
                min="1"
                max="999"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                aria-label="Quantity"
              />
              <button onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Increase quantity">
                +
              </button>
            </div>
            <button className="btn btn-primary btn-lg" onClick={addToCart}>
              Add to cart · {money(product.price * qty)}
            </button>
          </div>
          <Link to={`/designer?product=${product.id}&color=${color}`} className="btn btn-outline btn-block" style={{ marginTop: 12 }}>
            Customize this {category?.label.replace(/s$/, '').toLowerCase()} (+{money(PRINT_SIDE_PRICE)} per printed side)
          </Link>

          <ul className="feature-list">
            {product.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          <div className="info-box">
            <h3>Bulk pricing</h3>
            <p className="muted small">Discount applies to the total number of items in your cart.</p>
            <table className="tier-table">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th>Discount</th>
                  <th>Price each</th>
                </tr>
              </thead>
              <tbody>
                {BULK_TIERS.map((t) => (
                  <tr key={t.label} className={t === tier ? 'current' : ''}>
                    <td>{t.label}</td>
                    <td>{t.discount ? `${Math.round(t.discount * 100)}%` : '—'}</td>
                    <td>{money(product.price * (1 - t.discount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>You might also like</h2>
        </div>
        <div className="product-grid">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
