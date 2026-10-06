// Server-side half of the AI Designer. Runs in Node (inside the Vite dev/preview server, see
// aiDesignPlugin.js), never in the browser, so the Anthropic API key stays secret.
import Anthropic from '@anthropic-ai/sdk'
import { COLORS, FONTS } from '../src/data/products.js'

export const MODEL = 'claude-opus-5-5'
const MAX_MESSAGES = 40 // 20 back-and-forth turns, then the customer starts a new chat
const MAX_USER_TEXT = 20000 // characters per user message (request + current design state)

// ---- What Claude must answer with: a complete design for both sides of the garment ----
const LAYER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'ref', 'text', 'font', 'color', 'svg', 'x', 'y', 'size', 'rotation'],
  properties: {
    kind: {
      type: 'string',
      enum: ['text', 'svg', 'existing'],
      description: '"text" = a line of text, "svg" = new vector artwork, "existing" = keep a layer from the current design.',
    },
    ref: { type: 'string', description: 'kind "existing": id of the layer to keep. Otherwise "".' },
    text: { type: 'string', description: 'kind "text": the text (one line). Otherwise "".' },
    font: { type: 'string', enum: FONTS, description: 'kind "text": the font. Otherwise any value.' },
    color: { type: 'string', description: 'kind "text": ink color as #rrggbb. Otherwise "".' },
    svg: {
      type: 'string',
      description: 'kind "svg": one complete, self-contained <svg> element with a viewBox. Otherwise "".',
    },
    x: { type: 'number', description: 'Center x on the 400 x 440 garment canvas.' },
    y: { type: 'number', description: 'Center y on the 400 x 440 garment canvas.' },
    size: { type: 'number', description: 'Text: font size in canvas units. Artwork / existing image: width in canvas units.' },
    rotation: { type: 'number', description: 'Degrees, clockwise. 0 = upright.' },
  },
}

const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'garmentColor', 'background', 'front', 'back'],
  properties: {
    message: { type: 'string', description: 'Short, friendly reply to the customer about what you made.' },
    garmentColor: {
      anyOf: [{ type: 'string', enum: Object.keys(COLORS) }, { type: 'null' }],
      description: 'Suggested fabric color (must be one the product offers), or null to keep the current one.',
    },
    background: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'A #rrggbb color printed over the whole garment (all-over print), or null for none.',
    },
    front: { type: 'array', items: LAYER_SCHEMA },
    back: { type: 'array', items: LAYER_SCHEMA },
  },
}

// Kept byte-identical between requests so it can be cached.
const SYSTEM_PROMPT = `You are the AI designer inside InkWave's online t-shirt Design Studio. Customers describe what they want and you design it directly onto their garment. Your design appears as editable layers they can move, resize, recolor or delete afterwards, in a 2D editor and on a rotating 3D shirt.

## The canvas
Each side (front, back) is a 400 x 440 canvas, origin at the top-left, x to the right, y down. x/y of a layer is its CENTER. The back is drawn as seen from behind. Anything outside the garment's outline is cut off when printed.

Garment shapes (approximate):
- tee: collar top around (200, 30); body x 80-320, y 50-420; short sleeves x 10-80 (left) and x 320-390 (right), y 50-160.
- longsleeve: like tee, but sleeves run down and outward to about y 310 (left sleeve cuff near x 30, right near x 370).
- hoodie: hood and neck down to about y 95; body x 80-320 down to y 420; kangaroo pocket on the FRONT at x 108-292, y 340-404 (avoid placing artwork there); sleeves like longsleeve.
- tank: no sleeves; straps at the top; body x 80-320, y 40-420.

Good placements:
- Main front/back print: centered at x 200, roughly y 120-330, up to about 240 wide.
- Small left-chest logo: around (255, 135), 40-70 wide (the wearer's left is the viewer's right).
- Upper back (under the collar): around (200, 95), small text.
- Sleeve prints (tee): around (45, 105) and (355, 105), small, often rotated to follow the sleeve.
- Large or all-over designs may cover the whole garment, including sleeves.

## Layers
- "text": one line of text. size = font size; 40 is a medium headline, 55-80 a big statement, 14-24 small print. Rough width ≈ number of characters × size × 0.5 (Bebas Neue / Oswald are narrow, ~0.4; Pacifico / Permanent Marker are wide, ~0.6). Keep text inside the garment. Fonts: ${FONTS.join(', ')}.
- "svg": new vector artwork. size = displayed width. Write ONE self-contained <svg> with a viewBox (e.g. viewBox="0 0 200 200") and no width/height requirements. Use only basic shapes and paths (path, circle, rect, ellipse, polygon, line, g, linearGradient, radialGradient). No <text> (use text layers instead), no images, no external links, no fonts, no scripts, no CSS animations. Keep it bold and printable: clear silhouettes, solid fills, a limited palette (2-6 colors), no hairline details. Keep each SVG under about 6,000 characters.
- "existing": keep a layer from the current design by its id (ref). Use it to keep or move uploaded images and artwork; you may change x, y, size and rotation. For "existing", put "" in text/color/svg and any font.
Layers are listed bottom to top: later layers are drawn on top.

## Colors
Fabric colors in the shop: ${Object.entries(COLORS)
  .map(([key, c]) => `${key} (${c.name}, ${c.hex})`)
  .join(', ')}. Only suggest a garmentColor that the product offers; null keeps the current one.
Make ink colors contrast with the fabric (light ink on dark fabric and vice versa). "background" prints one color over the whole garment and costs extra - use it only if the customer wants an all-over or fully colored look.

## How to work
- Every customer message includes the current product and the current design as JSON. The customer may have edited it by hand since your last answer - always start from that current state.
- Return the COMPLETE design for both sides every time. Layers you leave out are removed. When asked for a change, keep everything else as it is (use "existing" for images; repeat text layers unchanged).
- Make sensible creative decisions instead of asking questions. If something isn't possible (for example a photograph), say so briefly and create the best vector or typographic version.
- message: 1-3 short sentences in the customer's language describing what you made, optionally with one idea for a tweak.
- Don't reproduce copyrighted characters, sports team crests or brand logos; offer an original design in a similar spirit instead.`

// Errors whose message is safe and useful to show to the customer.
export class AIDesignError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new AIDesignError('Empty request.')
  if (messages.length > MAX_MESSAGES) {
    throw new AIDesignError('This chat is getting long - please start a new chat to keep designing.')
  }
  messages.forEach((m, i) => {
    const expected = i % 2 === 0 ? 'user' : 'assistant'
    if (!m || m.role !== expected) throw new AIDesignError('Invalid conversation.')
    if (expected === 'user' && (typeof m.content !== 'string' || m.content.length > MAX_USER_TEXT)) {
      throw new AIDesignError('Your message is too long.')
    }
    if (expected === 'assistant' && !Array.isArray(m.content)) throw new AIDesignError('Invalid conversation.')
  })
  if (messages.length % 2 === 0) throw new AIDesignError('Invalid conversation.')
}

// After a mid-answer safety fallback, model-internal blocks before the last `fallback` marker must not be
// sent back in the next request; everything else is echoed unchanged.
function historyContent(content) {
  const lastFallback = content.findLastIndex((b) => b.type === 'fallback')
  if (lastFallback < 0) return content
  const internal = new Set(['thinking', 'redacted_thinking', 'tool_use'])
  return content.filter((b, i) => i >= lastFallback || !internal.has(b.type))
}

let client
let clientKey

export async function createDesign({ apiKey, messages }) {
  if (!apiKey) {
    throw new AIDesignError(
      'The AI Designer is not set up yet: add ANTHROPIC_API_KEY to the .env.local file and restart the dev server.',
      503,
    )
  }
  validateMessages(messages)
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey })
    clientKey = apiKey
  }

  let response
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety check declines the request, the API retries it on a suitable fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: DESIGN_SCHEMA } },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM_PROMPT,
      messages,
    })
  } catch (err) {
    console.error('[ai-design] API error:', err)
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AIDesignError('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.', 502)
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      throw new AIDesignError('This API key is not allowed to use the model. Check your Claude Console settings.', 502)
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AIDesignError('The AI is busy right now. Please try again in a minute.', 429)
    }
    if (err instanceof Anthropic.BadRequestError && /credit/i.test(err.message)) {
      throw new AIDesignError('The API account has no credit left. Add credit in the Claude Console.', 502)
    }
    if (err instanceof Anthropic.APIError) {
      throw new AIDesignError('The AI service had a problem. Please try again.', 502)
    }
    throw new AIDesignError('Could not reach the AI service. Check your internet connection.', 502)
  }

  if (response.stop_reason === 'refusal') {
    throw new AIDesignError('Sorry, I can’t help with that design. Try describing something different.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AIDesignError('That design got too complex. Try asking for something a bit simpler.')
  }
  const text = response.content.findLast((b) => b.type === 'text')?.text
  let design
  try {
    design = JSON.parse(text)
  } catch {
    console.error('[ai-design] Unparseable response:', response.content)
    throw new AIDesignError('The AI returned something unexpected. Please try again.', 502)
  }

  const u = response.usage
  console.log(
    `[ai-design] ${response.model}: ${u.input_tokens} in (+${u.cache_read_input_tokens ?? 0} cached), ${u.output_tokens} out`,
  )
  return {
    design,
    assistant: { role: 'assistant', content: historyContent(response.content) },
  }
}
