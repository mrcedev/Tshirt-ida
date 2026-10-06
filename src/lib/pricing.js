// Extra charge per printed side on custom designs (direct-to-garment).
export const PRINT_SIDE_PRICE = 6
// All-over (sublimation) print: one price per garment covering front, back and sleeves edge to edge.
export const ALL_OVER_PRICE = 18

export const FREE_SHIPPING_FROM = 75
export const SHIPPING_FEE = 6.95

export const BULK_TIERS = [
  { min: 1, discount: 0, label: '1–11' },
  { min: 12, discount: 0.1, label: '12–23' },
  { min: 24, discount: 0.15, label: '24–49' },
  { min: 50, discount: 0.2, label: '50–99' },
  { min: 100, discount: 0.25, label: '100+' },
]

export const tierFor = (qty) => [...BULK_TIERS].reverse().find((t) => qty >= t.min) ?? BULK_TIERS[0]
export const discountFor = (qty) => tierFor(qty).discount

// Screen printing: setup per ink color per location, plus a per-piece cost per color.
export const SCREEN_SETUP_PER_COLOR = 25
export const SCREEN_PER_COLOR_PER_PIECE = 1.1
// DTG: flat per-piece cost per location, no setup.
export const DTG_PER_LOCATION = 6
export const EMBROIDERY_SETUP = 45
export const EMBROIDERY_PER_LOCATION = 7.5

export function quote({ basePrice, qty, locations, inkColors, method }) {
  const garments = basePrice * qty * (1 - discountFor(qty))
  let setup = 0
  let printing = 0
  if (method === 'screen') {
    setup = SCREEN_SETUP_PER_COLOR * inkColors * locations
    printing = SCREEN_PER_COLOR_PER_PIECE * inkColors * locations * qty
  } else if (method === 'dtg') {
    printing = DTG_PER_LOCATION * locations * qty
  } else if (method === 'allover') {
    printing = ALL_OVER_PRICE * qty
  } else {
    setup = EMBROIDERY_SETUP * locations
    printing = EMBROIDERY_PER_LOCATION * locations * qty
  }
  const total = garments + setup + printing
  return { garments, setup, printing, total, perPiece: qty ? total / qty : 0 }
}

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const money = (n) => formatter.format(n)
