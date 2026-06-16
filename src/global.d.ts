import type { VetQApi } from '../electron/preload'

declare global {
  interface Window {
    api: VetQApi
  }
}

export {}
