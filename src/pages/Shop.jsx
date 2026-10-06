import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { CATEGORIES, PRODUCTS } from '../data/products'

const SORTS = {
  popular: { label: 'Most popular', fn: (a, b) => b.reviews - a.reviews },
  'price-asc': { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
  rating: { label: 'Top rated', fn: (a, b) => b.rating - a.rating },
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState('popular')
  const category = CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'all'

  const products = useMemo(
    () => PRODUCTS.filter((p) => category === 'all' || p.type === category).sort(SORTS[sort].fn),
    [category, sort],
  )

  const setCategory = (id) => setParams(id === 'all' ? {} : { cat: id }, { replace: true })

  return (
    <div className="container">
      <div className="page-head">
        <h1>Shop blanks</h1>
        <p className="muted">Pick a garment, then personalise it in the Design Studio, or order it plain.</p>
      </div>

      <div className="shop-toolbar">
        <div className="chips" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip ${c.id === category ? 'active' : ''}`} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <label>
          <span className="muted small">Sort by </span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {products.length ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty muted">No products in this category yet.</div>
      )}

      <div className="cta-strip">
        <div>
          <h3>Have a design in mind?</h3>
          <p className="muted">Upload your artwork or add text and see it on any garment instantly.</p>
        </div>
        <Link to="/designer" className="btn btn-dark">
          Open Design Studio
        </Link>
      </div>
    </div>
  )
}
