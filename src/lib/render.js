// Draws garments and design layers onto a <canvas>. Used for the PNG download, cart previews
// and the textures of the 3D preview, so all three always match the 2D editor.
import { GARMENTS, PRINT_AREA, VIEWBOX, outlineColor } from './garments'

export const TEXT_SIZE = 40

const imageCache = new Map()

export function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = (e) => {
          imageCache.delete(src)
          reject(e)
        }
        img.src = src
      }),
    )
  }
  return imageCache.get(src)
}

// Wait for every font and image a set of layers needs; returns images keyed by layer id.
export async function prepareLayers(layers) {
  const fonts = [...new Set(layers.filter((l) => l.kind === 'text').map((l) => l.font))]
  await Promise.all(fonts.map((f) => document.fonts.load(`${TEXT_SIZE}px "${f}"`)))
  const images = {}
  await Promise.all(
    layers
      .filter((l) => l.kind === 'image')
      .map(async (l) => {
        images[l.id] = await loadImage(l.src)
      }),
  )
  return images
}

let measureCtx
// A layer's box in its own coordinates (before position/rotation/scale), centred on 0,0.
export function layerBounds(layer) {
  if (layer.kind !== 'text') return { x: -layer.w / 2, y: -layer.h / 2, w: layer.w, h: layer.h }
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx.font = `${TEXT_SIZE}px "${layer.font}"`
  measureCtx.textBaseline = 'middle'
  const m = measureCtx.measureText(layer.text || ' ')
  const up = m.actualBoundingBoxAscent || TEXT_SIZE / 2
  const down = m.actualBoundingBoxDescent || TEXT_SIZE / 2
  return { x: -m.width / 2, y: -up, w: m.width, h: up + down }
}

// Topmost layer under a point (garment coordinates), or null.
export function layerAt(layers, x, y, pad = 4) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    // Move the point into the layer's own (unrotated, unscaled) coordinates.
    const a = (-l.rotation * Math.PI) / 180
    const dx = x - l.x
    const dy = y - l.y
    const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / l.scale
    const ly = (dx * Math.sin(a) + dy * Math.cos(a)) / l.scale
    const b = layerBounds(l)
    const p = pad / l.scale
    if (lx >= b.x - p && lx <= b.x + b.w + p && ly >= b.y - p && ly <= b.y + b.h + p) return l
  }
  return null
}

// Garment body in garment coordinates (VIEWBOX). `shading` adds the soft side shadows of the 2D mockup;
// the 3D view leaves it off because real lighting does that job.
export function drawGarment(ctx, type, hex, { shading = true } = {}) {
  const g = GARMENTS[type] ?? GARMENTS.tee
  const body = new Path2D(g.body)
  const stroke = outlineColor(hex)
  ctx.fillStyle = hex
  ctx.fill(body)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2
  for (const d of g.details) ctx.stroke(new Path2D(d))
  ctx.globalAlpha = 1
  if (shading) {
    const grad = ctx.createLinearGradient(0, 0, VIEWBOX.w, 0)
    grad.addColorStop(0, 'rgba(0,0,0,.12)')
    grad.addColorStop(0.3, 'rgba(255,255,255,.08)')
    grad.addColorStop(0.7, 'rgba(255,255,255,.04)')
    grad.addColorStop(1, 'rgba(0,0,0,.14)')
    ctx.fillStyle = grad
    ctx.fill(body)
    ctx.strokeStyle = stroke
    ctx.stroke(body)
  }
}

// Design layers, clipped to the standard print area or (all-over print) to the whole garment.
// `clipToGarment: false` skips the outline clip, for the 3D model whose shape differs slightly.
export function drawLayers(ctx, type, layers, images, { allOver = false, clipToGarment = true } = {}) {
  ctx.save()
  if (allOver) {
    if (clipToGarment) ctx.clip(new Path2D((GARMENTS[type] ?? GARMENTS.tee).body))
  } else {
    ctx.beginPath()
    ctx.rect(PRINT_AREA.x, PRINT_AREA.y, PRINT_AREA.w, PRINT_AREA.h)
    ctx.clip()
  }
  for (const l of layers) {
    ctx.save()
    ctx.translate(l.x, l.y)
    ctx.rotate((l.rotation * Math.PI) / 180)
    ctx.scale(l.scale, l.scale)
    if (l.kind === 'text') {
      ctx.font = `${TEXT_SIZE}px "${l.font}"`
      ctx.fillStyle = l.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(l.text, 0, 0)
    } else if (images[l.id]) {
      ctx.drawImage(images[l.id], -l.w / 2, -l.h / 2, l.w, l.h)
    }
    ctx.restore()
  }
  ctx.restore()
}

// Render one side onto an existing canvas, whose size decides the resolution.
export async function drawSide(canvas, { type, colorHex, layers, allOver, shading = true, background = null }) {
  const images = await prepareLayers(layers)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.scale(canvas.width / VIEWBOX.w, canvas.height / VIEWBOX.h)
  drawGarment(ctx, type, colorHex, { shading })
  drawLayers(ctx, type, layers, images, { allOver })
}

// Only the printed ink on a transparent canvas: the texture projected onto the 3D model.
export async function drawPrint(canvas, { type, layers, allOver, background = null, selectedId = null }) {
  const images = await prepareLayers(layers)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (allOver && background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.scale(canvas.width / VIEWBOX.w, canvas.height / VIEWBOX.h)
  drawLayers(ctx, type, layers, images, { allOver, clipToGarment: false })

  // Dashed selection outline, so the selected design is visible on the 3D shirt.
  const sel = layers.find((l) => l.id === selectedId)
  if (sel) {
    const b = layerBounds(sel)
    const pad = 4 / sel.scale
    ctx.save()
    ctx.translate(sel.x, sel.y)
    ctx.rotate((sel.rotation * Math.PI) / 180)
    ctx.scale(sel.scale, sel.scale)
    ctx.lineWidth = 1.5 / sel.scale
    ctx.setLineDash([5 / sel.scale, 4 / sel.scale])
    ctx.strokeStyle = '#ff5a36'
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
    ctx.restore()
  }
}

// One side as an image URL (cart thumbnails, PNG download).
export async function renderSideImage(options, width, { format = 'image/jpeg', background = '#f1ede5' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((VIEWBOX.h * width) / VIEWBOX.w)
  await drawSide(canvas, { ...options, background })
  return canvas.toDataURL(format, 0.85)
}
