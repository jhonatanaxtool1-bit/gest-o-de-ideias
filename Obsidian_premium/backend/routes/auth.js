const router = require('express').Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

// Hash the password once at startup (prevents timing attacks via bcrypt compare)
let _passwordHash = null
function getPasswordHash() {
  if (_passwordHash) return _passwordHash
  const pwd = process.env.AUTH_PASSWORD
  if (!pwd) return null
  console.log('[auth] Hashing AUTH_PASSWORD on first use...')
  _passwordHash = bcrypt.hashSync(pwd, 10)
  return _passwordHash
}

// POST /api/auth/login
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
  }

  const expectedUsername = process.env.AUTH_USERNAME || 'admin'
  const hash = getPasswordHash()

  if (!hash) {
    return res
      .status(500)
      .json({ error: 'AUTH_PASSWORD não configurado no servidor' })
  }

  const usernameMatch = username === expectedUsername
  const passwordMatch = bcrypt.compareSync(password, hash)

  if (!usernameMatch || !passwordMatch) {
    // Always return the same message to avoid username enumeration
    return res.status(401).json({ error: 'Credenciais inválidas' })
  }

  const secret = process.env.JWT_SECRET || 'default-secret-change-me'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  const token = jwt.sign({ username }, secret, { expiresIn })

  res.json({ token })
})

module.exports = router
