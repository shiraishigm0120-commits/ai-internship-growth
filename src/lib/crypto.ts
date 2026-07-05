import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "fallback-dev-key"
  return createHash("sha256").update(secret).digest()
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: base64(iv) + ":" + base64(tag) + ":" + base64(ciphertext)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decrypt(encoded: string): string {
  const key = getKey()
  const [ivB64, tagB64, dataB64] = encoded.split(":")

  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const encrypted = Buffer.from(dataB64, "base64")

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}
