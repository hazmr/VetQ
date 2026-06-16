import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, call } from './api'

export type Lang = 'ar' | 'en'

type Dict = Record<string, string>

const ar: Dict = {
  // brand / nav
  'nav.counter': 'العدّاد',
  'nav.reports': 'التقارير',
  'nav.settings': 'الإعدادات',
  'nav.users': 'المستخدمون',
  'nav.backups': 'النسخ الاحتياطي',
  // common
  'common.admin': 'مدير',
  'common.user': 'مستخدم',
  'common.logout': 'تسجيل الخروج',
  'common.save': 'حفظ',
  'common.saved': 'تم الحفظ',
  'common.error': 'خطأ',
  'common.add': '+ إضافة',
  'common.enable': 'تفعيل',
  'common.disable': 'تعطيل',
  'common.enabled': 'مفعّل',
  'common.disabled': 'معطّل',
  'common.status': 'الحالة',
  'common.name': 'الاسم',
  'common.username': 'اسم المستخدم',
  'common.password': 'كلمة المرور',
  'common.price': 'السعر',
  'common.color': 'اللون',
  'common.role': 'الدور',
  'common.service': 'الخدمة',
  'common.count': 'العدد',
  'common.revenue': 'الإيراد',
  'common.time': 'الوقت',
  'common.canceled': 'أُلغي',
  // theme + language
  'theme.darkMode': '🌙 الوضع الليلي',
  'theme.lightMode': '☀️ الوضع النهاري',
  'theme.light': 'فاتح',
  'theme.dark': 'داكن',
  'lang.toggle': 'English',
  'lang.label': 'اللغة',
  // setup
  'setup.welcome': 'مرحبًا! أنشئ حساب المدير لبدء استخدام النظام',
  'setup.confirmPassword': 'تأكيد كلمة المرور',
  'setup.create': 'إنشاء حساب المدير',
  'setup.mismatch': 'كلمتا المرور غير متطابقتين',
  // login
  'login.subtitle': 'تسجيل الدخول',
  'login.submit': 'دخول',
  // counter
  'counter.newDay': '🔄 بدء يوم جديد',
  'counter.confirmNewDay': 'بدء يوم جديد؟',
  'counter.noServicesAdmin': 'لا توجد خدمات بعد. أضف خدمات من صفحة الإعدادات.',
  'counter.noServicesUser': 'لا توجد خدمات بعد. اطلب من المدير إضافة الخدمات.',
  'counter.todayClients': 'عملاء اليوم',
  'counter.clientsBadge': '{n} عميل',
  'counter.total': 'الإجمالي: {amount} {currency}',
  'counter.noClients': 'لا يوجد عملاء بعد اليوم.',
  'counter.clientNumber': 'رقم العميل',
  'counter.printFailed': 'فشل الطباعة',
  'counter.printFailedReason': '⚠️ تعذّرت الطباعة: {reason}',
  'counter.savedPdf': '💾 لا توجد طابعة — تم الحفظ كملف PDF: {file}',
  // reports
  'reports.daily': 'يومي',
  'reports.monthly': 'شهري',
  'reports.date': 'التاريخ',
  'reports.month': 'الشهر',
  'reports.exportExcel': 'تصدير Excel',
  'reports.exportPdf': 'تصدير PDF',
  'reports.exported': 'تم التصدير',
  'reports.clientsCount': 'عدد العملاء',
  'reports.totalRevenue': 'إجمالي الإيراد',
  'reports.sessionsCount': 'عدد الورديات',
  'reports.byService': 'حسب الخدمة',
  'reports.details': 'التفاصيل',
  'reports.number': 'الرقم',
  'reports.byDay': 'حسب اليوم',
  'reports.day': 'اليوم',
  'reports.range': 'مخصص',
  'reports.from': 'من',
  'reports.to': 'إلى',
  'reports.revenueOverTime': 'الإيراد عبر الأيام',
  'reports.busiestHours': 'أكثر الساعات ازدحامًا',
  'reports.byEmployee': 'حسب الموظف',
  'reports.employee': 'الموظف',
  'reports.avgPerClient': 'متوسط لكل عميل',
  'reports.vsPrev': 'مقارنة بالفترة السابقة ({from} → {to})',
  'reports.noData': 'لا توجد بيانات في هذه الفترة.',
  'reports.topServices': 'أعلى الخدمات',
  'reports.quickThisMonth': 'هذا الشهر',
  'reports.quickLast30': 'آخر 30 يوم',
  'reports.quickThisYear': 'هذه السنة',
  // settings
  'settings.servicesHeading': 'الخدمات (الأزرار)',
  'settings.newServiceName': 'اسم خدمة جديدة',
  'settings.newServicePlaceholder': 'مثال: كشف',
  'settings.generalHeading': 'إعدادات عامة',
  'settings.clinicName': 'اسم العيادة (يظهر على الإيصال)',
  'settings.currency': 'العملة',
  'settings.printingHeading': 'الطباعة',
  'settings.printer': 'الطابعة',
  'settings.defaultPrinter': 'تلقائي (يفضّل XPrinter / طابعة حرارية)',
  'settings.autoPrint': 'طباعة تلقائية عند الضغط',
  'settings.appearanceHeading': 'المظهر واللغة',
  // users
  'users.displayName': 'الاسم المعروض',
  'users.addUser': 'إضافة مستخدم',
  'users.resetPassword': 'تغيير كلمة المرور',
  'users.newPasswordPrompt': 'كلمة مرور جديدة لـ {name}:',
  'users.passwordChanged': 'تم تغيير كلمة المرور',
  // backups
  'backups.backupNow': '💾 نسخة احتياطية الآن',
  'backups.restoreFromFile': '♻️ استعادة من ملف',
  'backups.autoDailyHeading': 'النسخ التلقائي اليومي',
  'backups.enableAuto': 'تفعيل النسخ التلقائي عند بدء التشغيل كل يوم',
  'backups.retentionCount': 'عدد النسخ المحفوظة',
  'backups.folder': 'مجلد النسخ',
  'backups.defaultFolder': '(الافتراضي)',
  'backups.changeFolder': 'تغيير المجلد',
  'backups.existing': 'النسخ الموجودة',
  'backups.file': 'الملف',
  'backups.size': 'الحجم',
  'backups.created': 'تم إنشاء نسخة احتياطية',
  'backups.restoredAlert': 'تمت الاستعادة. سيتم تسجيل الخروج.',
  'backups.folderUpdated': 'تم تحديث مجلد النسخ',
  'backups.noBackups': 'لا توجد نسخ بعد.',
  'backups.restore': 'استعادة',
  'backups.infoHeading': 'محتوى النسخة الاحتياطية',
  'backups.included': '✅ كل بياناتك في ملف واحد: المستخدمون، الخدمات، الورديات، كل العملاء والإيرادات، والإعدادات.',
  'backups.notIncluded': 'ℹ️ غير قابل للنقل بين الأجهزة: اختيار الطابعة (يُكتشف تلقائيًا على الجهاز الجديد) ومسار مجلد النسخ (يعود للافتراضي).',
  'backups.statUsers': 'المستخدمون',
  'backups.statServices': 'الخدمات',
  'backups.statSessions': 'الورديات',
  'backups.statClients': 'العملاء (سجلات)',
  'backups.dbSize': 'حجم قاعدة البيانات',
  'backups.integrity': 'سلامة البيانات',
  'backups.integrityOk': 'سليمة ✓',
  'backups.dataRange': 'الفترة',
  'backups.migrateHeading': 'النقل إلى جهاز آخر',
  'backups.migrateSteps': '١) اضغط «نسخة احتياطية الآن» واحفظ الملف على فلاشة أو سحابة. ٢) ثبّت VetQ على الجهاز الجديد. ٣) من هذه الشاشة اضغط «استعادة من ملف» واختر نفس الملف. الملف يحتوي كل البيانات.',
  'backups.openFolder': '📂 فتح مجلد النسخ'
}

const en: Dict = {
  'nav.counter': 'Counter',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.users': 'Users',
  'nav.backups': 'Backups',
  'common.admin': 'Admin',
  'common.user': 'User',
  'common.logout': 'Log out',
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.error': 'Error',
  'common.add': '+ Add',
  'common.enable': 'Enable',
  'common.disable': 'Disable',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.username': 'Username',
  'common.password': 'Password',
  'common.price': 'Price',
  'common.color': 'Color',
  'common.role': 'Role',
  'common.service': 'Service',
  'common.count': 'Count',
  'common.revenue': 'Revenue',
  'common.time': 'Time',
  'common.canceled': 'Canceled',
  'theme.darkMode': '🌙 Dark mode',
  'theme.lightMode': '☀️ Light mode',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'lang.toggle': 'العربية',
  'lang.label': 'Language',
  'setup.welcome': 'Welcome! Create the admin account to start using the system',
  'setup.confirmPassword': 'Confirm password',
  'setup.create': 'Create admin account',
  'setup.mismatch': 'Passwords do not match',
  'login.subtitle': 'Sign in',
  'login.submit': 'Sign in',
  'counter.newDay': '🔄 Start new day',
  'counter.confirmNewDay': 'Start a new day?',
  'counter.noServicesAdmin': 'No services yet. Add services from the Settings page.',
  'counter.noServicesUser': 'No services yet. Ask the admin to add services.',
  'counter.todayClients': "Today's clients",
  'counter.clientsBadge': '{n} clients',
  'counter.total': 'Total: {amount} {currency}',
  'counter.noClients': 'No clients yet today.',
  'counter.clientNumber': 'Client number',
  'counter.printFailed': 'Printing failed',
  'counter.printFailedReason': '⚠️ Printing failed: {reason}',
  'counter.savedPdf': '💾 No printer — saved as PDF: {file}',
  'reports.daily': 'Daily',
  'reports.monthly': 'Monthly',
  'reports.date': 'Date',
  'reports.month': 'Month',
  'reports.exportExcel': 'Export Excel',
  'reports.exportPdf': 'Export PDF',
  'reports.exported': 'Exported',
  'reports.clientsCount': 'Clients',
  'reports.totalRevenue': 'Total revenue',
  'reports.sessionsCount': 'Sessions',
  'reports.byService': 'By service',
  'reports.details': 'Details',
  'reports.number': 'No.',
  'reports.byDay': 'By day',
  'reports.day': 'Day',
  'reports.range': 'Custom',
  'reports.from': 'From',
  'reports.to': 'To',
  'reports.revenueOverTime': 'Revenue over time',
  'reports.busiestHours': 'Busiest hours',
  'reports.byEmployee': 'By employee',
  'reports.employee': 'Employee',
  'reports.avgPerClient': 'Avg / client',
  'reports.vsPrev': 'vs previous period ({from} → {to})',
  'reports.noData': 'No data for this period.',
  'reports.topServices': 'Top services',
  'reports.quickThisMonth': 'This month',
  'reports.quickLast30': 'Last 30 days',
  'reports.quickThisYear': 'This year',
  'settings.servicesHeading': 'Services (buttons)',
  'settings.newServiceName': 'New service name',
  'settings.newServicePlaceholder': 'e.g. Checkup',
  'settings.generalHeading': 'General settings',
  'settings.clinicName': 'Clinic name (shown on receipt)',
  'settings.currency': 'Currency',
  'settings.printingHeading': 'Printing',
  'settings.printer': 'Printer',
  'settings.defaultPrinter': 'Automatic (prefer XPrinter / thermal)',
  'settings.autoPrint': 'Auto-print on press',
  'settings.appearanceHeading': 'Appearance & language',
  'users.displayName': 'Display name',
  'users.addUser': 'Add user',
  'users.resetPassword': 'Reset password',
  'users.newPasswordPrompt': 'New password for {name}:',
  'users.passwordChanged': 'Password changed',
  'backups.backupNow': '💾 Back up now',
  'backups.restoreFromFile': '♻️ Restore from file',
  'backups.autoDailyHeading': 'Automatic daily backup',
  'backups.enableAuto': 'Enable automatic backup on first launch each day',
  'backups.retentionCount': 'Backups to keep',
  'backups.folder': 'Backup folder',
  'backups.defaultFolder': '(default)',
  'backups.changeFolder': 'Change folder',
  'backups.existing': 'Existing backups',
  'backups.file': 'File',
  'backups.size': 'Size',
  'backups.created': 'Backup created',
  'backups.restoredAlert': 'Restored. You will be logged out.',
  'backups.folderUpdated': 'Backup folder updated',
  'backups.noBackups': 'No backups yet.',
  'backups.restore': 'Restore',
  'backups.infoHeading': 'What the backup contains',
  'backups.included': '✅ All your data in one file: users, services, sessions, every client & revenue entry, and settings.',
  'backups.notIncluded': "ℹ️ Not portable between devices: the selected printer (auto-detected on the new device) and the backup-folder path (resets to default).",
  'backups.statUsers': 'Users',
  'backups.statServices': 'Services',
  'backups.statSessions': 'Sessions',
  'backups.statClients': 'Clients (records)',
  'backups.dbSize': 'Database size',
  'backups.integrity': 'Data integrity',
  'backups.integrityOk': 'Healthy ✓',
  'backups.dataRange': 'Data range',
  'backups.migrateHeading': 'Move to another device',
  'backups.migrateSteps': '1) Click "Back up now" and save the file to a USB stick or cloud. 2) Install VetQ on the new device. 3) On this screen click "Restore from file" and pick that same file. The file holds everything.',
  'backups.openFolder': '📂 Open backups folder'
}

const dicts: Record<Lang, Dict> = { ar, en }

type Translate = (key: string, params?: Record<string, string | number>) => string

const LangCtx = createContext<{ lang: Lang; t: Translate; toggle: () => void }>({
  lang: 'ar',
  t: (k) => k,
  toggle: () => {}
})

function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function LangProvider({ children, initial }: { children: ReactNode; initial: Lang }) {
  const [lang, setLang] = useState<Lang>(initial)

  useEffect(() => {
    applyDocumentLang(lang)
  }, [lang])

  const t: Translate = (key, params) => {
    let s = dicts[lang][key] ?? dicts.ar[key] ?? key
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
    return s
  }

  const toggle = () => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    void call(api.settings.update({ lang: next })).catch(() => {})
  }

  return <LangCtx.Provider value={{ lang, t, toggle }}>{children}</LangCtx.Provider>
}

export const useI18n = () => useContext(LangCtx)

export function LangToggle() {
  const { t, toggle } = useI18n()
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      style={{ border: '1px solid var(--border)', width: '100%' }}
    >
      <span>🌐 {t('lang.label')}</span>
      <span className="badge">{t('lang.toggle')}</span>
    </button>
  )
}

/** Locale string for date formatting based on the active language. */
export const localeFor = (lang: Lang): string => (lang === 'ar' ? 'ar-EG' : 'en-US')
