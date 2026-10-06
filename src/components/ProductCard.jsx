import { useState } from 'react'
import { Link } from 'react-router-dom'
import ShirtMockup from './ShirtMockup'
import { COLORS } from '../data/products'
import { money } from '../lib/pricing'

export default function ProductCard({ product }) {
  const [color, setColor] = useState(product.colors[0])
  return (
    <article className="product-card">
      <Link to={`/product/${product.id}?color=${color}`} className="product-media">
        {product.badge && <span className="tag">{product.badge}</span>}
        <ShirtMockup type={product.type} color={COLORS[color].hex} label={`${product.name} in ${COLORS[color].name}`} />
      </Link>
      <div className="product-body">
        <div className="swatches small">
          {product.colors.map((c) => (
            <button
              key={c}
              className={`swatch ${c === color ? 'active' : ''}`}
              style={{ background: COLORS[c].hex }}
              onClick={() => setColor(c)}
              title={COLORS[c].name}
              aria-label={COLORS[c].name}
            />
          ))}
        </div>
        <Link to={`/product/${product.id}?color=${color}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-meta">
          <span className="price">{money(product.price)}</span>
          <span className="rating">★ {product.rating} <span className="muted">({product.reviews})</span></span>
        </div>
      </div>
    </article>
  )
}
