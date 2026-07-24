const FRIENDLY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /due payment requires a customer/i, message: 'Customer is required for a due sale.' },
  { pattern: /due requires a customer/i, message: 'Customer is required for a due sale.' },
  {
    pattern: /due payment not allowed when fully paid/i,
    message: 'Remove the due payment or reduce cash/bank payments so they do not exceed the sale total.',
  },
  { pattern: /due requires a customer/i, message: 'Customer is required for a due sale.' },
  { pattern: /payments do not cover grand_total/i, message: 'Walk-in sales must be fully paid.' },
  { pattern: /collection amount .* exceeds customer due/i, message: 'Collection amount cannot exceed customer due.' },
  { pattern: /payment .* exceeds supplier due/i, message: 'Payment amount cannot exceed supplier due.' },
  { pattern: /invalid (receive|payment) account/i, message: 'Please select a valid account.' },
  { pattern: /invalid financial_account_id/i, message: 'Please select a valid account.' },
  { pattern: /financial_account_id required/i, message: 'Please select a valid account.' },
  { pattern: /client_txn_key is required/i, message: 'This transaction could not be submitted. Please try again.' },
  { pattern: /missing permission/i, message: 'You do not have permission to perform this action.' },
  { pattern: /no access to branch/i, message: 'You do not have access to this branch.' },
  { pattern: /insufficient stock/i, message: 'Insufficient stock for one or more items.' },
  { pattern: /already been completed|idempotent/i, message: 'This transaction has already been completed.' },
]

export function friendlyRpcError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? fallback)

  for (const { pattern, message } of FRIENDLY_PATTERNS) {
    if (pattern.test(raw)) return message
  }

  if (/^[0-9a-f-]{36}$/i.test(raw.trim())) return fallback
  if (/permission denied|42501|row-level security/i.test(raw)) {
    return 'You do not have permission to perform this action.'
  }

  return raw.length > 180 ? fallback : raw
}
