// Generates the Whitebloom sakura icon as SVG (deterministic: fixed seed).
// Usage: node scripts/generate-icon.mjs > build/icon.svg
// Rasterize with: npx electron scripts/rasterize-icon.cjs

function mulberry32(seed) {
  let s = seed
  return function random() {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildIconSvg() {
  const r = mulberry32(7)
  const blobs = [
    [120, 226, 54], [178, 186, 62], [256, 160, 72], [338, 176, 64], [404, 222, 52],
    [136, 276, 44], [206, 272, 58], [290, 262, 60], [370, 274, 48], [226, 218, 60],
    [318, 220, 58], [442, 262, 30], [92, 262, 34]
  ]
  const inside = (x, y) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 < br * br)
  const f = (n) => n.toFixed(1)

  const base = blobs
    .map(([x, y, rad]) => `<circle cx="${x}" cy="${y}" r="${f(rad * 0.86)}" fill="${y > 255 ? '#cf6aa5' : '#ea8fbb'}"/>`)
    .join('')

  const pickColor = (y) => {
    const t = (y - 100) / 220
    const u = r()
    if (u < 0.12 && y < 230) return '#fde6f0'
    if (t > 0.72) return u < 0.55 ? '#c25a9e' : u < 0.8 ? '#d46fa9' : '#e489b6'
    if (t > 0.45) return u < 0.3 ? '#d46fa9' : u < 0.65 ? '#e98cb9' : '#f3a9ca'
    return u < 0.35 ? '#f7bdd6' : u < 0.7 ? '#f19dc3' : '#e889b7'
  }

  const petals = []
  let n = 0
  let tries = 0
  while (n < 520 && tries < 20000) {
    tries++
    const x = 60 + r() * 400
    const y = 90 + r() * 240
    if (!inside(x, y)) continue
    const rx = 6 + r() * 6
    const ry = rx * (0.6 + r() * 0.25)
    const fill = pickColor(y)
    const rot = Math.round(r() * 180)
    petals.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`)
    n++
  }

  const fallCols = ['#e48ab3', '#f6b6d1', '#d9649c', '#f0a1c4', '#c95f9c']
  const falling = []
  for (let i = 0; i < 26; i++) {
    const right = r() < 0.82
    const x = right ? 410 + r() * 70 : 56 + r() * 60
    const y = right ? 140 + r() * 290 : 250 + r() * 150
    const rx = 4 + r() * 4
    const fill = fallCols[Math.floor(r() * fallCols.length)]
    const rot = Math.round(r() * 180 - 90)
    falling.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * 0.65)}" fill="${fill}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`)
  }

  const ground = []
  for (let j = 0; j < 40; j++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const gx = 238 + Math.cos(a) * d * 122
    const gy = 422 + Math.sin(a) * d * 16
    const rx = 4 + r() * 4
    const fill = fallCols[Math.floor(r() * fallCols.length)]
    const rot = Math.round(r() * 180)
    ground.push(`<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(rx)}" ry="${f(rx * 0.6)}" fill="${fill}" transform="rotate(${rot} ${f(gx)} ${f(gy)})"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect x="16" y="16" width="480" height="480" rx="108" fill="#fcf8fa" stroke="#efe2ea" stroke-width="4"/>
<ellipse cx="238" cy="422" rx="132" ry="20" fill="#f6d3e2"/>
<g>${ground.join('')}</g>
<path d="M204 424 C214 386 222 354 226 316 C230 284 222 258 204 234 L220 226 C238 250 246 274 248 296 C260 266 282 244 314 228 L322 242 C292 258 270 284 260 316 C252 348 248 388 254 424 Z" fill="#5b3426"/>
<g>${base}</g>
<g fill="none" stroke="#5e3346" stroke-linecap="round"><path d="M234 302 C214 274 186 260 150 256" stroke-width="7"/><path d="M276 264 C308 248 344 240 384 238" stroke-width="7"/><path d="M228 268 C222 236 214 210 196 186" stroke-width="5"/><path d="M262 250 C276 222 300 200 330 186" stroke-width="5"/><path d="M196 186 C186 172 172 164 154 160" stroke-width="3.5"/><path d="M330 186 C350 176 370 174 392 178" stroke-width="3.5"/><path d="M150 256 C134 248 118 246 100 248" stroke-width="4"/><path d="M384 238 C404 236 420 240 436 248" stroke-width="4"/></g>
<g>${petals.join('')}</g>
<g>${falling.join('')}</g>
</svg>
`
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-icon.mjs')) {
  process.stdout.write(buildIconSvg())
}
