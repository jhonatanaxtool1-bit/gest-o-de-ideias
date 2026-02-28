/**
 * Gera um UUID v4. Usa crypto.randomUUID() em contexto seguro (HTTPS/localhost);
 * em HTTP usa fallback com getRandomValues ou Math.random para compatibilidade.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const buf = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf)
  } else {
    for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  buf[6] = (buf[6]! & 0x0f) | 0x40
  buf[8] = (buf[8]! & 0x3f) | 0x80
  const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
