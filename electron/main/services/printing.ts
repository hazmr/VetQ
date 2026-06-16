import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import type { Entry, PrintResult } from '../../shared/types'
import { getAllSettings } from '../db/settings'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Virtual / non-physical printers we never want to auto-select for ticket printing. */
const VIRTUAL_PRINTER = /microsoft (print to pdf|xps)|print to pdf|onenote|fax|pdfcreator|cutepdf|adobe pdf/i

/** Receipt / thermal printer name hints, in priority order. XPrinter is checked first. */
const PREFERRED_PRINTER = /xprinter|xp-?\d|pos[-\s]?\d|thermal|receipt|58\s?mm|80\s?mm/i

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
 * Virtual printers ("Microsoft Print to PDF", Fax, ...) are never auto-selected, so a
 * physical printer prints directly instead of popping a "Save as PDF" dialog.
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

function ticketHtml(entry: Entry): string {
  const settings = getAllSettings()
  const isAr = settings.lang !== 'en'
  const dt = new Date(entry.created_at.replace(' ', 'T'))
  const dateStr = isNaN(dt.getTime())
    ? entry.created_at
    : dt.toLocaleString(isAr ? 'ar-EG' : 'en-US')
  const clientLabel = isAr ? 'رقم العميل' : 'Client number'
  const header = settings.clinic_name
    ? `<div class="header">${esc(settings.clinic_name)}</div>`
    : ''
  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 80mm; margin: 0; padding: 4mm 3mm;
    font-family: "Cairo", "Tahoma", "Arial", sans-serif;
    color: #000; text-align: center;
  }
  .header { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .label { font-size: 13px; color: #000; margin-top: 6px; }
  .number { font-size: 78px; font-weight: 900; line-height: 1; margin: 4px 0; }
  .type { font-size: 22px; font-weight: 700; margin-top: 6px; }
  .price { font-size: 16px; margin-top: 2px; }
  .datetime { font-size: 12px; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px; }
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

/** Loads the ticket into an offscreen window; caller decides whether to print or save. */
function renderTicket(html: string): Promise<{ win: BrowserWindow; destroy: () => void }> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
    const destroy = (): void => {
      if (!win.isDestroyed()) win.destroy()
    }
    win.webContents.once('did-finish-load', () => resolve({ win, destroy }))
    win.webContents.on('did-fail-load', (_e, _c, desc) => {
      destroy()
      reject(new Error(desc))
    })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  })
}

/**
 * Prints the ticket. If a physical printer is available it prints silently and directly.
 * If no printer exists, it saves the ticket as a PDF (no dialog) and returns its path.
 */
export async function printTicket(entry: Entry): Promise<PrintResult> {
  const settings = getAllSettings()
  const printerName = await resolvePrinter(settings.printer_name)
  const html = ticketHtml(entry)
  const { win, destroy } = await renderTicket(html)

  if (printerName) {
    return new Promise<PrintResult>((resolve, reject) => {
      win.webContents.print(
        { silent: true, printBackground: true, deviceName: printerName },
        (success, failureReason) => {
          destroy()
          if (!success) reject(new Error(failureReason || 'فشل الطباعة'))
          else resolve({ method: 'printer', printer: printerName })
        }
      )
    })
  }

  // No physical printer → save a PDF automatically instead of prompting a dialog.
  try {
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: 80000, height: 200000 } // 80mm × 200mm, in microns
    })
    const file = `ticket-${entry.seq_no}-${entry.created_at.slice(0, 10)}-${Date.now()}.pdf`
    const path = join(ticketsDir(), file)
    writeFileSync(path, pdf)
    return { method: 'pdf', pdfPath: path }
  } finally {
    destroy()
  }
}

export async function listPrinters(): Promise<{ name: string; displayName: string }[]> {
  const printers = await getPrinters()
  return printers.map((p) => ({ name: p.name, displayName: p.displayName }))
}
