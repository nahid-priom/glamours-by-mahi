/** Bangladesh mobile phone normalization & validation */

export function stripPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Normalize BD mobile to storage format `01XXXXXXXXX`.
 * Accepts: 0172..., +880172..., 880172..., 172... (11+ digits)
 */
export function normalizeBdPhone(phone: string): string | null {
  let digits = stripPhoneDigits(phone)
  if (!digits) return null

  if (digits.startsWith('880') && digits.length >= 13) {
    digits = `0${digits.slice(3)}`
  } else if (digits.startsWith('88') && digits.length >= 12 && !digits.startsWith('880')) {
    digits = `0${digits.slice(2)}`
  } else if (digits.length === 10 && digits.startsWith('1')) {
    digits = `0${digits}`
  }

  if (digits.length !== 11) return null
  if (!/^01[3-9]\d{8}$/.test(digits)) return null
  return digits
}

export function isValidBdPhone(phone: string): boolean {
  return normalizeBdPhone(phone) !== null
}

/** Digits-only form for fuzzy matching (ignores formatting). */
export function phoneSearchKey(phone: string): string {
  let digits = stripPhoneDigits(phone)
  if (digits.startsWith('880')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('88') && digits.length > 11) digits = `0${digits.slice(2)}`
  return digits
}

export function looksLikePhoneQuery(query: string): boolean {
  const digits = stripPhoneDigits(query)
  return digits.length >= 3 && digits.length >= query.replace(/[\s\-()+]/g, '').length * 0.6
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizeBdPhone(a) ?? phoneSearchKey(a)
  const nb = normalizeBdPhone(b) ?? phoneSearchKey(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export function displayCustomerName(name: string | undefined | null, phone: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  const normalized = normalizeBdPhone(phone) ?? phone
  return `Customer ${normalized}`
}
