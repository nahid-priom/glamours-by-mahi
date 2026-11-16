import { isUniqueViolation } from '@/lib/errors/unique-violation'

const FRIENDLY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /due payment requires a customer/i, message: 'Customer is required for a due sale.' },
  { pattern: /due requires a customer/i, message: 'Customer is required for a due sale.' },
  {
    pattern: /due payment not allowed when fully paid/i,
    message:
      'Remove the due payment or reduce cash/bank payments so they do not exceed the sale total.',
  },
  { pattern: /payments do not cover grand_total/i, message: 'Walk-in sales must be fully paid.' },
  {
    pattern: /collection amount .* exceeds customer due/i,
    message: 'Collection amount cannot exceed customer due.',
  },
  {
    pattern: /payment .* exceeds supplier due/i,
    message: 'Payment amount cannot exceed supplier due.',
  },
  { pattern: /invalid (receive|payment) account/i, message: 'Please select a valid account.' },
  { pattern: /invalid financial_account_id/i, message: 'Please select a valid account.' },
  { pattern: /financial_account_id required/i, message: 'Please select a valid account.' },
  {
    pattern: /client_txn_key is required/i,
    message: 'This transaction could not be submitted. Please try again.',
  },
  { pattern: /missing permission/i, message: 'You do not have permission to perform this action.' },
  { pattern: /no access to branch/i, message: 'You do not have access to this branch.' },
  { pattern: /insufficient stock/i, message: 'Insufficient stock for one or more items.' },
  {
    pattern: /already been completed|idempotent/i,
    message: 'This transaction has already been completed.',
  },
  {
    pattern: /category with this name or code already exists/i,
    message: 'A category with this name or code already exists.',
  },
  {
    pattern: /subcategory with this name or code already exists/i,
    message: 'A subcategory with this name or code already exists.',
  },
  {
    pattern: /brand with this name or code already exists/i,
    message: 'A brand with this name or code already exists.',
  },
  {
    pattern: /duplicate key|unique constraint|categories_org_name|categories_org_code|brands_org_|subcategories_/i,
    message: 'This record already exists. Please use a different name or code.',
  },
  {
    pattern: /jwt expired|invalid jwt|session.*expired|not authenticated|auth session missing/i,
    message: 'Your session has expired. Please sign in again.',
  },
  {
    pattern: /failed to fetch|networkerror|network request failed|load failed/i,
    message: 'Network error. Check your connection and try again.',
  },
  {
    pattern: /foreign key|23503|violates foreign key/i,
    message: 'This action references missing or invalid related data.',
  },
  {
    pattern: /PGRST116|results contain 0 rows|JSON object requested/i,
    message: 'The requested record was not found.',
  },
]

/** Pull the most useful string out of Error / PostgREST / nested RPC payloads. */
export function extractErrorText(error: unknown): string {
  if (error == null) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const anyErr = error as Error & {
      details?: unknown
      hint?: unknown
      code?: unknown
      cause?: unknown
    }
    const parts = [error.message, anyErr.details, anyErr.hint]
      .map((p) => (p == null ? '' : String(p)))
      .filter(Boolean)
    if (parts.length) return parts.join(' — ')
    if (anyErr.cause) return extractErrorText(anyErr.cause)
    return error.message
  }
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>
    const nested = o.error
    const candidates = [
      o.message,
      o.details,
      o.hint,
      o.error_description,
      o.error_description_translated,
      typeof nested === 'string' ? nested : nested && typeof nested === 'object'
        ? (nested as { message?: unknown }).message
        : null,
    ]
    for (const c of candidates) {
      if (c != null && String(c).trim()) return String(c)
    }
  }
  return String(error)
}

function looksLikeSqlNoise(text: string): boolean {
  return /STACKED DIAGNOSTICS|PL\/pgSQL|SQLSTATE|context:\s*PL\/pgSQL|at\s+Object\.|node_modules/i.test(
    text,
  )
}

export function friendlyRpcError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (isUniqueViolation(error)) {
    const rawUnique = extractErrorText(error)
    for (const { pattern, message } of FRIENDLY_PATTERNS) {
      if (pattern.test(rawUnique)) return message
    }
    return 'This record already exists. Please use a different name or code.'
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code ?? '')
      : ''

  if (code === '42501') {
    return 'You do not have permission to perform this action.'
  }
  if (/PGRST301/i.test(code)) {
    return 'Your session has expired. Please sign in again.'
  }
  if (code === '23503') {
    return 'This action references missing or invalid related data.'
  }
  if (code === '23505') {
    return 'This record already exists. Please use a different name or code.'
  }

  const raw = extractErrorText(error).trim() || fallback

  for (const { pattern, message } of FRIENDLY_PATTERNS) {
    if (pattern.test(raw)) return message
  }

  if (/^[0-9a-f-]{36}$/i.test(raw)) return fallback
  if (/permission denied|42501|row-level security|PGRST301/i.test(raw)) {
    return 'You do not have permission to perform this action.'
  }
  if (looksLikeSqlNoise(raw) || raw.length > 180) return fallback

  return raw
}

type ToastFn = (message: string, type?: 'success' | 'error') => void

/** One-liner for mutation/catch handlers: toast a friendly RPC/PostgREST message. */
export function toastRpcError(
  toast: ToastFn,
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): void {
  toast(friendlyRpcError(error, fallback), 'error')
}
