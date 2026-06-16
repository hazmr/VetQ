import ExcelJS from 'exceljs'
import { BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import type { DailyReport, MonthlyReport, RangeReport } from '../../shared/types'
import { dailyReport, monthlyReport, rangeReport } from './reports'
import { getAllSettings } from '../db/settings'

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------- Excel ----------

export async function exportDailyExcel(date: string, dest: string): Promise<void> {
  const r = dailyReport(date)
  const s = getAllSettings()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('تقرير يومي', { views: [{ rightToLeft: true }] })

  ws.addRow([s.clinic_name || 'VetQ'])
  ws.addRow([`تقرير يوم ${date}`])
  ws.addRow([])
  ws.addRow(['الرقم', 'الخدمة', 'السعر', 'المستخدم', 'الوقت'])
  for (const e of r.entries) {
    ws.addRow([e.seq_no, e.type_name_snapshot, e.price_snapshot, e.user_name, e.created_at])
  }
  ws.addRow([])
  ws.addRow(['ملخص حسب الخدمة'])
  ws.addRow(['الخدمة', 'العدد', 'الإيراد'])
  for (const t of r.perType) ws.addRow([t.name, t.count, t.revenue])
  ws.addRow([])
  ws.addRow(['الإجمالي', r.totalCount, `${r.totalRevenue} ${s.currency}`])
  await wb.xlsx.writeFile(dest)
}

export async function exportMonthlyExcel(month: string, dest: string): Promise<void> {
  const r = monthlyReport(month)
  const s = getAllSettings()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('تقرير شهري', { views: [{ rightToLeft: true }] })

  ws.addRow([s.clinic_name || 'VetQ'])
  ws.addRow([`تقرير شهر ${month}`])
  ws.addRow([])
  ws.addRow(['اليوم', 'عدد العملاء', 'الإيراد'])
  for (const d of r.perDay) ws.addRow([d.date, d.count, d.revenue])
  ws.addRow([])
  ws.addRow(['ملخص حسب الخدمة'])
  ws.addRow(['الخدمة', 'العدد', 'الإيراد'])
  for (const t of r.perType) ws.addRow([t.name, t.count, t.revenue])
  ws.addRow([])
  ws.addRow(['الإجمالي', r.totalCount, `${r.totalRevenue} ${s.currency}`])
  await wb.xlsx.writeFile(dest)
}

export async function exportRangeExcel(from: string, to: string, dest: string): Promise<void> {
  const r = rangeReport(from, to)
  const s = getAllSettings()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('تقرير', { views: [{ rightToLeft: true }] })

  ws.addRow([s.clinic_name || 'VetQ'])
  ws.addRow([`تقرير الفترة ${from} → ${to}`])
  ws.addRow([])
  ws.addRow(['اليوم', 'عدد العملاء', 'الإيراد'])
  for (const d of r.perDay) ws.addRow([d.date, d.count, d.revenue])
  ws.addRow([])
  ws.addRow(['حسب الخدمة'])
  ws.addRow(['الخدمة', 'العدد', 'الإيراد'])
  for (const t of r.perType) ws.addRow([t.name, t.count, t.revenue])
  ws.addRow([])
  ws.addRow(['حسب الموظف'])
  ws.addRow(['الموظف', 'العدد', 'الإيراد'])
  for (const u of r.perUser) ws.addRow([u.name, u.count, u.revenue])
  ws.addRow([])
  ws.addRow(['الإجمالي', r.totalCount, `${r.totalRevenue} ${s.currency}`])
  await wb.xlsx.writeFile(dest)
}

// ---------- PDF (via Chromium so Arabic/RTL render correctly) ----------

function reportTableHtml(title: string, sub: string): string {
  const s = getAllSettings()
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
  <style>
    body{font-family:"Cairo","Tahoma",sans-serif;padding:24px;color:#111}
    h1{font-size:22px;margin:0}
    h2{font-size:15px;color:#555;margin:4px 0 18px;font-weight:normal}
    h3{font-size:16px;margin:18px 0 6px}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:right;font-size:13px}
    th{background:#f0f0f0}
    .total{font-weight:700;font-size:15px;margin-top:10px}
  </style></head><body>
  <h1>${esc(s.clinic_name || 'VetQ')}</h1>
  <h2>${esc(title)} — ${esc(sub)}</h2>`
}

function dailyHtml(r: DailyReport): string {
  const s = getAllSettings()
  let h = reportTableHtml('تقرير يومي', r.date)
  h += '<h3>ملخص حسب الخدمة</h3><table><tr><th>الخدمة</th><th>العدد</th><th>الإيراد</th></tr>'
  for (const t of r.perType)
    h += `<tr><td>${esc(t.name)}</td><td>${t.count}</td><td>${t.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += '<h3>التفاصيل</h3><table><tr><th>الرقم</th><th>الخدمة</th><th>السعر</th><th>المستخدم</th><th>الوقت</th></tr>'
  for (const e of r.entries)
    h += `<tr><td>${e.seq_no}</td><td>${esc(e.type_name_snapshot)}</td><td>${e.price_snapshot}</td><td>${esc(e.user_name)}</td><td>${esc(e.created_at)}</td></tr>`
  h += '</table>'
  h += `<div class="total">إجمالي العملاء: ${r.totalCount} — إجمالي الإيراد: ${r.totalRevenue} ${esc(s.currency)}</div>`
  return h + '</body></html>'
}

function monthlyHtml(r: MonthlyReport): string {
  const s = getAllSettings()
  let h = reportTableHtml('تقرير شهري', r.month)
  h += '<h3>حسب اليوم</h3><table><tr><th>اليوم</th><th>عدد العملاء</th><th>الإيراد</th></tr>'
  for (const d of r.perDay)
    h += `<tr><td>${esc(d.date)}</td><td>${d.count}</td><td>${d.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += '<h3>حسب الخدمة</h3><table><tr><th>الخدمة</th><th>العدد</th><th>الإيراد</th></tr>'
  for (const t of r.perType)
    h += `<tr><td>${esc(t.name)}</td><td>${t.count}</td><td>${t.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += `<div class="total">إجمالي العملاء: ${r.totalCount} — إجمالي الإيراد: ${r.totalRevenue} ${esc(s.currency)}</div>`
  return h + '</body></html>'
}

function rangeHtml(r: RangeReport): string {
  const s = getAllSettings()
  let h = reportTableHtml('تقرير الفترة', `${r.from} → ${r.to}`)
  h += '<h3>حسب اليوم</h3><table><tr><th>اليوم</th><th>عدد العملاء</th><th>الإيراد</th></tr>'
  for (const d of r.perDay)
    h += `<tr><td>${esc(d.date)}</td><td>${d.count}</td><td>${d.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += '<h3>حسب الخدمة</h3><table><tr><th>الخدمة</th><th>العدد</th><th>الإيراد</th></tr>'
  for (const t of r.perType)
    h += `<tr><td>${esc(t.name)}</td><td>${t.count}</td><td>${t.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += '<h3>حسب الموظف</h3><table><tr><th>الموظف</th><th>العدد</th><th>الإيراد</th></tr>'
  for (const u of r.perUser)
    h += `<tr><td>${esc(u.name)}</td><td>${u.count}</td><td>${u.revenue} ${esc(s.currency)}</td></tr>`
  h += '</table>'
  h += `<div class="total">إجمالي العملاء: ${r.totalCount} — إجمالي الإيراد: ${r.totalRevenue} ${esc(s.currency)}</div>`
  return h + '</body></html>'
}

async function htmlToPdf(html: string, dest: string): Promise<void> {
  const win = new BrowserWindow({ show: false })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf = await win.webContents.printToPDF({ printBackground: true })
    await writeFile(dest, pdf)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export async function exportDailyPdf(date: string, dest: string): Promise<void> {
  await htmlToPdf(dailyHtml(dailyReport(date)), dest)
}

export async function exportMonthlyPdf(month: string, dest: string): Promise<void> {
  await htmlToPdf(monthlyHtml(monthlyReport(month)), dest)
}

export async function exportRangePdf(from: string, to: string, dest: string): Promise<void> {
  await htmlToPdf(rangeHtml(rangeReport(from, to)), dest)
}
