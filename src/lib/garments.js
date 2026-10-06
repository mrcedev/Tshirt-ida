// Garment outlines drawn in a 400 x 440 viewBox. All mockups share the same print area.
export const VIEWBOX = { w: 400, h: 440 }
export const PRINT_AREA = { x: 120, y: 100, w: 160, h: 230 }

export const GARMENTS = {
  tee: {
    body: 'M140 22 Q200 62 260 22 L338 48 Q370 90 396 128 L338 168 L320 146 L322 420 Q200 430 78 420 L80 146 L62 168 L4 128 Q30 90 62 48 Z',
    details: ['M146 26 Q200 72 254 26', 'M80 146 Q76 100 62 52', 'M320 146 Q324 100 338 52'],
  },
  longsleeve: {
    body: 'M140 22 Q200 62 260 22 L338 48 Q362 120 394 300 L350 312 Q330 220 320 160 L322 420 Q200 430 78 420 L80 160 Q70 220 50 312 L6 300 Q38 120 62 48 Z',
    details: ['M146 26 Q200 72 254 26', 'M80 160 Q76 100 62 52', 'M320 160 Q324 100 338 52', 'M354 296 L392 286', 'M46 296 L8 286'],
  },
  hoodie: {
    body: 'M150 40 Q200 -4 250 40 L338 62 Q362 130 394 300 L350 312 Q330 220 320 170 L322 420 Q200 430 78 420 L80 170 Q70 220 50 312 L6 300 Q38 130 62 62 Z',
    details: [
      'M160 44 Q200 96 240 44',
      'M188 78 L184 132',
      'M212 78 L216 132',
      'M128 340 L272 340 L292 404 L108 404 Z',
      'M354 296 L392 286',
      'M46 296 L8 286',
      'M84 404 Q200 412 316 404',
    ],
  },
  tank: {
    body: 'M150 22 Q200 92 250 22 L286 24 Q292 120 322 150 L322 420 Q200 430 78 420 L78 150 Q108 120 114 24 Z',
    details: ['M156 24 Q200 84 244 24'],
  },
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

export const isDark = (hex) => {
  const [r, g, b] = hexToRgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

// Mix a color toward black (amount < 0) or white (amount > 0).
export const shade = (hex, amount) => {
  const target = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round((target - c) * p + c))
  return `rgb(${r},${g},${b})`
}

export const outlineColor = (hex) => shade(hex, isDark(hex) ? 0.22 : -0.22)

// Standalone SVG markup, used to draw the garment onto a canvas when exporting designs.
export function garmentSvgString(type, color) {
  const g = GARMENTS[type] ?? GARMENTS.tee
  const stroke = outlineColor(color)
  const details = g.details
    .map((d) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" width="${VIEWBOX.w * 2}" height="${VIEWBOX.h * 2}">
<defs><linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset=".3" stop-color="#fff" stop-opacity=".08"/><stop offset=".7" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient></defs>
<path d="${g.body}" fill="${color}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>${details}
<path d="${g.body}" fill="url(#sh)"/></svg>`
}
