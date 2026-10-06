import { useState } from 'react'
import { Link } from 'react-router-dom'
import ShirtMockup from '../components/ShirtMockup'
import { useCart } from '../context/CartContext'
import { COLORS, getProduct } from '../data/products'
import { BULK_TIERS, FREE_SHIPPING_FROM, money } from '../lib/pricing'

const EMPTY_FORM = { name: '', email: '', address: '', city: '', zip: '', country: '' }

function CartThumb({ item }) {
  if (item.preview) return <img src={item.preview} alt={`Your design on ${item.name}`} />
  const product = getProduct(item.productId)
  return <ShirtMockup type={product?.type} color={COLORS[item.color]?.hex} label={item.name} />
}

function Summary({ totals, children }) {
  const nextTier = BULK_TIERS.find((t) => t.min > totals.count)
  const afterDiscount = totals.subtotal - totals.discount
  const toFreeShipping = FREE_SHIPPING_FROM - afterDiscount

  return (
    <aside className="card order-summary">
      <h3>Order summary</h3>
      <div className="ship-progress">
        {toFreeShipping > 0 ? (
          <span>
            Add <strong>{money(toFreeShipping)}</strong> more for free shipping
          </span>
        ) : (
          <span>
            <strong>You’ve unlocked free shipping!</strong>
          </span>
        )}
        <div className="bar">
          <span style={{ width: `${Math.min(100, (afterDiscount / FREE_SHIPPING_FROM) * 100)}%` }} />
        </div>
      </div>
      <div className="summary-rows">
        <div>
          <span>Subtotal ({totals.count} items)</span>
          <span>{money(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="saving">
            <span>Bulk discount ({Math.round(totals.discountRate * 100)}%)</span>
            <span>−{money(totals.discount)}</span>
          </div>
        )}
        <div>
          <span>Shipping</span>
          <span>{totals.shipping ? money(totals.shipping) : 'Free'}</span>
        </div>
        <div className="total">
          <span>Total</span>
          <span>{money(totals.total)}</span>
        </div>
      </div>
      {nextTier && (
        <p className="muted small" style={{ margin: '14px 0 0' }}>
          Add {nextTier.min - totals.count} more item{nextTier.min - totals.count === 1 ? '' : 's'} to get{' '}
          {Math.round(nextTier.discount * 100)}% off everything.
        </p>
      )}
      {children}
    </aside>
  )
}

export default function Cart() {
  const { items, updateQty, remove, clear, totals } = useCart()
  const [step, setStep] = useState('cart')
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [order, setOrder] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const placeOrder = (e) => {
    e.preventDefault()
    const next = {}
    for (const [k, v] of Object.entries(form)) if (!v.trim()) next[k] = 'Required'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Please enter a valid email.'
    setErrors(next)
    if (Object.keys(next).length) return
    setOrder({
      number: 'IW-' + Math.floor(100000 + Math.random() * 900000),
      email: form.email,
      total: totals.total,
      count: totals.count,
    })
    clear()
    setForm(EMPTY_FORM)
    setStep('done')
    window.scrollTo(0, 0)
  }

  if (step === 'done' && order) {
    return (
      <div className="container order-done">
        <div className="check">✓</div>
        <h1>Thank you for your order!</h1>
        <p className="muted">
          Order <strong>{order.number}</strong> · {order.count} items · {money(order.total)}
        </p>
        <p>
          We’ve sent a confirmation to <strong>{order.email}</strong>. Our team will check your artwork and email a
          proof before printing.
        </p>
        <Link to="/shop" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container empty">
        <h1>Your cart is empty</h1>
        <p className="muted">Start with a blank or create your own design in the Design Studio.</p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link to="/designer" className="btn btn-primary">
            Start designing
          </Link>
          <Link to="/shop" className="btn btn-outline">
            Shop blanks
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>{step === 'cart' ? 'Your cart' : 'Checkout'}</h1>
        {step === 'checkout' && (
          <button className="btn btn-ghost btn-sm" onClick={() => setStep('cart')} style={{ paddingLeft: 0 }}>
            ← Back to cart
          </button>
        )}
      </div>

      <div className="cart-layout">
        {step === 'cart' ? (
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.key}>
                <div className="cart-thumb">
                  <CartThumb item={item} />
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <div className="meta">
                    {COLORS[item.color]?.name} · Size {item.size}
                    {item.design &&
                      (item.design.method === 'allover'
                        ? ' · All-over print'
                        : ` · Printed ${item.design.sides.join(' + ')}`)}{' '}
                    · {money(item.unitPrice)} each
                  </div>
                  <div className="cart-item-controls">
                    <div className="qty">
                      <button onClick={() => updateQty(item.key, item.qty - 1)} aria-label="Decrease quantity">
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={item.qty}
                        onChange={(e) => updateQty(item.key, Number(e.target.value) || 1)}
                        aria-label={`Quantity of ${item.name}`}
                      />
                      <button onClick={() => updateQty(item.key, item.qty + 1)} aria-label="Increase quantity">
                        +
                      </button>
                    </div>
                    <button className="remove-btn" onClick={() => remove(item.key)}>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="line-total">{money(item.qty * item.unitPrice)}</div>
              </div>
            ))}
            <div>
              <button className="remove-btn" onClick={clear}>
                Clear cart
              </button>
            </div>
          </div>
        ) : (
          <form className="card" onSubmit={placeOrder} noValidate>
            <h3>Shipping details</h3>
            <div className="form-grid">
              {[
                ['name', 'Full name', 'name'],
                ['email', 'Email', 'email'],
                ['address', 'Street address', 'street-address', 'full'],
                ['city', 'City', 'address-level2'],
                ['zip', 'Postal code', 'postal-code'],
                ['country', 'Country', 'country-name', 'full'],
              ].map(([key, label, autoComplete, cls]) => (
                <label className={`field ${cls ?? ''}`} key={key}>
                  {label}
                  <input
                    type={key === 'email' ? 'email' : 'text'}
                    value={form[key]}
                    onChange={set(key)}
                    autoComplete={autoComplete}
                  />
                  {errors[key] && <span className="field-error">{errors[key]}</span>}
                </label>
              ))}
            </div>
            <p className="notice" style={{ marginTop: 20 }}>
              Demo store: no payment is taken and no order is actually placed.
            </p>
            <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }}>
              Place order · {money(totals.total)}
            </button>
          </form>
        )}

        <Summary totals={totals}>
          {step === 'cart' && (
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }} onClick={() => setStep('checkout')}>
              Checkout
            </button>
          )}
          <Link to="/shop" className="link small" style={{ display: 'block', textAlign: 'center', marginTop: 14 }}>
            Continue shopping
          </Link>
        </Summary>
      </div>
    </div>
  )
}
