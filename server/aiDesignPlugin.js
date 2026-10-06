// Vite plugin that serves POST /api/ai-design from the dev server (`npm run dev`) and the preview
// server (`npm run preview`). When the site is deployed to real hosting, the same createDesign()
// function can be wrapped in that host's serverless function instead.
import { AIDesignError, createDesign } from './aiDesign.js'

const MAX_BODY_BYTES = 2_000_000
const LIMIT_PER_HOUR = 20 // AI designs per visitor (IP address) per hour

const recent = new Map() // ip -> timestamps of recent requests

function overLimit(ip) {
  const hourAgo = Date.now() - 3_600_000
  const times = (recent.get(ip) ?? []).filter((t) => t > hourAgo)
  if (times.length >= LIMIT_PER_HOUR) {
    recent.set(ip, times)
    return true
  }
  times.push(Date.now())
  recent.set(ip, times)
  return false
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new AIDesignError('Request too large.', 413))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new AIDesignError('Invalid request.'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function aiDesignApi(apiKey) {
  const handler = async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })
    try {
      if (overLimit(req.socket.remoteAddress ?? 'unknown')) {
        throw new AIDesignError(`You’ve reached the limit of ${LIMIT_PER_HOUR} AI designs per hour. Please try again later.`, 429)
      }
      const { messages } = await readJson(req)
      send(res, 200, await createDesign({ apiKey, messages }))
    } catch (err) {
      if (err instanceof AIDesignError) return send(res, err.status, { error: err.message })
      console.error('[ai-design]', err)
      send(res, 500, { error: 'Something went wrong. Please try again.' })
    }
  }
  return {
    name: 'inkwave-ai-design-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-design', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ai-design', handler)
    },
  }
}
