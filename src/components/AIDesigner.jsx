import { useEffect, useRef, useState } from 'react'
import { buildUserMessage } from '../lib/aiDesign'

const EXAMPLES = [
  'Retro sunset with the text “Summer 2026”',
  'Birthday shirt for Luka, he turns 30 and loves video games',
  'Team shirt “Riverside FC”, big number 10 on the back',
]

// Chat panel that asks the AI for a design. `context` is the current product/color/design;
// `onResult` receives the AI's raw answer to apply it to the editor.
export default function AIDesigner({ context, onResult, onUndo, canUndo }) {
  const [history, setHistory] = useState([]) // API conversation, sent back unchanged every turn
  const [chat, setChat] = useState([]) // what the customer sees
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const logRef = useRef(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, busy])

  useEffect(() => {
    if (!busy) return
    setSeconds(0)
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  const send = async (text) => {
    const request = text.trim()
    if (!request || busy) return
    setInput('')
    setChat((c) => [...c, { from: 'you', text: request }])
    setBusy(true)
    // Append-only: earlier turns are never edited, only new ones added at the end.
    const messages = [...history, { role: 'user', content: buildUserMessage(request, context) }]
    try {
      const res = await fetch('/api/ai-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setHistory([...messages, data.assistant])
      const message = onResult(data.design)
      setChat((c) => [...c, { from: 'ai', text: message }])
    } catch (err) {
      // The failed request is simply not added to the history.
      setChat((c) => [...c, { from: 'error', text: err.message }])
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setHistory([])
    setChat([])
  }

  return (
    <div className="panel ai-panel">
      <div className="ai-head">
        <h3>✨ AI Designer</h3>
        {!busy && (
          <div className="ai-head-actions">
            {canUndo && (
              <button className="btn btn-ghost btn-sm" onClick={onUndo}>
                ↶ Undo AI change
              </button>
            )}
            {chat.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                New chat
              </button>
            )}
          </div>
        )}
      </div>

      {chat.length === 0 ? (
        <div className="ai-examples" aria-label="Example ideas">
          {EXAMPLES.map((e) => (
            <button key={e} className="ai-example" onClick={() => send(e)} disabled={busy}>
              {e}
            </button>
          ))}
        </div>
      ) : (
        <div className="ai-log" ref={logRef} aria-live="polite">
          {chat.map((m, i) => (
            <div key={i} className={`ai-msg ai-${m.from}`}>
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="ai-msg ai-ai ai-typing">
              Designing… {seconds}s <span className="muted">(usually 15–60 s)</span>
            </div>
          )}
        </div>
      )}

      <form
        className="ai-form"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          className="input"
          rows={1}
          value={input}
          maxLength={1000}
          placeholder={chat.length ? 'Ask for a change…' : 'Describe your idea, e.g. a mountain logo with “Wild & Free”'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          disabled={busy}
          aria-label="Describe your design"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? 'Designing…' : 'Generate'}
        </button>
      </form>
    </div>
  )
}
