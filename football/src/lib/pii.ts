const PHONE_STRIP = /[^0-9]/g

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "-"
  const digits = phone.replace(PHONE_STRIP, "")
  if (digits.length < 7) return phone
  const head = digits.slice(0, 3)
  const tail = digits.slice(-4)
  const middleLen = digits.length - head.length - tail.length
  return `${head}-${"*".repeat(middleLen)}-${tail}`
}

export function maskDateOfBirth(dob: string | Date | null | undefined): string {
  if (!dob) return "-"
  const d = typeof dob === "string" ? new Date(dob) : dob
  if (isNaN(d.getTime())) return "-"
  return `${d.getUTCFullYear()}-**-**`
}
