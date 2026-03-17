const jwt = require('jsonwebtoken')

/**
 * Auth middleware:
 * - Browser: "Authorization: Bearer <JWT>"
 * - Bot / service: "Authorization: ApiKey <BOT_API_KEY>"
 */
module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || ''

  // --- ApiKey auth for bot / internal services ---
  const botApiKey = process.env.BOT_API_KEY
  if (botApiKey && authHeader === `ApiKey ${botApiKey}`) {
    req.user = { username: 'bot', role: 'bot' }
    return next()
  }

  // --- JWT auth for browser ---
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const secret = process.env.JWT_SECRET || 'default-secret-change-me'
      req.user = jwt.verify(token, secret)
      return next()
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' })
    }
  }

  return res.status(401).json({ error: 'Autenticação necessária' })
}
