// Renders the NSIS installer artwork (sidebar 164x314, header 150x57) as 24-bit BMPs,
// in Whitebloom's look: soft off-white/pink surfaces, the sakura tree, DM Sans.
// Usage: npx electron scripts/render-installer-art.cjs   (after build/icon.svg exists)
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
// The tree without the rounded tile behind it.
const treeSvg = readFileSync(join(root, 'build', 'icon.svg'), 'utf-8').replace(/<rect [^>]*\/>\s*/, '')
// Embedded as a data URL: a data: page can't load fonts from file:// URLs.
const fontUrl =
  'data:font/ttf;base64,' +
  readFileSync(join(root, 'src', 'renderer', 'src', 'assets', 'fonts', 'DMSans-VariableFont_opsz,wght.ttf')).toString('base64')

function encodeBmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const imageSize = rowSize * height
  const buf = Buffer.alloc(54 + imageSize)
  buf.write('BM', 0, 'ascii')
  buf.writeUInt32LE(54 + imageSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(imageSize, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4
    let dst = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const i = src + x * 4
      buf[dst] = rgba[i + 2]
      buf[dst + 1] = rgba[i + 1]
      buf[dst + 2] = rgba[i]
      dst += 3
    }
  }
  return buf
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,<html><body></body></html>')
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const font = new FontFace('DM Sans', 'url(' + ${JSON.stringify(fontUrl)} + ')', { weight: '100 1000' });
      await font.load(); document.fonts.add(font);
      const tree = new Image();
      tree.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(treeSvg)});
      await tree.decode();

      function petal(ctx, x, y, r, rot, color) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }

      // ── Sidebar 164x314 (welcome / finish pages) ──
      const sw = 164, sh = 314;
      const s = document.createElement('canvas'); s.width = sw; s.height = sh;
      const c = s.getContext('2d');
      const bg = c.createLinearGradient(0, 0, 0, sh);
      bg.addColorStop(0, '#fdfafc'); bg.addColorStop(0.62, '#fbf1f6'); bg.addColorStop(1, '#f6e1ec');
      c.fillStyle = bg; c.fillRect(0, 0, sw, sh);
      c.drawImage(tree, -6, 28, 176, 176);
      const petals = [[22,236,4,0.4,'#f0a1c4'],[140,226,3.5,-0.6,'#e48ab3'],[150,262,3,0.9,'#f6b6d1'],[16,280,3,-0.3,'#d9649c'],[132,296,3.5,0.2,'#f0a1c4'],[40,300,2.5,1.1,'#e48ab3']];
      petals.forEach(p => petal(c, p[0], p[1], p[2], p[3], p[4]));
      c.textAlign = 'center';
      c.fillStyle = '#2b2b2b'; c.font = '650 22px "DM Sans"';
      c.fillText('Whitebloom', sw / 2, 238);
      c.fillStyle = '#929292'; c.font = '400 10.5px "DM Sans"';
      c.fillText('A whiteboard that blooms.', sw / 2, 256);
      c.fillStyle = '#d46fa9'; c.font = '600 9px "DM Sans"';
      c.letterSpacing = '1.5px';
      c.fillText('EXTENDED', sw / 2, 290);
      c.letterSpacing = '0px';

      // ── Header 150x57 (inner pages, top-right on white) ──
      const hw = 150, hh = 57;
      const h = document.createElement('canvas'); h.width = hw; h.height = hh;
      const hc = h.getContext('2d');
      hc.fillStyle = '#ffffff'; hc.fillRect(0, 0, hw, hh);
      hc.drawImage(tree, hw - 58, 1, 56, 56);
      hc.textAlign = 'right';
      hc.fillStyle = '#2b2b2b'; hc.font = '650 15px "DM Sans"';
      hc.fillText('Whitebloom', hw - 58, 30);
      hc.fillStyle = '#d46fa9'; hc.font = '600 7.5px "DM Sans"';
      hc.letterSpacing = '1px';
      hc.fillText('EXTENDED', hw - 59, 42);

      // ── README banner: the header composition re-drawn at 8x (vector, crisp) ──
      const BS = 8;
      const bn = document.createElement('canvas'); bn.width = hw * BS; bn.height = hh * BS;
      const bc = bn.getContext('2d');
      bc.scale(BS, BS);
      bc.fillStyle = '#ffffff'; bc.fillRect(0, 0, hw, hh);
      bc.drawImage(tree, hw - 58, 1, 56, 56);
      bc.textAlign = 'right';
      bc.fillStyle = '#2b2b2b'; bc.font = '650 15px "DM Sans"';
      bc.fillText('Whitebloom', hw - 58, 30);
      bc.fillStyle = '#d46fa9'; bc.font = '600 7.5px "DM Sans"';
      bc.letterSpacing = '1px';
      bc.fillText('EXTENDED', hw - 59, 42);
      const bannerPng = bn.toDataURL('image/png');

      const toArr = (cv) => Array.from(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data);
      return { sidebar: toArr(s), header: toArr(h), sidebarPng: s.toDataURL('image/png'), headerPng: h.toDataURL('image/png'), bannerPng };
    })()
  `)

  writeFileSync(join(root, 'build', 'installerSidebar.bmp'), encodeBmp(164, 314, Buffer.from(result.sidebar)))
  writeFileSync(join(root, 'build', 'installerHeader.bmp'), encodeBmp(150, 57, Buffer.from(result.header)))
  // PNG previews (not used by the build; handy for review).
  writeFileSync(join(root, 'build', 'icons', 'installerSidebar-preview.png'), Buffer.from(result.sidebarPng.split(',')[1], 'base64'))
  writeFileSync(join(root, 'build', 'icons', 'installerHeader-preview.png'), Buffer.from(result.headerPng.split(',')[1], 'base64'))
  writeFileSync(join(root, 'repo_assets', 'banner.png'), Buffer.from(result.bannerPng.split(',')[1], 'base64'))
  console.log('installer art written')
  app.quit()
})
