export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visibleLen = local.length >= 4 ? 2 : local.length >= 3 ? 1 : 0;
  return visibleLen > 0 ? `${local.slice(0, visibleLen)}***${domain}` : `***${domain}`;
}

export function maskUsername(username: string): string {
  return username.length >= 4 ? `${username.slice(0, 3)}***` : "***";
}

// 010-1234-5678 → 010-****-5678
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null;
  return phone.replace(/(\d{3})-(\d{3,4})-(\d{4})/, (_, a, _b, c) => `${a}-****-${c}`);
}
