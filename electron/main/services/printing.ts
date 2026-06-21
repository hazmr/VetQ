import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import type { Entry, PrintResult, Settings } from '../../shared/types'
import { getAllSettings } from '../db/settings'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Virtual / non-physical printers we never want to auto-select for ticket printing. */
const VIRTUAL_PRINTER = /microsoft (print to pdf|xps)|print to pdf|onenote|fax|pdfcreator|cutepdf|adobe pdf/i

/** Receipt / thermal printer name hints, in priority order. XPrinter and Rongta are checked first. */
const PREFERRED_PRINTER = /xprinter|xp-?\d|rongta|rp-?\d|pos[-\s]?\d|thermal|receipt|58\s?mm|80\s?mm/i

type PrinterInfo = { name: string; displayName: string; isDefault: boolean }

async function getPrinters(): Promise<PrinterInfo[]> {
  const win = new BrowserWindow({ show: false })
  try {
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault
    }))
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Decides which printer to print to.
 * 1. An explicitly chosen printer (Settings) that still exists.
 * 2. Otherwise auto-pick the best *physical* printer, preferring XPrinter / thermal models.
 * Virtual printers ("Microsoft Print to PDF", Fax, ...) are never auto-selected.
 * Returns null when no usable physical printer is found.
 */
async function resolvePrinter(explicitName: string): Promise<string | null> {
  const printers = await getPrinters()
  if (explicitName) {
    const match = printers.find((p) => p.name === explicitName)
    if (match) return match.name
    // chosen printer is offline/removed → fall through to auto-detection
  }
  const physical = printers.filter((p) => !VIRTUAL_PRINTER.test(p.name) && !VIRTUAL_PRINTER.test(p.displayName))
  return (
    physical.find((p) => PREFERRED_PRINTER.test(p.name) || PREFERRED_PRINTER.test(p.displayName))?.name ??
    physical.find((p) => p.isDefault)?.name ??
    physical[0]?.name ??
    null
  )
}

function ticketsDir(): string {
  const dir = join(app.getPath('documents'), 'VetQ-Tickets')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Printable width in dots at 203 dpi: 80mm ≈ 576, 58mm ≈ 384. Always a multiple of 8. */
function widthDots(settings: Settings): number {
  const mm = parseFloat(settings.paper_size)
  if (!Number.isFinite(mm) || mm <= 0) return 576
  if (mm <= 60) return 384
  if (mm >= 76) return 576
  // custom width → dots at 203 dpi, rounded down to a multiple of 8
  return Math.max(8, Math.floor((mm / 25.4) * 203 / 8) * 8)
}

/**
 * Ticket markup rendered to a bitmap (so Arabic and the clinic name render correctly, which raw
 * ESC/POS text cannot do). Sizes are in CSS px relative to a 576-dot (80mm) baseline.
 */
function ticketHtml(entry: Entry, widthPx: number): string {
  const settings = getAllSettings()
  const isAr = settings.lang !== 'en'
  const k = widthPx / 576
  const dt = new Date(entry.created_at.replace(' ', 'T'))
  const dateStr = isNaN(dt.getTime()) ? entry.created_at : dt.toLocaleString(isAr ? 'ar-EG' : 'en-US')
  const clientLabel = isAr ? 'رقم العميل' : 'Client number'
  const header = settings.clinic_name ? `<div class="header">${esc(settings.clinic_name)}</div>` : ''
  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: ${widthPx}px; padding: ${Math.round(16 * k)}px ${Math.round(12 * k)}px;
    font-family: "Cairo", "Tahoma", "Arial", sans-serif;
    color: #000; text-align: center; -webkit-font-smoothing: none;
  }
  .header { font-size: ${Math.round(34 * k)}px; font-weight: 800; margin-bottom: ${Math.round(6 * k)}px; }
  .label { font-size: ${Math.round(28 * k)}px; margin-top: ${Math.round(8 * k)}px; }
  .number { font-size: ${Math.round(170 * k)}px; font-weight: 900; line-height: 1; margin: ${Math.round(6 * k)}px 0; }
  .type { font-size: ${Math.round(44 * k)}px; font-weight: 700; margin-top: ${Math.round(8 * k)}px; }
  .price { font-size: ${Math.round(32 * k)}px; margin-top: ${Math.round(4 * k)}px; }
  .datetime { font-size: ${Math.round(24 * k)}px; margin-top: ${Math.round(12 * k)}px; border-top: 2px dashed #000; padding-top: ${Math.round(8 * k)}px; }
</style>
</head>
<body>
  ${header}
  <div class="label">${clientLabel}</div>
  <div class="number">${entry.seq_no}</div>
  <div class="type">${esc(entry.type_name_snapshot)}</div>
  <div class="price">${entry.price_snapshot} ${esc(settings.currency)}</div>
  <div class="datetime">${esc(dateStr)}</div>
</body>
</html>`
}

/** Renders the ticket HTML offscreen and captures it as a NativeImage at exactly `widthPx` wide. */
async function renderTicketImage(html: string, widthPx: number): Promise<Electron.NativeImage> {
  const win = new BrowserWindow({
    show: false,
    width: widthPx,
    height: 1200,
    webPreferences: { offscreen: true }
  })
  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.once('did-finish-load', () => resolve())
      win.webContents.on('did-fail-load', (_e, _c, desc) => reject(new Error(desc)))
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    })
    // Wait for fonts + a paint so the capture isn't blank.
    await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true')
    const heightPx = Math.ceil(await win.webContents.executeJavaScript('document.body.scrollHeight'))
    win.setContentSize(widthPx, heightPx)
    await new Promise((r) => setTimeout(r, 150))
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: widthPx, height: heightPx })
    // Normalize to the exact dot width regardless of display scale factor.
    return img.getSize().width === widthPx ? img : img.resize({ width: widthPx })
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/** Converts a NativeImage to a 1-bpp packed bitmap (1 = black), padded to a multiple of 8 px wide. */
function toMono(img: Electron.NativeImage): { mono: Buffer; bytesPerRow: number; height: number } {
  const { width, height } = img.getSize()
  const bmp = img.getBitmap() // BGRA, top-to-bottom
  const bytesPerRow = Math.ceil(width / 8)
  const mono = Buffer.alloc(bytesPerRow * height, 0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2], a = bmp[i + 3]
      const lum = a === 0 ? 255 : r * 0.299 + g * 0.587 + b * 0.114
      if (lum < 128) mono[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return { mono, bytesPerRow, height }
}

/** Builds the full ESC/POS byte stream: init + raster image (banded) + feed + cut. */
function buildEscPos(mono: Buffer, bytesPerRow: number, height: number): Buffer {
  const parts: Buffer[] = [Buffer.from([0x1b, 0x40])] // ESC @  initialize
  const BAND = 255 // rows per GS v 0 command, keeps within safe limits
  for (let y = 0; y < height; y += BAND) {
    const rows = Math.min(BAND, height - y)
    const head = Buffer.from([
      0x1d, 0x76, 0x30, 0x00, // GS v 0, mode 0
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff
    ])
    parts.push(head, mono.subarray(y * bytesPerRow, (y + rows) * bytesPerRow))
  }
  parts.push(Buffer.from([0x0a, 0x0a, 0x0a, 0x0a])) // feed
  parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])) // GS V B 0  feed + full cut
  return Buffer.concat(parts)
}

/**
 * Sends raw bytes to a Windows printer in RAW datatype via the spooler (winspool WritePrinter),
 * driven by a short PowerShell helper. This bypasses the driver's page rendering entirely — the
 * only reliable way to talk ESC/POS to a thermal printer whose Windows driver emits TSPL.
 */
function sendRaw(printer: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = join(tmpdir(), `vetq-escpos-${Date.now()}.bin`)
    writeFileSync(bin, data)
    const safePrinter = printer.replace(/'/g, "''")
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
  public static void Send(string printer,byte[] bytes){ IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero)) throw new Exception("OpenPrinter "+Marshal.GetLastWin32Error()); var d=new DI(); d.n="VetQ Ticket"; d.t="RAW"; if(StartDocPrinter(h,1,d)==0){ClosePrinter(h);throw new Exception("StartDoc "+Marshal.GetLastWin32Error());} StartPagePrinter(h); int w; WritePrinter(h,bytes,bytes.Length,out w); EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);} }
'@
Add-Type -TypeDefinition $code -Language CSharp
$bytes=[System.IO.File]::ReadAllBytes('${bin}')
[VetQRaw]::Send('${safePrinter}',$bytes)
`
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true }
    )
    let err = ''
    ps.stderr.on('data', (d) => (err += d.toString()))
    ps.on('error', reject)
    ps.on('close', (code) => {
      try {
        unlinkSync(bin)
      } catch {
        /* best-effort cleanup */
      }
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `فشل الطباعة (رمز ${code})`))
    })
  })
}

/**
 * Prints the ticket. If a physical printer is available it renders the ticket to a bitmap and
 * sends it as raw ESC/POS raster (the reliable path for thermal receipt printers). If no printer
 * exists, it saves the ticket as a PDF and returns its path.
 */
export async function printTicket(entry: Entry): Promise<PrintResult> {
  const settings = getAllSettings()
  const printerName = await resolvePrinter(settings.printer_name)
  const dots = widthDots(settings)
  const img = await renderTicketImage(ticketHtml(entry, dots), dots)

  if (printerName) {
    const { mono, bytesPerRow, height } = toMono(img)
    await sendRaw(printerName, buildEscPos(mono, bytesPerRow, height))
    return { method: 'printer', printer: printerName }
  }

  // No physical printer → save a PNG-in-PDF-less fallback as a PDF for the user to print manually.
  const pngDir = ticketsDir()
  const file = `ticket-${entry.seq_no}-${entry.created_at.slice(0, 10)}-${Date.now()}.png`
  const path = join(pngDir, file)
  writeFileSync(path, img.toPNG())
  return { method: 'pdf', pdfPath: path }
}

export async function listPrinters(): Promise<{ name: string; displayName: string }[]> {
  const printers = await getPrinters()
  return printers.map((p) => ({ name: p.name, displayName: p.displayName }))
}
