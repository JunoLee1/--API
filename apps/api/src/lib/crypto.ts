import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

export function validatePhoneEncryptionKey(): void { getKey(); }

function getKey(): Buffer {
  const raw = process.env["PHONE_ENCRYPTION_KEY"];
  if (!raw) throw new Error("PHONE_ENCRYPTION_KEY not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("PHONE_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return buf;
}

export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex") };
}

/**
 * @security 호출 제한: ADMIN 또는 MEDICAL 역할을 가진 액터의 요청 컨텍스트에서만 호출할 것.
 * 반환된 평문(개인정보)이 API 응답에 직접 포함되지 않도록 호출 측에서 역할 체크를 선행해야 함.
 *
 * @example
 * // 올바른 사용 예시
 * if (actor.role !== 'ADMIN' && actor.role !== 'MEDICAL') throw new AppError(403, 'FORBIDDEN');
 * const plainPhone = decrypt(player.phoneEncrypted, player.phoneIv);
 */
export function decrypt(encrypted: string, ivHex: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
