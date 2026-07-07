import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production")
    }
    throw new Error("AUTH_SECRET is required for encryption. Set it in your .env.local file.")
  }
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
  try {
    const key = getKey()
    const parts = encoded.split(":")
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format")
    }

    const [ivB64, tagB64, dataB64] = parts
    const iv = Buffer.from(ivB64, "base64")
    const tag = Buffer.from(tagB64, "base64")
    const encrypted = Buffer.from(dataB64, "base64")

    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}
