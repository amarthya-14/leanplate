import { useEffect, useRef, useState } from 'react'

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

// Raymarched glossy ring (the Leanplate mark) over domain-warped silk light.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPulse;

#define PI 3.14159265
#define TAU 6.2831853

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot(0.5) * p * 2.03; a *= 0.5; }
  return v;
}

vec3 silk(vec2 uv, float t){
  vec2 q = vec2(fbm(uv * 1.1 + vec2(0.0, t * 0.04)), fbm(uv * 1.1 + vec2(5.2, 1.3) - t * 0.035));
  vec2 r = vec2(fbm(uv * 1.3 + 2.2 * q + vec2(1.7, 9.2) + t * 0.05), fbm(uv * 1.3 + 2.2 * q + vec2(8.3, 2.8) - t * 0.045));
  float f = fbm(uv * 1.0 + 2.6 * r);
  vec3 base = vec3(0.022, 0.045, 0.034);
  vec3 deep = vec3(0.075, 0.16, 0.115);
  vec3 sage = vec3(0.40, 0.62, 0.49);
  vec3 gold = vec3(0.86, 0.66, 0.34);
  vec3 col = mix(base, deep, smoothstep(0.25, 0.85, f));
  col += sage * 0.10 * smoothstep(0.5, 1.0, length(q));
  col += gold * pow(smoothstep(0.58, 1.0, f), 3.0) * 0.55;
  col += gold * 0.05 * smoothstep(0.7, 1.0, r.x);
  return col;
}

const float R = 1.0;
const float r = 0.105;

vec3 toObj(vec3 p){
  float t = uTime;
  p.yz = rot(-(0.66 + uMouse.y * 0.20 + sin(t * 0.31) * 0.05)) * p.yz;
  p.xy = rot(-(uMouse.x * 0.26 - 0.22 + sin(t * 0.17) * 0.04)) * p.xy;
  p.xz = rot(-(t * 0.18 + uPulse * 0.55)) * p.xz;
  return p;
}

// distance to an arc of the ring with rounded (capsule) ends
float sdArc(vec3 p, float a0, float a1){
  float mid = (a0 + a1) * 0.5;
  float hw = (a1 - a0) * 0.5;
  vec2 pr = rot(mid) * p.xz;
  float th = atan(pr.y, pr.x);
  float tc = clamp(th, -hw, hw);
  vec2 c = R * vec2(cos(tc), sin(tc));
  return length(vec3(pr.x - c.x, p.y * 1.12, pr.y - c.y)) - r;
}

// returns distance, material id in y
vec2 map(vec3 pw){
  vec3 p = toObj(pw);
  float g = 0.2; // gap in radians
  float d1 = sdArc(p, 0.0 + g, PI - g);
  float d2 = sdArc(p, PI + g, PI * 1.5 - g);
  float d3 = sdArc(p, PI * 1.5 + g, TAU - g);
  vec2 res = vec2(d1, 1.0);
  if (d2 < res.x) res = vec2(d2, 2.0);
  if (d3 < res.x) res = vec2(d3, 3.0);
  // fine inner rim line, like the edge of a plate
  float d4 = length(vec2(length(p.xz) - 0.74, p.y)) - 0.0045;
  if (d4 < res.x) res = vec2(d4, 4.0);
  return res;
}

vec3 normal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;
  // keep the ring a little above centre so captions breathe
  vec2 suv = uv;
  uv.y -= 0.075;

  vec3 bg = silk(suv * 1.15 + uMouse * 0.05, t);

  vec3 ro = vec3(0.0, 0.0, 5.3);
  vec3 rd = normalize(vec3(uv, -1.65));
  float dist = 0.0;
  float minD = 1e3;
  vec2 hit = vec2(-1.0);
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * dist;
    vec2 m = map(p);
    minD = min(minD, m.x);
    if (m.x < 0.0008) { hit = vec2(dist, m.y); break; }
    dist += m.x * 0.9;
    if (dist > 7.0) break;
  }

  vec3 col = bg;
  // bloom halo hugging the ring
  float glow = exp(-minD * 7.0);
  col += mix(vec3(0.55, 0.78, 0.62), vec3(0.95, 0.75, 0.42), 0.5 + 0.5 * sin(t * 0.4)) * glow * 0.11;

  if (hit.x > 0.0) {
    vec3 p = ro + rd * hit.x;
    vec3 n = normal(p);
    vec3 v = -rd;
    if (hit.y > 3.5) {
      col = mix(col, vec3(0.95, 0.9, 0.8), 0.55);
    } else {
      bool metal = hit.y > 1.5 && hit.y < 2.5;
      vec3 alb = hit.y < 1.5 ? vec3(0.30, 0.56, 0.43) : (metal ? vec3(0.92, 0.66, 0.30) : vec3(0.93, 0.90, 0.83));
      vec3 L1 = normalize(vec3(0.55, 0.85, 0.65));
      vec3 L2 = normalize(vec3(-0.7, -0.2, 0.4));
      float dif = clamp(dot(n, L1), 0.0, 1.0);
      float wrap = clamp(dot(n, L1) * 0.5 + 0.5, 0.0, 1.0);
      float back = clamp(dot(n, L2), 0.0, 1.0);
      vec3 h = normalize(L1 + v);
      float spec = pow(clamp(dot(n, h), 0.0, 1.0), metal ? 60.0 : 140.0);
      float spec2 = pow(clamp(dot(n, normalize(L2 + v)), 0.0, 1.0), 30.0);
      float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.2);
      vec3 refl = reflect(rd, n);
      vec3 env = silk(refl.xy * 0.9 + vec2(0.0, refl.z * 0.4), t) * 2.4 + vec3(0.95, 0.78, 0.48) * pow(clamp(refl.y * 0.5 + 0.5, 0.0, 1.0), 6.0) * 0.6;
      col = alb * (0.10 + 0.62 * wrap * wrap + 0.22 * dif);
      col += alb * back * vec3(0.25, 0.4, 0.35) * 0.3;
      if (metal) {
        // polished gold: reflect a warm studio softbox, not the green room
        float sky = smoothstep(-0.35, 0.9, refl.y);
        vec3 studio = mix(vec3(0.10, 0.06, 0.02), vec3(1.15, 0.92, 0.58), sky);
        studio += vec3(1.2, 1.0, 0.75) * smoothstep(0.86, 0.99, dot(refl, normalize(vec3(0.5, 0.8, 0.4)))) * 1.4;
        col = alb * studio * (0.75 + fres * 0.4) + alb * env * 0.35;
        col += vec3(1.0, 0.9, 0.7) * spec * 1.5;
      } else {
        // glazed ceramic: clear coat reflections on a tinted base
        col = mix(col, env, 0.12 + fres * 0.6);
        col += vec3(1.0, 0.97, 0.92) * spec * 1.5;
      }
      col += vec3(0.6, 0.85, 0.7) * spec2 * 0.2;
      col += alb * fres * 0.18;
    }
  }

  // drifting gold dust
  vec2 g = suv * 26.0 + vec2(t * 0.15, -t * 0.25);
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(cell);
  vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  float star = smoothstep(0.06, 0.0, length(f - o * 0.7)) * step(0.86, h);
  col += vec3(0.95, 0.8, 0.55) * star * (0.35 + 0.65 * sin(t * 2.0 + h * 40.0) * 0.5 + 0.2);

  // vignette, tone map, grain
  float vig = smoothstep(1.35, 0.25, length(suv * vec2(0.9, 1.05)));
  col *= mix(0.55, 1.0, vig);
  col = 1.0 - exp(-col * 1.35);
  col = pow(col, vec3(0.92));
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`

/** Full-bleed WebGL hero. Falls back to a static gradient + SVG ring without WebGL. */
export function PlateOrb({ className, pulse = 0 }: { className?: string; pulse?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef(pulse)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    pulseRef.current = pulse
  }, [pulse])

  useEffect(() => {
    const canvas = ref.current!
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
    if (!gl) {
      setFailed(true)
      return
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    let prog: WebGLProgram
    try {
      prog = gl.createProgram()!
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    } catch (e) {
      console.warn('[PlateOrb]', e)
      setFailed(true)
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uMouse = gl.getUniformLocation(prog, 'uMouse')
    const uPulse = gl.getUniformLocation(prog, 'uPulse')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let scale = Math.min(1.5, window.devicePixelRatio || 1) * (window.innerWidth < 700 ? 0.8 : 0.9)
    const target = { x: 0, y: 0 }
    const mouse = { x: 0, y: 0 }
    let pulseV = 0
    let raf = 0
    let start = performance.now()
    let frames = 0
    let acc = 0
    let last = start

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(2, Math.floor(r.width * scale))
      canvas.height = Math.max(2, Math.floor(r.height * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1
      target.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
    }
    window.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const frame = (now: number) => {
      const dt = now - last
      last = now
      // adaptive resolution: drop if we're under ~40 fps
      acc += dt
      frames++
      if (frames === 40) {
        const avg = acc / frames
        if (avg > 24 && scale > 0.45) {
          scale *= 0.8
          resize()
        }
        frames = 0
        acc = 0
      }
      mouse.x += (target.x - mouse.x) * 0.05
      mouse.y += (target.y - mouse.y) * 0.05
      pulseV += (pulseRef.current - pulseV) * 0.03
      const t = reduce ? 8 : (now - start) / 1000
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.uniform1f(uPulse, pulseV)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      start = 0
    }
  }, [])

  if (failed)
    return (
      <div className={className} style={{ background: 'radial-gradient(80% 60% at 70% 20%, rgb(214 173 98 / 0.25), transparent 60%), linear-gradient(165deg, #1b3426, #0b140f)' }}>
        <svg viewBox="0 0 100 100" className="mx-auto h-full max-h-[60%] w-auto pt-[12%] opacity-90">
          <g fill="none" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 50 50)">
            <circle cx="50" cy="50" r="30" stroke="#6fa384" pathLength="100" strokeDasharray="46 54" strokeDashoffset="-2" />
            <circle cx="50" cy="50" r="30" stroke="#d6a350" pathLength="100" strokeDasharray="21 79" strokeDashoffset="-52" />
            <circle cx="50" cy="50" r="30" stroke="#ece6d6" pathLength="100" strokeDasharray="21 79" strokeDashoffset="-77" />
          </g>
        </svg>
      </div>
    )
  return <canvas ref={ref} className={className} />
}
