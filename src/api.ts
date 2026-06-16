import type { ApiResult } from '../electron/shared/types'

/** Unwraps an ApiResult, throwing the Arabic error message on failure. */
export async function call<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error)
  return res.data
}

export const api = window.api
