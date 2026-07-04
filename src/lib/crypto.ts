import * as crypto from "crypto"

const algorithm = "aes-256-cbc"
const key  = crypto.randomBytes(32)
const iv = crypto.randomBytes(16)

export function encrypt (text:string){
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted =  cipher.update(text,"utf-8","hex")
    encrypted += cipher.final("hex");
    return { encrypted, iv: iv.toString("hex") };
}
export function decrypt(encrypted:string, ivHex:string){
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, "hex"))
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8");
    return decrypted;
}