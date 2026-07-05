import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

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

export function decrypt(encrypted: string, ivHex: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
