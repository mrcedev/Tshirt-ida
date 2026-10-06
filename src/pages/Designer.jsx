import { Suspense, lazy, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AIDesigner from '../components/AIDesigner'
import ShirtMockup from '../components/ShirtMockup'
import { useCart } from '../context/CartContext'
import { COLORS, FONTS, PRODUCTS, getProduct } from '../data/products'
import { GARMENTS, PRINT_AREA, VIEWBOX, isDark } from '../lib/garments'
import { ALL_OVER_PRICE, PRINT_SIDE_PRICE, money } from '../lib/pricing'
import { applyAIResult } from '../lib/aiDesign'
import { TEXT_SIZE, drawPrint, layerAt, renderSideImage } from '../lib/render'

// Three.js is large, so the 3D preview is only downloaded when someone opens it.
const Shirt3D = lazy(() => import('../components/Shirt3D'))

const INKS = ['#16161d', '#ffffff', '#ff5a36', '#c8323a', '#2c5fc4', '#2f5d46', '#e0a92e', '#f2a7c0']
const SIDES = ['front', 'back']
const MAX_IMAGE_PX = 1200
const TEXTURE_WIDTH = 1024
const CENTER = { x: PRINT_AREA.x + PRINT_AREA.w / 2, y: PRINT_AREA.y + PRINT_AREA.h / 2 }

const uid = () => Math.random().toString(36).slice(2, 10)
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function makeCanvas(width) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round((VIEWBOX.h * width) / VIEWBOX.w)
  return c
}

// Downscale large uploads so the editor stays fast and the data URL stays small.
async function readImageFile(file) {
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = src
  })
  const ratio = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height))
  if (ratio === 1 && file.type !== 'image/svg+xml') return { src, width: img.width, height: img.height }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((img.width || 600) * ratio)
  canvas.height = Math.round((img.height || 600) * ratio)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}

function LayerShape({ layer, selected, onPointerDown }) {
  const textRef = useRef(null)
  const [textBox, setTextBox] = useState(null)

  useLayoutEffect(() => {
    if (layer.kind !== 'text') return
    let alive = true
    const measure = () => {
      if (!alive || !textRef.current) return
      const b = textRef.current.getBBox()
      setTextBox({ x: b.x, y: b.y, w: b.width, h: b.height })
    }
    measure()
    // Re-measure once the web font has loaded; the first pass may use a fallback font.
    document.fonts.load(`${TEXT_SIZE}px "${layer.font}"`).then(measure, measure)
    return () => {
      alive = false
    }
  }, [layer.kind, layer.text, layer.font])

  const box = layer.kind === 'text' ? textBox : { x: -layer.w / 2, y: -layer.h / 2, w: layer.w, h: layer.h }
  const pad = 4 / layer.scale

  return (
    <g
      className="layer"
      transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) scale(${layer.scale})`}
      onPointerDown={(e) => onPointerDown(e, layer)}
    >
      {layer.kind === 'text' ? (
        <text
          ref={textRef}
          fontFamily={`'${layer.font}'`}
          fontSize={TEXT_SIZE}
          fill={layer.color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {layer.text}
        </text>
      ) : (
        <image href={layer.src} x={-layer.w / 2} y={-layer.h / 2} width={layer.w} height={layer.h} preserveAspectRatio="none" />
      )}
      {box && (
        <rect
          x={box.x - pad}
          y={box.y - pad}
          width={box.w + pad * 2}
          height={box.h + pad * 2}
          fill="transparent"
          stroke={selected ? '#ff5a36' : 'none'}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}

function layerLabel(layer) {
  return layer.kind === 'text' ? `“${layer.text || ' '}”` : layer.name || 'Image'
}

function InkPicker({ value, onChange, allowNone = false }) {
  return (
    <div className="ink-swatches">
      {allowNone && (
        <button className={`swatch swatch-none ${value ? '' : 'active'}`} onClick={() => onChange(null)} aria-label="None" title="None" />
      )}
      {INKS.map((c) => (
        <button
          key={c}
          className={`swatch ${value === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
      <input
        type="color"
        value={value ?? '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
        title="Custom color"
      />
    </div>
  )
}

export default function Designer() {
  const [params] = useSearchParams()
  const { add, notify } = useCart()
  const clipId = 'pa' + useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const initialProduct = getProduct(params.get('product')) ?? PRODUCTS[0]
  const [product, setProduct] = useState(initialProduct)
  const [color, setColor] = useState(
    initialProduct.colors.includes(params.get('color')) ? params.get('color') : initialProduct.colors[0],
  )
  const [background, setBackground] = useState(null) // optional printed color covering the whole garment
  const [side, setSide] = useState('front')
  const [view, setView] = useState('2d')
  const [autoRotate, setAutoRotate] = useState(false)
  const [design, setDesign] = useState({ front: [], back: [] })
  const [selectedId, setSelectedId] = useState(null)
  const [sizeQty, setSizeQty] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [textures] = useState(() => ({ front: makeCanvas(TEXTURE_WIDTH), back: makeCanvas(TEXTURE_WIDTH) }))
  const [textureVersion, setTextureVersion] = useState(0)
  const [aiUndo, setAiUndo] = useState(null) // design before the last AI change

  const svgRef = useRef(null)
  const fileRef = useRef(null)
  const drag = useRef(null)

  // We only have a 3D model of a t-shirt so far; other garments stay 2D.
  const has3D = product.type === 'tee'
  const show3D = view === '3d' && has3D
  // A printed background covers the whole garment, so show that instead of the fabric color.
  const garmentHex = background ?? COLORS[color].hex
  const layers = design[side]
  const selected = layers.find((l) => l.id === selectedId) ?? null
  const printedSides = SIDES.filter((s) => design[s].length > 0)
  const hasDesign = printedSides.length > 0 || !!background
  // A background makes it an all-over print with one flat price; otherwise pay per printed side.
  const printPrice = background ? ALL_OVER_PRICE : PRINT_SIDE_PRICE * printedSides.length
  const unitPrice = product.price + printPrice
  const totalQty = product.sizes.reduce((s, size) => s + (sizeQty[size] || 0), 0)

  const updateLayers = useCallback((fn) => setDesign((d) => ({ ...d, [side]: fn(d[side]) })), [side])
  const updateLayer = useCallback(
    (id, patch) => updateLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    [updateLayers],
  )
  const removeLayer = useCallback(
    (id) => {
      updateLayers((ls) => ls.filter((l) => l.id !== id))
      setSelectedId(null)
    },
    [updateLayers],
  )

  const addLayer = (layer) => {
    updateLayers((ls) => [...ls, layer])
    setSelectedId(layer.id)
    setError('')
  }

  const addText = () =>
    addLayer({
      id: uid(),
      kind: 'text',
      text: layers.some((l) => l.kind === 'text') ? 'More text' : 'Your text',
      font: FONTS[0],
      color: isDark(garmentHex) ? '#ffffff' : '#16161d',
      x: CENTER.x,
      y: CENTER.y - 40 + (layers.length % 4) * 30,
      rotation: 0,
      scale: 1.4,
    })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file (PNG, JPG, SVG or WebP).')
      return
    }
    try {
      const { src, width, height } = await readImageFile(file)
      const fit = Math.min(140 / width, 140 / height)
      addLayer({
        id: uid(),
        kind: 'image',
        name: file.name,
        src,
        w: width * fit,
        h: height * fit,
        x: CENTER.x,
        y: CENTER.y,
        rotation: 0,
        scale: 1,
      })
    } catch {
      notify('Sorry, that image could not be loaded.')
    }
  }

  const changeProduct = (p) => {
    setProduct(p)
    if (!p.colors.includes(color)) setColor(p.colors[0])
    setSizeQty({})
  }

  const changeSide = (s) => {
    setSide(s)
    setSelectedId(null)
  }

  const moveLayer = (id, dir) =>
    updateLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ls.length) return ls
      const next = [...ls]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const duplicateLayer = (layer) => addLayer({ ...layer, id: uid(), x: layer.x + 12, y: layer.y + 12 })

  // ---- Dragging (2D editor) ----
  const toSvgPoint = (e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  const onLayerPointerDown = (e, layer) => {
    e.stopPropagation()
    setSelectedId(layer.id)
    const p = toSvgPoint(e)
    drag.current = { id: layer.id, dx: p.x - layer.x, dy: p.y - layer.y }
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!drag.current) return
    const p = toSvgPoint(e)
    updateLayer(drag.current.id, {
      x: clamp(p.x - drag.current.dx, 0, VIEWBOX.w),
      y: clamp(p.y - drag.current.dy, 0, VIEWBOX.h),
    })
  }

  const endDrag = () => {
    drag.current = null
  }

  // ---- Keyboard: delete and nudge the selected layer ----
  useEffect(() => {
    if (!selected) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeLayer(selected.id)
        return
      }
      const step = e.shiftKey ? 10 : 2
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      const m = moves[e.key]
      if (!m) return
      e.preventDefault()
      updateLayer(selected.id, {
        x: clamp(selected.x + m[0], 0, VIEWBOX.w),
        y: clamp(selected.y + m[1], 0, VIEWBOX.h),
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, removeLayer, updateLayer])

  // ---- 3D print textures: redraw both sides whenever the design changes while the 3D view is open ----
  // Changes that arrive while a redraw is running (e.g. while dragging) are merged into one more redraw.
  const latest = useRef(null)
  latest.current = { design, background, selectedId, type: product.type }
  const redrawState = useRef({ running: false, again: false })
  const redrawTextures = useCallback(async () => {
    const st = redrawState.current
    if (st.running) {
      st.again = true
      return
    }
    st.running = true
    try {
      do {
        st.again = false
        const { design: d, background: bg, selectedId: sel, type } = latest.current
        for (const s of SIDES) {
          await drawPrint(textures[s], { type, layers: d[s], allOver: true, background: bg, selectedId: sel })
        }
        setTextureVersion((v) => v + 1)
      } while (st.again)
    } catch {
      // An image failed to load; the previous texture stays visible.
    } finally {
      st.running = false
    }
  }, [textures])

  useEffect(() => {
    if (show3D) redrawTextures()
  }, [show3D, design, background, selectedId, product.type, redrawTextures])

  // ---- Editing on the 3D shirt ----
  const layerAtOnSide = useCallback((s, x, y) => layerAt(design[s], x, y), [design])
  const selectFrom3D = useCallback((id, s) => {
    if (s) setSide(s)
    setSelectedId(id)
  }, [])
  const moveFrom3D = useCallback((s, id, x, y) => {
    setDesign((d) => ({
      ...d,
      [s]: d[s].map((l) => (l.id === id ? { ...l, x: clamp(x, 0, VIEWBOX.w), y: clamp(y, 0, VIEWBOX.h) } : l)),
    }))
  }, [])

  // ---- AI Designer ----
  const applyAI = (result) => {
    const next = applyAIResult(result, { product, design })
    setAiUndo({ design, color, background })
    setDesign(next.design)
    if (next.color) setColor(next.color)
    setBackground(next.background)
    setSelectedId(null)
    setSide(next.design.front.length === 0 && next.design.back.length > 0 ? 'back' : 'front')
    setError('')
    return next.message
  }

  const undoAI = () => {
    if (!aiUndo) return
    setDesign(aiUndo.design)
    setColor(aiUndo.color)
    setBackground(aiUndo.background)
    setSelectedId(null)
    setAiUndo(null)
  }

  // ---- Output ----
  const sideOptions = (s) => ({ type: product.type, colorHex: garmentHex, layers: design[s], allOver: true })

  const downloadMockup = async () => {
    setBusy(true)
    try {
      const url = await renderSideImage(sideOptions(side), 1200, { format: 'image/png', background: null })
      const a = document.createElement('a')
      a.href = url
      a.download = `inkwave-${product.id}-${side}.png`
      a.click()
    } catch {
      notify('Could not create the image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const addToCart = async () => {
    if (!hasDesign) {
      setError('Add some text or an image to your design first.')
      return
    }
    if (totalQty === 0) {
      setError('Enter a quantity for at least one size.')
      return
    }
    setError('')
    setBusy(true)
    try {
      // A background alone counts as a design and covers both sides, so preview both.
      const previewSides = background ? SIDES : printedSides
      const previews = {}
      for (const s of previewSides) previews[s] = await renderSideImage(sideOptions(s), 320)
      const designId = uid()
      const items = product.sizes
        .filter((size) => sizeQty[size] > 0)
        .map((size) => ({
          productId: product.id,
          name: `Custom ${product.name}${background ? ' (all-over)' : ''}`,
          color,
          size,
          qty: sizeQty[size],
          unitPrice,
          design: {
            id: designId,
            method: background ? 'allover' : 'standard',
            sides: printedSides,
            background,
            layers: printedSides.reduce((n, s) => n + design[s].length, 0),
          },
          preview: previews.front ?? previews.back,
          previews,
        }))
      add(items)
      setSizeQty({})
    } catch {
      notify('Something went wrong while saving your design.')
    } finally {
      setBusy(false)
    }
  }

  const garment = GARMENTS[product.type] ?? GARMENTS.tee

  return (
    <div className="container">
      <div className="page-head">
        <h1>Design Studio</h1>
        <p className="muted">Add text or upload artwork, drag it into place, check it in 3D and order in any mix of sizes.</p>
      </div>

      <div className="designer">
        {/* ---- Left: garment & tools ---- */}
        <div className="designer-left">
          <div className="panel">
            <h3>1 · Garment</h3>
            <div className="product-picker">
              {PRODUCTS.map((p) => (
                <button key={p.id} className={p.id === product.id ? 'active' : ''} onClick={() => changeProduct(p)}>
                  <ShirtMockup type={p.type} color={COLORS[p.id === product.id ? color : p.colors[0]].hex} label="" />
                  {p.name}
                </button>
              ))}
            </div>

            <div className="panel-group">
              <span className="option-label">
                Garment color: <span className="muted">{COLORS[color].name}</span>
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

            <div className="panel-group">
              <span className="option-label">
                Printed background <span className="muted">(optional)</span>
              </span>
              <InkPicker value={background} onChange={setBackground} allowNone />
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                Covers the whole garment edge to edge: +{money(ALL_OVER_PRICE)} instead of {money(PRINT_SIDE_PRICE)} per
                side.
              </p>
            </div>
          </div>

          <div className="panel">
            <h3>2 · Add to {side}</h3>
            <div className="tool-buttons">
              <button className="btn btn-dark" onClick={addText}>
                + Text
              </button>
              <button className="btn btn-outline" onClick={() => fileRef.current.click()}>
                ↑ Image
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
            <p className="muted small" style={{ margin: '12px 0 0' }}>
              Tip: transparent PNGs at 2000 px+ print best.
            </p>
          </div>
        </div>

        {/* ---- Center: stage ---- */}
        <div className="designer-center">
          <AIDesigner
            context={{ product, color, background, design }}
            onResult={applyAI}
            onUndo={undoAI}
            canUndo={!!aiUndo}
          />
          <div className="stage">
            <div className="stage-top">
              <div className="segmented" role="tablist" aria-label="Print side">
                {SIDES.map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={s === side}
                    className={s === side ? 'active' : ''}
                    onClick={() => changeSide(s)}
                  >
                    {s === 'front' ? 'Front' : 'Back'}
                    {design[s].length > 0 && <span className="dot" aria-label="has design" />}
                  </button>
                ))}
              </div>
              <div className="segmented" aria-label="View">
                <button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>
                  2D edit
                </button>
                <button
                  className={show3D ? 'active' : ''}
                  onClick={() => setView('3d')}
                  disabled={!has3D}
                  title={has3D ? undefined : '3D preview is available for t-shirts'}
                >
                  3D view
                </button>
              </div>
            </div>

            {!show3D ? (
              <>
                <svg
                  ref={svgRef}
                  className="stage-canvas"
                  viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
                  onPointerDown={() => setSelectedId(null)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  role="application"
                  aria-label={`${product.name}, ${side} side. Select a layer to move it with the arrow keys.`}
                >
                  <ShirtMockup type={product.type} color={garmentHex} label={`${product.name} ${side}`} />
                  <defs>
                    <clipPath id={clipId}>
                      <path d={garment.body} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {layers.map((l) => (
                      <LayerShape key={l.id} layer={l} selected={l.id === selectedId} onPointerDown={onLayerPointerDown} />
                    ))}
                  </g>
                </svg>
                <div className="stage-bottom">
                  <p className="stage-hint muted">
                    {layers.length === 0
                      ? `Add text or an image to the ${side} to get started.`
                      : 'Drag to move · Arrow keys to nudge · Delete to remove'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Suspense
                  fallback={
                    <div className="stage-3d-wrap">
                      <div className="stage-3d-status muted">Loading 3D…</div>
                    </div>
                  }
                >
                  <Shirt3D
                    color={COLORS[color].hex}
                    front={textures.front}
                    back={textures.back}
                    version={textureVersion}
                    side={side}
                    autoRotate={autoRotate}
                    getLayerAt={layerAtOnSide}
                    onSelect={selectFrom3D}
                    onMoveLayer={moveFrom3D}
                  />
                </Suspense>
                <div className="stage-bottom">
                  <p className="stage-hint muted">
                    Drag a design to move it · Drag the shirt to rotate · Scroll or pinch to zoom
                  </p>
                  <label className="small muted guide-toggle">
                    <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
                    Auto-rotate
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- Right: layer settings & order ---- */}
        <div className="designer-right">
          <div className="panel">
            <h3>Layers · {side}</h3>
            {layers.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                No layers yet.
              </p>
            ) : (
              <ul className="layer-list">
                {[...layers].reverse().map((l) => {
                  const i = layers.indexOf(l)
                  return (
                    <li key={l.id} className={l.id === selectedId ? 'active' : ''}>
                      <button className="layer-name" onClick={() => setSelectedId(l.id)}>
                        {l.kind === 'text' ? 'T ' : '▣ '}
                        {layerLabel(l)}
                      </button>
                      <button className="icon-btn" onClick={() => moveLayer(l.id, 1)} disabled={i === layers.length - 1} aria-label="Bring forward" title="Bring forward">
                        ↑
                      </button>
                      <button className="icon-btn" onClick={() => moveLayer(l.id, -1)} disabled={i === 0} aria-label="Send backward" title="Send backward">
                        ↓
                      </button>
                      <button className="icon-btn" onClick={() => duplicateLayer(l)} aria-label="Duplicate" title="Duplicate">
                        ⧉
                      </button>
                      <button className="icon-btn" onClick={() => removeLayer(l.id)} aria-label="Delete" title="Delete">
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {selected && (
              <div className="panel-group">
                {selected.kind === 'text' && (
                  <>
                    <label className="field">
                      Text
                      <input value={selected.text} maxLength={40} onChange={(e) => updateLayer(selected.id, { text: e.target.value })} />
                    </label>
                    <label className="field" style={{ marginTop: 12 }}>
                      Font
                      <select
                        className="font-select"
                        value={selected.font}
                        onChange={(e) => updateLayer(selected.id, { font: e.target.value })}
                        style={{ fontFamily: `'${selected.font}'` }}
                      >
                        {FONTS.map((f) => (
                          <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div style={{ marginTop: 12 }}>
                      <span className="option-label">Ink color</span>
                      <InkPicker value={selected.color} onChange={(c) => updateLayer(selected.id, { color: c })} />
                    </div>
                  </>
                )}
                <div style={{ marginTop: 16 }}>
                  <div className="range-row">
                    <span>Size</span>
                    <input
                      type="range"
                      min="0.3"
                      max="6"
                      step="0.05"
                      value={selected.scale}
                      onChange={(e) => updateLayer(selected.id, { scale: Number(e.target.value) })}
                    />
                    <output>{Math.round(selected.scale * 100)}%</output>
                  </div>
                  <div className="range-row">
                    <span>Rotate</span>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={selected.rotation}
                      onChange={(e) => updateLayer(selected.id, { rotation: Number(e.target.value) })}
                    />
                    <output>{selected.rotation}°</output>
                  </div>
                </div>
                <div className="chips" style={{ marginTop: 14 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => updateLayer(selected.id, { x: CENTER.x })}>
                    Center ↔
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => updateLayer(selected.id, { y: CENTER.y })}>
                    Center ↕
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => updateLayer(selected.id, { rotation: 0, scale: 1 })}>
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <h3>3 · Sizes & quantity</h3>
            <div className="size-grid">
              {product.sizes.map((size) => (
                <label key={size}>
                  {size}
                  <input
                    type="number"
                    min="0"
                    max="999"
                    inputMode="numeric"
                    value={sizeQty[size] || ''}
                    placeholder="0"
                    onChange={(e) => {
                      setSizeQty((q) => ({ ...q, [size]: clamp(Math.floor(Number(e.target.value) || 0), 0, 999) }))
                      setError('')
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="summary-rows" style={{ marginTop: 18 }}>
              <div>
                <span>{product.name}</span>
                <span>{money(product.price)}</span>
              </div>
              <div>
                <span>
                  {background ? 'All-over print' : `Printing (${printedSides.length ? printedSides.join(' + ') : 'none yet'})`}
                </span>
                <span>{money(printPrice)}</span>
              </div>
              <div className="total">
                <span>{totalQty > 0 ? `${totalQty} × ${money(unitPrice)}` : 'Price each'}</span>
                <span>{money(totalQty > 0 ? unitPrice * totalQty : unitPrice)}</span>
              </div>
              {totalQty >= 12 && <div className="saving">Bulk discount will be applied in the cart.</div>}
            </div>

            {error && (
              <p className="notice" role="alert" style={{ marginTop: 14 }}>
                {error}
              </p>
            )}

            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={addToCart} disabled={busy}>
              {busy ? 'Preparing…' : 'Add to cart'}
            </button>
            <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} onClick={downloadMockup} disabled={busy}>
              Download {side} mockup (PNG)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
