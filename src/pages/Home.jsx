import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ShirtMockup from '../components/ShirtMockup'
import ProductCard from '../components/ProductCard'
import { useCart } from '../context/CartContext'
import { COLORS, PRODUCTS } from '../data/products'
import { PRINT_AREA, isDark } from '../lib/garments'
import { BULK_TIERS, FREE_SHIPPING_FROM, money } from '../lib/pricing'

const HERO_COLORS = ['white', 'black', 'red', 'royal', 'mustard', 'forest']

const STEPS = [
  { title: 'Pick your garment', text: 'Tees, long sleeves, hoodies and tanks in 12 colors and sizes from kids to 2XL.' },
  { title: 'Design it online', text: 'Add text and upload artwork in the Design Studio. Drag, resize and preview front and back.' },
  { title: 'We print & ship', text: 'Printed in our studio and shipped within 3–5 business days. Rush options available.' },
]

const METHODS = [
  {
    name: 'Direct-to-Garment',
    icon: 'M4 7h16M4 12h16M4 17h10',
    text: 'Full-color, photo-quality prints with no setup fees. Perfect for one-offs and small runs.',
    points: ['No minimum order', 'Unlimited colors', 'Soft feel'],
  },
  {
    name: 'Screen Printing',
    icon: 'M3 5h18v14H3zM7 9h10v6H7z',
    text: 'The classic for team and event orders. Bold, durable ink at the best price per piece.',
    points: ['Best from 24 pieces', 'Vivid spot colors', 'Extremely durable'],
  },
  {
    name: 'Embroidery',
    icon: 'M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18M4 12h16',
    text: 'Stitched logos with a premium, textured finish. Ideal for workwear and hoodies.',
    points: ['Premium look', 'Lasts the life of the garment', 'Great on fleece'],
  },
]

const TESTIMONIALS = [
  {
    quote: 'We ordered 60 shirts for our charity run. The colors were spot on and they arrived two days early.',
    name: 'Maja K.',
    role: 'Event organiser',
  },
  {
    quote: 'The Design Studio is so easy. I made a birthday shirt for my dad in five minutes and the print quality is great.',
    name: 'Luka P.',
    role: 'First-time customer',
  },
  {
    quote: 'Our merch hoodies are now our best-selling item. Embroidery looks premium and has survived dozens of washes.',
    name: 'Studio Northlight',
    role: 'Small brand',
  },
]

const FAQ = [
  {
    q: 'Is there a minimum order?',
    a: 'No. With direct-to-garment printing you can order a single shirt. Screen printing becomes the cheaper option from about 24 pieces.',
  },
  {
    q: 'How long does it take?',
    a: 'Standard orders are printed and shipped within 3–5 business days. Large bulk orders usually take 7–10 business days. Contact us if you have a hard deadline.',
  },
  {
    q: 'What file types can I upload?',
    a: 'PNG, JPG, SVG and WebP. For the sharpest print, upload artwork at least 2000 px wide with a transparent background.',
  },
  {
    q: 'How do bulk discounts work?',
    a: `Discounts are applied automatically to your whole cart: ${BULK_TIERS.filter((t) => t.discount)
      .map((t) => `${Math.round(t.discount * 100)}% from ${t.min} pieces`)
      .join(', ')}. Sizes and colors can be mixed.`,
  },
  {
    q: 'Do you ship for free?',
    a: `Shipping is free on orders over ${money(FREE_SHIPPING_FROM)}. Otherwise a flat rate applies.`,
  },
  {
    q: 'Can I return a custom shirt?',
    a: 'Because custom items are made for you, we can’t accept returns for change of mind. If there is any print defect we’ll reprint it for free.',
  },
]

function HeroShirt({ colorKey }) {
  const hex = COLORS[colorKey].hex
  const ink = isDark(hex) ? '#ffffff' : '#16161d'
  const cx = PRINT_AREA.x + PRINT_AREA.w / 2
  return (
    <ShirtMockup type="tee" color={hex} label={`Example custom shirt in ${COLORS[colorKey].name}`}>
      <g fontFamily="'Bebas Neue', sans-serif" textAnchor="middle" fill={ink}>
        <text x={cx} y="170" fontSize="58">MAKE IT</text>
        <text x={cx} y="226" fontSize="58" fill="#ff5a36">
          YOURS
        </text>
        <text x={cx} y="256" fontSize="16" fontFamily="'Inter', sans-serif" fontWeight="600" letterSpacing="3">
          EST. 2026
        </text>
      </g>
    </ShirtMockup>
  )
}

function ContactForm() {
  const { notify } = useCart()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Please enter a valid email.'
    if (form.message.trim().length < 10) next.message = 'Tell us a bit more (at least 10 characters).'
    setErrors(next)
    if (Object.keys(next).length) return
    notify('Thanks! We’ll reply within one business day.')
    setForm({ name: '', email: '', message: '' })
  }

  return (
    <form className="card form-grid" onSubmit={submit} noValidate>
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
      <label className="field full">
        Message
        <textarea value={form.message} onChange={set('message')} />
        {errors.message && <span className="field-error">{errors.message}</span>}
      </label>
      <div className="full">
        <button className="btn btn-primary" type="submit">
          Send message
        </button>
      </div>
    </form>
  )
}

export default function Home() {
  const [heroColor, setHeroColor] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setHeroColor((i) => (i + 1) % HERO_COLORS.length), 2600)
    return () => clearInterval(t)
  }, [paused])

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Custom printing · No minimums</span>
            <h1>
              Wear your <em>idea.</em>
            </h1>
            <p className="lead">
              Design custom t-shirts and hoodies online in minutes. One for you, or hundreds for your team, event or
              brand. Printed with care and shipped fast.
            </p>
            <div className="hero-actions">
              <Link to="/designer" className="btn btn-primary btn-lg">
                Start designing
              </Link>
              <Link to="/shop" className="btn btn-outline btn-lg">
                Browse blanks
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <strong>40k+</strong>
                <span>shirts printed</span>
              </div>
              <div>
                <strong>4.8 ★</strong>
                <span>average rating</span>
              </div>
              <div>
                <strong>3–5 days</strong>
                <span>delivery</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <HeroShirt colorKey={HERO_COLORS[heroColor]} />
            <div className="swatches hero-swatches">
              {HERO_COLORS.map((c, i) => (
                <button
                  key={c}
                  className={`swatch ${i === heroColor ? 'active' : ''}`}
                  style={{ background: COLORS[c].hex }}
                  onClick={() => {
                    setHeroColor(i)
                    setPaused(true)
                  }}
                  aria-label={COLORS[c].name}
                  title={COLORS[c].name}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>From idea to shirt in three steps</h2>
            </div>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Bestsellers</span>
              <h2>Start with a great blank</h2>
            </div>
            <Link to="/shop" className="link">
              View all products →
            </Link>
          </div>
          <div className="product-grid">
            {PRODUCTS.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Print methods</span>
              <h2>The right technique for every job</h2>
              <p className="muted">Not sure which to pick? We’ll recommend the best method for your design and quantity.</p>
            </div>
          </div>
          <div className="methods">
            {METHODS.map((m) => (
              <div className="method" key={m.name}>
                <div className="method-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </div>
                <h3>{m.name}</h3>
                <p className="muted">{m.text}</p>
                <ul>
                  {m.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="bulk-banner">
            <div>
              <span className="eyebrow">Teams · Events · Brands</span>
              <h2>The more you order, the more you save</h2>
              <p className="muted">
                Bulk discounts apply automatically across your whole cart. Mix sizes, colors and designs. Need a custom
                quote with screen printing or embroidery?
              </p>
              <Link to="/bulk" className="btn btn-primary">
                Get a bulk quote
              </Link>
            </div>
            <div className="tier-list">
              {BULK_TIERS.map((t) => (
                <div className="tier" key={t.label}>
                  <strong>{t.discount ? `−${Math.round(t.discount * 100)}%` : '—'}</strong>
                  <span>{t.label} pcs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Reviews</span>
              <h2>Loved by makers, teams & brands</h2>
            </div>
          </div>
          <div className="testimonials">
            {TESTIMONIALS.map((t) => (
              <figure className="testimonial" key={t.name}>
                <div className="stars" aria-label="5 out of 5 stars">
                  ★★★★★
                </div>
                <blockquote>“{t.quote}”</blockquote>
                <figcaption>
                  <strong>{t.name}</strong> · {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">FAQ</span>
              <h2>Questions, answered</h2>
            </div>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="contact">
        <div className="container contact-grid">
          <div>
            <span className="eyebrow">Contact</span>
            <h2>Let’s make something together</h2>
            <p className="muted">Questions about a design, an order or a big project? Send us a message.</p>
            <div className="contact-info">
              <div>
                <strong>Email</strong>
                <span>hello@inkwave.example</span>
              </div>
              <div>
                <strong>Studio hours</strong>
                <span>Mon–Fri, 8:00–18:00</span>
              </div>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
