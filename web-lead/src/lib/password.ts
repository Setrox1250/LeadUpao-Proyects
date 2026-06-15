import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 64

// Hash de contraseñas con scrypt (módulo nativo de Node, sin dependencias extra).
// Formato almacenado: "salt:hash" (ambos en hexadecimal).
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false

  const hashBuffer = Buffer.from(hash, 'hex')
  const candidate = scryptSync(password, salt, KEY_LENGTH)

  return candidate.length === hashBuffer.length && timingSafeEqual(candidate, hashBuffer)
}

// Política mínima de contraseñas: al menos 8 caracteres, con al menos
// una letra y un número. Devuelve el mensaje de error o null si es válida.
export function validarContrasena(password: string): string | null {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número.'
  }
  return null
}
