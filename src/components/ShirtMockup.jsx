import { useId } from 'react'
import { GARMENTS, VIEWBOX, outlineColor } from '../lib/garments'

export default function ShirtMockup({ type = 'tee', color = '#f8f8f6', className, label, children }) {
  const g = GARMENTS[type] ?? GARMENTS.tee
  const stroke = outlineColor(color)
  const gid = 'sh' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} className={className} role="img" aria-label={label ?? `${type} mockup`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".12" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".7" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#000" stopOpacity=".14" />
        </linearGradient>
      </defs>
      <path d={g.body} fill={color} stroke={stroke} strokeWidth="2" strokeLinejoin="round" style={{ transition: 'fill .35s' }} />
      {g.details.map((d) => (
        <path key={d} d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity=".6" />
      ))}
      <path d={g.body} fill={`url(#${gid})`} />
      {children}
    </svg>
  )
}
