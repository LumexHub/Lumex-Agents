/**
 * RSASSA-PKCS1-v1_5 signing/verification utility with key generation and export/import helpers.
 * - Works in browser (Web Crypto) and Node (crypto.webcrypto).
 * - Avoids async-in-constructor anti-pattern by using an async factory: SigningEngine.create().
 * - Provides PEM export/import and JWK export helpers.
 */

type Subtle = SubtleCrypto

function getSubtle(): Subtle {
  // Browser
  if (typeof globalThis !== "undefined" && (globalThis as any).crypto?.subtle) {
    return (globalThis as any).crypto.subtle as Subtle
  }
  // Node >= 15: crypto.webcrypto
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require("crypto")
    return webcrypto.subtle as Subtle
  } catch {
    throw new Error("Web Crypto API (SubtleCrypto) is not available in this environment.")
  }
}

const ALG: RsaHashedKeyGenParams & RsaHashedImportParams = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  // modulusLength & publicExponent are only used on generateKey
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
}

function utf8Encode(input: string): Uint8Array {
  return new TextEncoder().encode(input)
}

function abToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab)
  if (typeof Buffer !== "undefined") {
    // Node path
    return Buffer.from(bytes).toString("base64")
  }
  // Browser path
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  // btoa expects binary string
  return btoa(binary)
}

function base64ToAb(b64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    // Node path
    return Uint8Array.from(Buffer.from(b64, "base64")).buffer
  }
  // Browser path
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function toPem(b64: string, header: string, footer: string, lineLen = 64): string {
  const chunks: string[] = []
  for (let i = 0; i < b64.length; i += lineLen) chunks.push(b64.slice(i, i + lineLen))
  return `-----BEGIN ${header}-----\n${chunks.join("\n")}\n-----END ${footer}-----\n`
}

function fromPem(pem: string): string {
  const cleaned = pem.replace(/-----(BEGIN|END) [^-]+-----/g, "").replace(/\s+/g, "")
  return cleaned
}

export class SigningEngine {
  private keyPair!: CryptoKeyPair
  private subtle: Subtle

  private constructor() {
    this.subtle = getSubtle()
  }

  /**
   * Async factory to create an instance with a fresh RSA keypair.
   */
  static async create(modulusLength = 2048): Promise<SigningEngine> {
    const inst = new SigningEngine()
    const keyAlg = { ...ALG, modulusLength }
    inst.keyPair = (await inst.subtle.generateKey(keyAlg, true, ["sign", "verify"])) as CryptoKeyPair
    return inst
  }

  /**
   * Sign a UTF-8 string payload. Returns base64 signature.
   */
  async sign(data: string): Promise<string> {
    this.ensureReady()
    const sig = await this.subtle.sign(ALG.name, this.keyPair.privateKey, utf8Encode(data))
    return abToBase64(sig)
  }

  /**
   * Verify a base64 signature over a UTF-8 string payload.
   */
  async verify(data: string, signatureBase64: string): Promise<boolean> {
    this.ensureReady()
    const sig = base64ToAb(signatureBase64)
    return this.subtle.verify(ALG.name, this.keyPair.publicKey, sig, utf8Encode(data))
  }

  /**
   * Export public key as PEM (SPKI).
   */
  async exportPublicKeyPEM(): Promise<string> {
    this.ensureReady()
    const spki = await this.subtle.exportKey("spki", this.keyPair.publicKey)
    return toPem(abToBase64(spki), "PUBLIC KEY", "PUBLIC KEY")
  }

  /**
   * Export private key as PEM (PKCS#8).
   */
  async exportPrivateKeyPEM(): Promise<string> {
    this.ensureReady()
    const pkcs8 = await this.subtle.exportKey("pkcs8", this.keyPair.privateKey)
    return toPem(abToBase64(pkcs8), "PRIVATE KEY", "PRIVATE KEY")
  }

  /**
   * Import a public key from PEM (SPKI).
   */
  async importPublicKeyPEM(pem: string): Promise<CryptoKey> {
    const spkiB64 = fromPem(pem)
    const spki = base64ToAb(spkiB64)
    return this.subtle.importKey("spki", spki, ALG, true, ["verify"])
  }

  /**
   * Import a private key from PEM (PKCS#8).
   */
  async importPrivateKeyPEM(pem: string): Promise<CryptoKey> {
    const pkcs8B64 = fromPem(pem)
    const pkcs8 = base64ToAb(pkcs8B64)
    return this.subtle.importKey("pkcs8", pkcs8, ALG, true, ["sign"])
  }

  /**
   * Replace the engine's keypair with provided keys (e.g., after import).
   */
  setKeyPair(publicKey: CryptoKey, privateKey: CryptoKey): void {
    this.keyPair = { publicKey, privateKey }
  }

  /**
   * Export public key as JWK (useful for JSON transport).
   */
  async exportPublicJwk(): Promise<JsonWebKey> {
    this.ensureReady()
    return this.subtle.exportKey("jwk", this.keyPair.publicKey)
  }

  private ensureReady(): void {
    if (!this.keyPair || !this.keyPair.privateKey || !this.keyPair.publicKey) {
      throw new Error("SigningEngine is not initialized. Use SigningEngine.create() first or setKeyPair().")
    }
  }
}
