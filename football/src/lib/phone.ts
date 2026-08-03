// Korean phone number format: 02-XXX(X)-XXXX or 0XX-XXX(X)-XXXX
const PHONE_REGEX = /^\d{2,3}-\d{3,4}-\d{4}$/

export type PhoneNumber = string & { readonly __brand: 'PhoneNumber' }

export function isValidPhone(value: string): value is PhoneNumber {
  return PHONE_REGEX.test(value)
}

export function validatePhone(value: string | undefined | null): string | null {
  if (!value) return null
  if (!isValidPhone(value)) return '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)'
  return null
}
