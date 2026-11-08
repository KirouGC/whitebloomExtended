// Rasterizes build/icon.svg into PNG/ICO/ICNS using Electron's renderer.
// Usage: npx electron scripts/rasterize-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf-8')
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

/** ICO with PNG-compressed entries (supported since Windows Vista). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = 6 + dir.length
  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

/** ICNS with PNG entries. */
function buildIcns(pngBySize) {
  const types = [
    ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256],
    ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
  ]
  const chunks = types.map(([type, size]) => {
    const png = pngBySize[size]
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,<html><body></body></html>')
  const dataUrls = await win.webContents.executeJavaScript(`
    (async () => {
      const svg = ${JSON.stringify(svg)};
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const out = {};
      for (const size of ${JSON.stringify(SIZES)}) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        out[size] = c.toDataURL('image/png');
      }
      return out;
    })()
  `)
  const png = {}
  for (const size of SIZES) png[size] = Buffer.from(dataUrls[size].split(',')[1], 'base64')

  mkdirSync(join(root, 'build', 'icons'), { recursive: true })
  for (const size of SIZES) writeFileSync(join(root, 'build', 'icons', `${size}x${size}.png`), png[size])
  writeFileSync(join(root, 'build', 'icon.png'), png[1024])
  writeFileSync(join(root, 'resources', 'icon.png'), png[512])
  writeFileSync(join(root, 'src', 'renderer', 'src', 'assets', 'favicon.png'), png[64])
  writeFileSync(
    join(root, 'build', 'icon.ico'),
    buildIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: png[size] })))
  )
  writeFileSync(join(root, 'build', 'icon.icns'), buildIcns(png))
  console.log('icons written')
  app.quit()
})
