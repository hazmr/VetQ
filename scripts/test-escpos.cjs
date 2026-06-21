// Standalone Electron test of the ESC/POS raster print pipeline (mirrors printing.ts).
const { app, BrowserWindow } = require('electron')
const { join } = require('path')
const { tmpdir } = require('os')
const { writeFileSync, unlinkSync } = require('fs')
const { spawn } = require('child_process')

const PRINTER = 'RONGTA 80mm Series Printer'
const widthPx = 576

function html() {
  const k = widthPx / 576
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
  *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
  body{width:${widthPx}px;padding:${16 * k}px ${12 * k}px;font-family:"Cairo","Tahoma","Arial",sans-serif;color:#000;text-align:center;-webkit-font-smoothing:none}
  .header{font-size:${34 * k}px;font-weight:800;margin-bottom:${6 * k}px}
  .label{font-size:${28 * k}px;margin-top:${8 * k}px}
  .number{font-size:${170 * k}px;font-weight:900;line-height:1;margin:${6 * k}px 0}
  .type{font-size:${44 * k}px;font-weight:700;margin-top:${8 * k}px}
  .price{font-size:${32 * k}px;margin-top:${4 * k}px}
  .datetime{font-size:${24 * k}px;margin-top:${12 * k}px;border-top:2px dashed #000;padding-top:${8 * k}px}
  </style></head><body>
  <div class="header">عيادة الاختبار</div>
  <div class="label">رقم العميل</div>
  <div class="number">123</div>
  <div class="type">كشف</div>
  <div class="price">50 ج.م</div>
  <div class="datetime">${new Date().toLocaleString('ar-EG')}</div>
  </body></html>`
}

function toMono(img) {
  const { width, height } = img.getSize()
  const bmp = img.getBitmap()
  const bytesPerRow = Math.ceil(width / 8)
  const mono = Buffer.alloc(bytesPerRow * height, 0)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2], a = bmp[i + 3]
      const lum = a === 0 ? 255 : r * 0.299 + g * 0.587 + b * 0.114
      if (lum < 128) mono[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  return { mono, bytesPerRow, height }
}

function buildEscPos(mono, bytesPerRow, height) {
  const parts = [Buffer.from([0x1b, 0x40])]
  const BAND = 255
  for (let y = 0; y < height; y += BAND) {
    const rows = Math.min(BAND, height - y)
    parts.push(
      Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff]),
      mono.subarray(y * bytesPerRow, (y + rows) * bytesPerRow)
    )
  }
  parts.push(Buffer.from([0x0a, 0x0a, 0x0a, 0x0a]), Buffer.from([0x1d, 0x56, 0x42, 0x00]))
  return Buffer.concat(parts)
}

function sendRaw(printer, data) {
  return new Promise((resolve, reject) => {
    const bin = join(tmpdir(), `vetq-test-${Date.now()}.bin`)
    writeFileSync(bin, data)
    const script = `
$ErrorActionPreference='Stop'
$code = @'
using System;using System.Runtime.InteropServices;
public class VetQRaw {
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public class DI { [MarshalAs(UnmanagedType.LPWStr)] public string n; [MarshalAs(UnmanagedType.LPWStr)] public string o; [MarshalAs(UnmanagedType.LPWStr)] public string t; }
  [DllImport("winspool.Drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool OpenPrinter(string s,out IntPtr h,IntPtr p);
  [DllImport("winspool.Drv",SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern int StartDocPrinter(IntPtr h,int l,[In] DI d);
  [DllImport("winspool.Drv",SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",SetLastError=true)] public static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);
  public static void Send(string printer,byte[] bytes){ IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero)) throw new Exception("OpenPrinter "+Marshal.GetLastWin32Error()); var d=new DI(); d.n="VetQ Test"; d.t="RAW"; if(StartDocPrinter(h,1,d)==0){ClosePrinter(h);throw new Exception("StartDoc "+Marshal.GetLastWin32Error());} StartPagePrinter(h); int w; WritePrinter(h,bytes,bytes.Length,out w); EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);} }
'@
Add-Type -TypeDefinition $code -Language CSharp
$bytes=[System.IO.File]::ReadAllBytes('${bin}')
[VetQRaw]::Send('${PRINTER}',$bytes)
Write-Output 'SENT'
`
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true })
    let out = '', err = ''
    ps.stdout.on('data', (d) => (out += d))
    ps.stderr.on('data', (d) => (err += d))
    ps.on('close', (code) => {
      try { unlinkSync(bin) } catch {}
      code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `exit ${code}`))
    })
  })
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: widthPx, height: 1200, webPreferences: { offscreen: true } })
    await new Promise((res, rej) => {
      win.webContents.once('did-finish-load', res)
      win.webContents.on('did-fail-load', (_e, _c, d) => rej(new Error(d)))
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html()))
    })
    await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(()=>true) : true')
    const h = Math.ceil(await win.webContents.executeJavaScript('document.body.scrollHeight'))
    win.setContentSize(widthPx, h)
    await new Promise((r) => setTimeout(r, 150))
    let img = await win.webContents.capturePage({ x: 0, y: 0, width: widthPx, height: h })
    if (img.getSize().width !== widthPx) img = img.resize({ width: widthPx })
    console.log('captured size:', img.getSize())
    const { mono, bytesPerRow, height } = toMono(img)
    const result = await sendRaw(PRINTER, buildEscPos(mono, bytesPerRow, height))
    console.log('RESULT:', result)
  } catch (e) {
    console.error('TEST FAILED:', e)
  } finally {
    app.quit()
  }
})
