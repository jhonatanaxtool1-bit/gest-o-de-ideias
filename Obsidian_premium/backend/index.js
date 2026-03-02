const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')

const createDb = require('./db')
const documentsRouter = require('./routes/documents')
const organizationRouter = require('./routes/organization')
const dailyTasksRouter = require('./routes/dailyTasks')
const professionalPlanningRouter = require('./routes/professionalPlanning')
const personalPlanningRouter = require('./routes/personalPlanning')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }))

// Initialize DB (creates tables if missing)
const db = createDb(path.resolve(process.env.SQLITE_PATH || path.join(__dirname, 'data.sqlite')))
app.locals.db = db

app.use('/api/documents', documentsRouter)
app.use('/api', organizationRouter) // organization routes: /api/interests and /api/areas
app.use('/api', dailyTasksRouter)
app.use('/api', professionalPlanningRouter)
app.use('/api', personalPlanningRouter)

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})

