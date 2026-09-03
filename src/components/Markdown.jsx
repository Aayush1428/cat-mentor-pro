import React, { useMemo } from 'react'

// Tiny dependency-free Markdown renderer tuned for the AI Tutor's answers.
// Supports: GFM pipe tables, #/##/### headings, --- rules, ordered/unordered lists,
// blockquotes, fenced/inline code, bold, italic, links, and <br> inside table cells.
// It builds React elements (never dangerouslySetInnerHTML), so it is XSS-safe.

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(\[[^\]]+\]\([^)]+\))/

function renderTokens(text, kp) {
  const out = []
  let rest = String(text)
  let k = 0
  while (rest.length) {
    const m = rest.match(INLINE_RE)
    if (!m) { out.push(rest); break }
    const idx = m.index
    if (idx > 0) out.push(rest.slice(0, idx))
    const tok = m[0]
    const key = `${kp}-t${k++}`
    if (tok.startsWith('`')) {
      out.push(<code key={key} className="px-1 py-0.5 rounded bg-bg-secondary border border-border text-[0.85em] font-mono text-cat-blue">{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(<strong key={key} className="font-semibold text-text-primary">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    } else {
      const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      out.push(<a key={key} href={mm[2]} target="_blank" rel="noreferrer" className="text-cat-blue underline hover:opacity-80">{mm[1]}</a>)
    }
    rest = rest.slice(idx + tok.length)
  }
  return out
}

// Inline formatting + <br> handling (mainly for table cells).
function renderInline(text, kp) {
  const segments = String(text).split(/<br\s*\/?>/i)
  if (segments.length === 1) return renderTokens(text, kp)
  const out = []
  segments.forEach((seg, i) => {
    out.push(<React.Fragment key={`${kp}-s${i}`}>{renderTokens(seg, `${kp}-s${i}`)}</React.Fragment>)
    if (i < segments.length - 1) out.push(<br key={`${kp}-br${i}`} />)
  })
  return out
}

const splitRow = (line) => {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}
const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
const isTableRow = (line) => line.includes('|')

export default function Markdown({ text, className = '' }) {
  const blocks = useMemo(() => {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
    const nodes = []
    let i = 0
    let key = 0
    const K = () => `md-${key++}`

    while (i < lines.length) {
      const line = lines[i]

      // Blank line
      if (!line.trim()) { i++; continue }

      // Fenced code block
      if (/^\s*```/.test(line)) {
        const body = []
        i++
        while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++ }
        i++ // closing fence
        nodes.push(
          <pre key={K()} className="my-2 p-3 rounded-lg bg-bg-secondary border border-border overflow-x-auto text-xs font-mono text-text-secondary whitespace-pre">{body.join('\n')}</pre>
        )
        continue
      }

      // Horizontal rule
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { nodes.push(<hr key={K()} className="my-3 border-border" />); i++; continue }

      // Heading
      const h = line.match(/^\s*(#{1,6})\s+(.*)$/)
      if (h) {
        const level = h[1].length
        const sizes = { 1: 'text-lg', 2: 'text-base', 3: 'text-sm', 4: 'text-sm', 5: 'text-xs', 6: 'text-xs' }
        nodes.push(
          <p key={K()} className={`mt-3 mb-1.5 font-display font-bold text-text-primary ${sizes[level] || 'text-sm'}`}>{renderInline(h[2], K())}</p>
        )
        i++
        continue
      }

      // GFM table
      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const header = splitRow(line)
        i += 2 // header + separator
        const rows = []
        while (i < lines.length && isTableRow(lines[i]) && lines[i].trim()) { rows.push(splitRow(lines[i])); i++ }
        nodes.push(
          <div key={K()} className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>{header.map((c, ci) => (
                  <th key={ci} className="border border-border bg-bg-secondary px-2.5 py-1.5 text-left font-semibold text-text-primary align-top">{renderInline(c, `${K()}-h${ci}`)}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>{header.map((_, ci) => (
                    <td key={ci} className="border border-border px-2.5 py-1.5 text-text-secondary align-top">{renderInline(r[ci] || '', `${K()}-r${ri}c${ci}`)}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        const body = []
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i++ }
        nodes.push(
          <blockquote key={K()} className="my-2 pl-3 border-l-2 border-cat-blue/50 text-text-secondary italic">{renderInline(body.join(' '), K())}</blockquote>
        )
        continue
      }

      // Unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = []
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++ }
        nodes.push(
          <ul key={K()} className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-text-muted">
            {items.map((it, ii) => <li key={ii} className="pl-1">{renderInline(it, `${K()}-li${ii}`)}</li>)}
          </ul>
        )
        continue
      }

      // Ordered list
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items = []
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
        nodes.push(
          <ol key={K()} className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-text-muted">
            {items.map((it, ii) => <li key={ii} className="pl-1">{renderInline(it, `${K()}-oli${ii}`)}</li>)}
          </ol>
        )
        continue
      }

      // Paragraph (gather consecutive plain lines)
      const para = [line]
      i++
      while (i < lines.length && lines[i].trim() &&
             !/^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```)/.test(lines[i]) &&
             !/^\s*([-*_])\1{2,}\s*$/.test(lines[i]) &&
             !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        para.push(lines[i]); i++
      }
      nodes.push(<p key={K()} className="my-1 leading-relaxed">{renderInline(para.join('\n').replace(/\n/g, ' '), K())}</p>)
    }
    return nodes
  }, [text])

  return <div className={className}>{blocks}</div>
}
