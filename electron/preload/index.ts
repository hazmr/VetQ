import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  CreateEntryResult,
  DailyReport,
  DbInfo,
  Entry,
  EntryView,
  MonthlyReport,
  PrintResult,
  RangeReport,
  Role,
  ServiceType,
  Settings,
  StartDayCheck,
  User,
  WorkSession
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  auth: {
    state: () => invoke<{ firstRun: boolean; user: User | null }>('auth:state'),
    loginUsers: () => invoke<{ username: string; display_name: string }[]>('auth:loginUsers'),
    setup: (p: { username: string; password: string }) => invoke<User>('auth:setup', p),
    login: (p: { username: string; password: string }) => invoke<User>('auth:login', p),
    logout: () => invoke<boolean>('auth:logout')
  },
  users: {
    list: () => invoke<User[]>('users:list'),
    create: (p: { username: string; password: string; role: Role; display_name?: string }) =>
      invoke<User>('users:create', p),
    setActive: (id: number, active: boolean) => invoke<void>('users:setActive', { id, active }),
    resetPassword: (id: number, password: string) =>
      invoke<void>('users:resetPassword', { id, password })
  },
  types: {
    list: (includeInactive?: boolean) => invoke<ServiceType[]>('types:list', includeInactive),
    create: (p: { name: string; price: number; color?: string }) =>
      invoke<ServiceType>('types:create', p),
    update: (id: number, patch: Partial<ServiceType>) => invoke<void>('types:update', { id, patch }),
    reorder: (ids: number[]) => invoke<void>('types:reorder', ids)
  },
  entries: {
    active: () => invoke<EntryView[]>('entries:active'),
    create: (type_id: number) => invoke<CreateEntryResult>('entries:create', { type_id }),
    print: (id: number) => invoke<PrintResult>('entries:print', id)
  },
  session: {
    active: () => invoke<WorkSession | null>('session:active'),
    checkNewDay: () => invoke<StartDayCheck>('session:checkNewDay'),
    startNewDay: () => invoke<WorkSession>('session:startNewDay')
  },
  reports: {
    daily: (date: string) => invoke<DailyReport>('reports:daily', date),
    monthly: (month: string) => invoke<MonthlyReport>('reports:monthly', month),
    range: (from: string, to: string) => invoke<RangeReport>('reports:range', { from, to }),
    export: (kind: 'daily' | 'monthly' | 'range', format: 'excel' | 'pdf', key: string, to?: string) =>
      invoke<boolean>('reports:export', { kind, format, key, to })
  },
  settings: {
    get: () => invoke<Settings>('settings:get'),
    update: (patch: Partial<Settings>) => invoke<Settings>('settings:update', patch),
    printers: () => invoke<{ name: string; displayName: string }[]>('printers:list')
  },
  backup: {
    now: () => invoke<boolean>('backup:now'),
    list: () => invoke<{ file: string; path: string; size: number; mtime: number }[]>('backup:list'),
    restore: () => invoke<boolean>('backup:restore'),
    restoreFile: (path: string) => invoke<boolean>('backup:restoreFile', { path }),
    info: () => invoke<DbInfo>('backup:info'),
    reveal: () => invoke<string>('backup:reveal'),
    chooseDir: () => invoke<string | null>('backup:chooseDir')
  }
}

export type VetQApi = typeof api

contextBridge.exposeInMainWorld('api', api)

export type { Entry }
