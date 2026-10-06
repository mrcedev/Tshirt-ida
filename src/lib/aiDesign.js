// Browser-side half of the AI Designer: describes the current design to the AI and turns the
// AI's answer back into editor layers. The API call itself goes through /api/ai-design (server/).
import { COLORS, FONTS } from '../data/products'
import { VIEWBOX } from './garments'
import { TEXT_SIZE } from './render'

const SIDES = ['front', 'back']
const uid = () => Math.random().toString(36).slice(2, 10)
const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))
const round = (n) => Math.round(n * 10) / 10
const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)

// Current design as compact JSON for the AI. Image pixels are left out; the AI refers to images by id.
function describeDesign(design) {
  const side = (layers) =>
    layers.map((l) =>
      l.kind === 'text'
        ? { id: l.id, kind: 'text', text: l.text, font: l.font, color: l.color, x: round(l.x), y: round(l.y), size: round(l.scale * TEXT_SIZE), rotation: l.rotation }
        : { id: l.id, kind: 'image', name: l.name, x: round(l.x), y: round(l.y), size: round(l.w * l.scale), rotation: l.rotation },
    )
  return { front: side(design.front), back: side(design.back) }
}

export function buildUserMessage(request, { product, color, background, design }) {
  const context = {
    product: { name: product.name, type: product.type, availableColors: product.colors },
    garmentColor: color,
    background,
    design: describeDesign(design),
  }
  return `${request.trim()}\n\n<current_state>\n${JSON.stringify(context)}\n</current_state>`
}

// Make AI-written SVG safe and loadable as an image: must be a real <svg> with a size.
function prepareSvg(markup) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName !== 'svg' || doc.querySelector('parsererror')) return null
  doc.querySelectorAll('script, foreignObject').forEach((n) => n.remove())
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  let w = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width'))
  let h = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height'))
  if (!(w > 0 && h > 0)) return null
  if (vb.length !== 4) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  // Browsers need explicit pixel dimensions to draw an SVG onto a canvas.
  const ratio = 1000 / Math.max(w, h)
  w *= ratio
  h *= ratio
  svg.setAttribute('width', Math.round(w))
  svg.setAttribute('height', Math.round(h))
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  return { src, aspect: h / w }
}

// Turn the AI's answer into editor state. Unknown or broken layers are skipped rather than failing.
export function applyAIResult(result, { product, design }) {
  const existing = new Map([...design.front, ...design.back].map((l) => [l.id, l]))
  const place = (l) => ({
    x: clamp(l.x, 0, VIEWBOX.w),
    y: clamp(l.y, 0, VIEWBOX.h),
    rotation: Math.round(clamp(l.rotation, -180, 180)),
  })

  const toLayer = (l) => {
    if (l.kind === 'text' && l.text?.trim()) {
      return {
        id: uid(),
        kind: 'text',
        text: l.text.slice(0, 40),
        font: FONTS.includes(l.font) ? l.font : FONTS[0],
        color: isHex(l.color) ? l.color : '#16161d',
        scale: clamp(l.size / TEXT_SIZE, 0.2, 6),
        ...place(l),
      }
    }
    if (l.kind === 'svg' && l.svg) {
      const art = prepareSvg(l.svg)
      if (!art) return null
      const w = clamp(l.size, 10, VIEWBOX.w)
      return { id: uid(), kind: 'image', name: 'AI artwork', src: art.src, w, h: w * art.aspect, scale: 1, ...place(l) }
    }
    if (l.kind === 'existing' && existing.has(l.ref)) {
      const old = existing.get(l.ref)
      const base = old.kind === 'text' ? TEXT_SIZE : old.w
      return { ...old, id: uid(), scale: clamp(l.size / base, 0.2, 6), ...place(l) }
    }
    return null
  }

  const next = {}
  for (const s of SIDES) next[s] = (Array.isArray(result[s]) ? result[s] : []).map(toLayer).filter(Boolean)
  return {
    design: next,
    color: product.colors.includes(result.garmentColor) && COLORS[result.garmentColor] ? result.garmentColor : null,
    background: isHex(result.background) ? result.background : null,
    message: typeof result.message === 'string' ? result.message : 'Here’s your design!',
  }
}
