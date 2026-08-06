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
