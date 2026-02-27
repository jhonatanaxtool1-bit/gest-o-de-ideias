const express = require('express')
const router = express.Router()

function rowToInterest(row) {
  if (!row) return null
  return { id: row.id, name: row.name, createdAt: row.createdAt }
}

function rowToArea(row) {
  if (!row) return null
  return { id: row.id, name: row.name, interestId: row.interestId, createdAt: row.createdAt }
}

// Interests
router.get('/interests', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM interests ORDER BY name').all()
  res.json(rows.map(rowToInterest))
})

router.post('/interests', (req, res) => {
  const db = req.app.locals.db
  const i = req.body
  if (!i || !i.id || !i.name) return res.status(400).json({ message: 'Invalid payload' })
  db.prepare('INSERT INTO interests (id,name,createdAt) VALUES (@id,@name,@createdAt)').run({
    id: i.id,
    name: i.name,
    createdAt: i.createdAt || new Date().toISOString(),
  })
  const row = db.prepare('SELECT * FROM interests WHERE id = ?').get(i.id)
  res.status(201).json(rowToInterest(row))
})

router.patch('/interests/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM interests WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const name = req.body.name
  if (!name) return res.status(400).json({ message: 'Invalid payload' })
  db.prepare('UPDATE interests SET name = @name WHERE id = @id').run({ name, id })
  const row = db.prepare('SELECT * FROM interests WHERE id = ?').get(id)
  res.json(rowToInterest(row))
})

router.delete('/interests/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM interests WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  // cascade delete areas
  db.prepare('DELETE FROM areas WHERE interestId = ?').run(req.params.id)
  res.status(204).end()
})

// Areas
router.get('/areas', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM areas ORDER BY name').all()
  res.json(rows.map(rowToArea))
})

router.post('/areas', (req, res) => {
  const db = req.app.locals.db
  const a = req.body
  if (!a || !a.id || !a.name || !a.interestId) return res.status(400).json({ message: 'Invalid payload' })
  db.prepare('INSERT INTO areas (id,name,interestId,createdAt) VALUES (@id,@name,@interestId,@createdAt)').run({
    id: a.id,
    name: a.name,
    interestId: a.interestId,
    createdAt: a.createdAt || new Date().toISOString(),
  })
  const row = db.prepare('SELECT * FROM areas WHERE id = ?').get(a.id)
  res.status(201).json(rowToArea(row))
})

router.patch('/areas/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM areas WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const name = req.body.name
  if (!name) return res.status(400).json({ message: 'Invalid payload' })
  db.prepare('UPDATE areas SET name = @name WHERE id = @id').run({ name, id })
  const row = db.prepare('SELECT * FROM areas WHERE id = ?').get(id)
  res.json(rowToArea(row))
})

router.delete('/areas/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM areas WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

module.exports = router

