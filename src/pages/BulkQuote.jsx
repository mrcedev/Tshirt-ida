import { useState } from 'react'
import { PRODUCTS, getProduct } from '../data/products'
import { BULK_TIERS, money, quote, tierFor } from '../lib/pricing'

const METHODS = [
  { id: 'screen', name: 'Screen print', hint: 'Best value from 24 pcs' },
  { id: 'dtg', name: 'DTG', hint: 'Full color, no setup' },
  { id: 'embroidery', name: 'Embroidery', hint: 'Premium stitched logo' },
  { id: 'allover', name: 'All-over print', hint: 'Edge to edge, incl. sleeves' },
]

const EMPTY_REQUEST = { name: '', email: '', company: '', deadline: '', notes: '' }

export default function BulkQuote() {
  const [productId, setProductId] = useState(PRODUCTS[0].id)
  const [qty, setQty] = useState(50)
  const [method, setMethod] = useState('screen')
  const [locations, setLocations] = useState(1)
  const [inkColors, setInkColors] = useState(2)
  const [form, setForm] = useState(EMPTY_REQUEST)
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(null)

  const product = getProduct(productId)
  const q = quote({ basePrice: product.price, qty, locations, inkColors, method })
  const tier = tierFor(qty)
  const methodName = METHODS.find((m) => m.id === method).name

  // Show how the other methods compare for the same job.
  const alternatives = METHODS.filter((m) => m.id !== method).map((m) => ({
    ...m,
    perPiece: quote({ basePrice: product.price, qty, locations, inkColors, method: m.id }).perPiece,
  }))
  const cheaper = alternatives.filter((a) => a.perPiece < q.perPiece - 0.005).sort((a, b) => a.perPiece - b.perPiece)[0]

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Please enter a valid email.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSent({ email: form.email, summary: `${qty} × ${product.name}, ${methodName}`, total: q.total })
    setForm(EMPTY_REQUEST)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="container">
      <div className="page-head">
        <h1>Bulk orders & quotes</h1>
        <p className="muted">
          Teams, events, schools and brands: get an instant estimate, then send us your request for a final quote and a
          free design proof.
        </p>
      </div>

      <div className="bulk-layout">
        <div>
          <div className="card">
            <h3>Build your estimate</h3>
            <div className="form-grid">
              <label className="field">
                Garment
                <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({money(p.price)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Quantity
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(5000, Math.floor(Number(e.target.value) || 1))))}
                />
              </label>
              <div className="full">
                <span className="option-label">Print method</span>
                <div className="method-picker">
                  {METHODS.map((m) => (
                    <button key={m.id} type="button" className={m.id === method ? 'active' : ''} onClick={() => setMethod(m.id)}>
                      <strong>{m.name}</strong>
                      <span>{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              {method !== 'allover' && (
                <div>
                  <span className="option-label">Print locations</span>
                  <div className="chips">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className={`chip ${n === locations ? 'active' : ''}`} onClick={() => setLocations(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    e.g. front, back, sleeve
                  </p>
                </div>
              )}
              {method === 'screen' && (
                <div>
                  <span className="option-label">Ink colors per location</span>
                  <div className="chips">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button key={n} type="button" className={`chip ${n === inkColors ? 'active' : ''}`} onClick={() => setInkColors(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <h3>Volume discounts on garments</h3>
            <table className="tier-table">
              <thead>
                <tr>
                  <th>Pieces</th>
                  <th>Discount</th>
                  <th>{product.name}</th>
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

          <div className="card" style={{ marginTop: 24 }}>
            <h3>Request a final quote</h3>
            {sent ? (
              <div className="success-box">
                <strong>Request received!</strong>
                <p style={{ margin: '6px 0 12px' }}>
                  We’ll email <strong>{sent.email}</strong> within one business day with a final quote for {sent.summary}{' '}
                  (estimate {money(sent.total)}) and a free design proof.
                </p>
                <button className="btn btn-outline btn-sm" onClick={() => setSent(null)}>
                  Send another request
                </button>
              </div>
            ) : (
              <form className="form-grid" onSubmit={submit} noValidate>
                <label className="field">
                  Name
                  <input value={form.name} onChange={set('name')} autoComplete="name" />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </label>
                <label className="field">
                  Email
                  <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </label>
                <label className="field">
                  Team / company <span className="muted">(optional)</span>
                  <input value={form.company} onChange={set('company')} autoComplete="organization" />
                </label>
                <label className="field">
                  Needed by <span className="muted">(optional)</span>
                  <input type="date" min={today} value={form.deadline} onChange={set('deadline')} />
                </label>
                <label className="field full">
                  Details <span className="muted">(sizes, colors, artwork links…)</span>
                  <textarea value={form.notes} onChange={set('notes')} />
                </label>
                <div className="full">
                  <button type="submit" className="btn btn-primary">
                    Send quote request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <aside className="card quote-box">
          <span className="eyebrow">Instant estimate</span>
          <div className="quote-big">{money(q.perPiece)}</div>
          <p className="muted small">per piece · {qty} × {product.name}</p>
          <div className="summary-rows" style={{ marginTop: 16 }}>
            <div>
              <span>
                Garments{tier.discount ? ` (−${Math.round(tier.discount * 100)}%)` : ''}
              </span>
              <span>{money(q.garments)}</span>
            </div>
            <div>
              <span>Setup</span>
              <span>{q.setup ? money(q.setup) : 'None'}</span>
            </div>
            <div>
              <span>
                {methodName}
                {method !== 'allover' && ` · ${locations} location${locations > 1 ? 's' : ''}`}
                {method === 'screen' ? ` · ${inkColors} color${inkColors > 1 ? 's' : ''}` : ''}
              </span>
              <span>{money(q.printing)}</span>
            </div>
            <div className="total">
              <span>Estimated total</span>
              <span>{money(q.total)}</span>
            </div>
          </div>
          {cheaper && (
            <p className="notice" style={{ marginTop: 16 }}>
              Tip: {cheaper.name} would be {money(cheaper.perPiece)} per piece for this job.
            </p>
          )}
          <p className="muted small" style={{ margin: '16px 0 0' }}>
            Estimate excludes shipping and taxes. Final price is confirmed after artwork review.
          </p>
        </aside>
      </div>
    </div>
  )
}
