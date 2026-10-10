import { useEffect, useRef } from 'react'

export interface Scene {
  kind: 'plate' | 'text' | 'galaxy'
  text?: string
}

interface P {
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  c: number // color index
  s: number // size
  seed: number
}

const COLORS = ['#f4ecd8', '#e2b462', '#a9d6b6', '#7f9c8a']

/**
 * A field of particles that morphs between scenes (the plate mark, words, a galaxy).
 * Pure canvas 2D — no WebGL — and it scatters around the pointer.
 */
export function ParticleField({ scenes, index, className }: { scenes: Scene[]; index: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef<{ ps: P[]; w: number; h: number; mouse: { x: number; y: number; on: boolean }; targets: Map<number, { x: number; y: number; c: number }[]> }>({
    ps: [],
    w: 0,
    h: 0,
    mouse: { x: -9999, y: -9999, on: false },
    targets: new Map(),
  })
  const indexRef = useRef(index)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const st = state.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let dpr = 1

    const count = () => Math.round(Math.min(2600, Math.max(1100, (st.w * st.h) / 260)))
    const cyFor = () => st.h * (st.h < 520 ? 0.38 : 0.45)

    function sampleText(text: string, n: number) {
      const off = document.createElement('canvas')
      const W = Math.floor(st.w)
      const H = Math.floor(st.h)
      off.width = W
      off.height = H
      const o = off.getContext('2d')!
      let size = Math.min(W / (text.length * 0.5), H * 0.34)
      o.font = `400 ${size}px "Instrument Serif", Georgia, serif`
      const width = o.measureText(text).width
      if (width > W * 0.84) {
        size *= (W * 0.84) / width
        o.font = `400 ${size}px "Instrument Serif", Georgia, serif`
      }
      o.fillStyle = '#fff'
      o.textAlign = 'center'
      o.textBaseline = 'middle'
      o.fillText(text, W / 2, cyFor())
      const data = o.getImageData(0, 0, W, H).data
      const pts: { x: number; y: number; c: number }[] = []
      const step = Math.max(2, Math.floor(Math.sqrt((W * H * 0.06) / n)))
      for (let y = 0; y < H; y += step)
        for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y, c: Math.random() < 0.18 ? 1 : 0 })
      return pts
    }

    function samplePlate(n: number) {
      const cx = st.w / 2
      const cy = cyFor()
      const R = Math.min(st.w, st.h) * (st.h < 520 ? 0.25 : 0.28)
      const pts: { x: number; y: number; c: number }[] = []
      const segs = [
        { a: 0, b: 0.5, c: 2 },
        { a: 0.5, b: 0.75, c: 1 },
        { a: 0.75, b: 1, c: 0 },
      ]
      const ring = Math.floor(n * 0.72)
      for (let i = 0; i < ring; i++) {
        const seg = segs[i % 3 === 0 ? 0 : i % 3 === 1 ? (Math.random() < 0.5 ? 1 : 0) : Math.random() < 0.5 ? 2 : 0]
        const t = seg.a + 0.012 + Math.random() * (seg.b - seg.a - 0.024)
        const ang = t * Math.PI * 2 - Math.PI / 2
        const r = R + (Math.random() - 0.5) * R * 0.11
        pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, c: seg.c })
      }
      for (let i = ring; i < n; i++) {
        const ang = Math.random() * Math.PI * 2
        const r = R * (Math.random() < 0.5 ? 0.72 : 1.32) + (Math.random() - 0.5) * 3
        pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, c: 3 })
      }
      return pts
    }

    function sampleGalaxy(n: number) {
      const cx = st.w / 2
      const cy = cyFor()
      const R = Math.min(st.w, st.h) * 0.44
      const pts: { x: number; y: number; c: number }[] = []
      for (let i = 0; i < n; i++) {
        const arm = i % 3
        const t = Math.pow(Math.random(), 0.7)
        const ang = t * 5.2 + (arm * Math.PI * 2) / 3
        const r = t * R
        pts.push({ x: cx + Math.cos(ang) * r + (Math.random() - 0.5) * 22 * t, y: cy + Math.sin(ang) * r * 0.62 + (Math.random() - 0.5) * 16 * t, c: arm === 0 ? 1 : arm === 1 ? 2 : 0 })
      }
      return pts
    }

    function targetsFor(i: number) {
      const cached = st.targets.get(i)
      if (cached) return cached
      const sc = scenes[i]
      const n = st.ps.length
      let pts = sc.kind === 'plate' ? samplePlate(n) : sc.kind === 'galaxy' ? sampleGalaxy(n) : sampleText(sc.text ?? '', n)
      if (!pts.length) pts = sampleGalaxy(n)
      // shuffle so particles travel interesting paths
      for (let k = pts.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[pts[k], pts[j]] = [pts[j], pts[k]]
      }
      st.targets.set(i, pts)
      return pts
    }

    function assign(i: number) {
      const pts = targetsFor(i)
      st.ps.forEach((p, k) => {
        const t = pts[k % pts.length]
        p.tx = t.x + (k >= pts.length ? (Math.random() - 0.5) * 6 : 0)
        p.ty = t.y + (k >= pts.length ? (Math.random() - 0.5) * 6 : 0)
        p.c = t.c
      })
    }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      st.w = rect.width
      st.h = rect.height
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      st.targets.clear()
      const n = count()
      if (st.ps.length !== n) {
        st.ps = Array.from({ length: n }, () => ({
          x: st.w / 2 + (Math.random() - 0.5) * st.w * 1.4,
          y: st.h / 2 + (Math.random() - 0.5) * st.h * 1.4,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          c: 0,
          s: Math.random() < 0.1 ? 2.4 : Math.random() * 1.2 + 0.9,
          seed: Math.random() * 1000,
        }))
      }
      assign(indexRef.current)
    }

    let last = indexRef.current
    let time = 0
    function frame() {
      time += 0.016
      if (indexRef.current !== last) {
        last = indexRef.current
        assign(last)
        // a little burst so the morph feels alive
        for (const p of st.ps) {
          p.vx += (Math.random() - 0.5) * 6
          p.vy += (Math.random() - 0.5) * 6
        }
      }
      ctx.clearRect(0, 0, st.w, st.h)
      const m = st.mouse
      const groups: P[][] = COLORS.map(() => [])
      for (const p of st.ps) {
        const ax = (p.tx - p.x) * 0.018
        const ay = (p.ty - p.y) * 0.018
        p.vx = (p.vx + ax) * 0.86
        p.vy = (p.vy + ay) * 0.86
        // gentle breathing drift
        p.vx += Math.sin(time * 0.9 + p.seed) * 0.03
        p.vy += Math.cos(time * 0.8 + p.seed * 1.3) * 0.03
        if (m.on) {
          const dx = p.x - m.x
          const dy = p.y - m.y
          const d2 = dx * dx + dy * dy
          if (d2 < 110 * 110) {
            const f = (1 - Math.sqrt(d2) / 110) * 2.4
            const d = Math.sqrt(d2) || 1
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
        }
        p.x += p.vx
        p.y += p.vy
        groups[p.c].push(p)
      }
      ctx.globalCompositeOperation = 'lighter'
      groups.forEach((g, ci) => {
        ctx.fillStyle = COLORS[ci]
        // soft halo pass for the bigger sparks
        ctx.globalAlpha = 0.07
        for (const p of g) if (p.s > 2) ctx.fillRect(p.x - 3, p.y - 3, p.s + 6, p.s + 6)
        for (const p of g) {
          const speed = Math.min(1, Math.abs(p.vx) + Math.abs(p.vy))
          const twinkle = 0.75 + Math.sin(time * 2 + p.seed) * 0.15
          ctx.globalAlpha = Math.min(1, twinkle + speed * 0.3)
          ctx.fillRect(p.x, p.y, p.s, p.s)
        }
      })
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      st.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: true }
    }
    const onLeave = () => (st.mouse.on = false)

    const start = () => {
      resize()
      if (reduce) {
        for (const p of st.ps) {
          p.x = p.tx
          p.y = p.ty
        }
      }
      frame()
    }
    // wait for the serif so text scenes sample the right glyphs
    ;(document.fonts?.load('400 64px "Instrument Serif"') ?? Promise.resolve()).finally(start)

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onMove)
    canvas.addEventListener('pointerup', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onMove)
      canvas.removeEventListener('pointerup', onLeave)
    }
    // scenes are static for the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  return <canvas ref={canvasRef} className={className} style={{ touchAction: 'pan-y' }} />
}
