const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')

const createDb = require('./db')
const authMiddleware = require('./middleware/auth')
const authRouter = require('./routes/auth')
const documentsRouter = require('./routes/documents')
const organizationRouter = require('./routes/organization')
const dailyTasksRouter = require('./routes/dailyTasks')
const professionalPlanningRouter = require('./routes/professionalPlanning')
const personalPlanningRouter = require('./routes/personalPlanning')
const remindersRouter = require('./routes/reminders')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }))

// Initialize DB (creates tables if missing)
const db = createDb(path.resolve(process.env.SQLITE_PATH || path.join(__dirname, 'data.sqlite')))
app.locals.db = db

// --- Public routes (no auth required) ---
app.use('/api', authRouter)

// --- Protected routes (JWT or ApiKey required) ---
app.use('/api', authMiddleware)

app.use('/api/documents', documentsRouter)
app.use('/api', organizationRouter) // /api/interests and /api/areas
app.use('/api', dailyTasksRouter)
app.use('/api', professionalPlanningRouter)
app.use('/api', personalPlanningRouter)
app.use('/api', remindersRouter)

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
  if (!process.env.AUTH_PASSWORD) {
    console.warn('[auth] WARNING: AUTH_PASSWORD not set — all API routes are unprotected!')
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-change-me') {
    console.warn('[auth] WARNING: JWT_SECRET is using default value — set a strong secret in production!')
  }
})
