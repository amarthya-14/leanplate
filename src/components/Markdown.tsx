import { Fragment, type ReactNode } from 'react'

function inline(s: string, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = key
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={i++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={i++} className="rounded bg-surface-2 px-1 text-[0.92em]">{t.slice(1, -1)}</code>)
    else out.push(<em key={i++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

/** Tiny, safe markdown renderer for chat replies (no HTML injection). */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = line.match(/^#{1,4}\s+(.*)/)
    if (h) {
      blocks.push(<h3 key={k++}>{inline(h[1])}</h3>)
      i++
      continue
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•])\s+/, ''))
      blocks.push(
        <ul key={k++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(
        <ol key={k++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ol>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4})\s+/.test(lines[i])) para.push(lines[i++])
    blocks.push(
      <p key={k++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, j * 100)}
          </Fragment>
        ))}
      </p>,
    )
  }
  return <div className="prose-chat">{blocks}</div>
}
