const express = require('express')

const router = express.Router()

const VALID_STATUS = new Set(['todo', 'doing', 'done', 'nostatus'])
const VALID_PRIORITY = new Set(['low', 'medium', 'high'])

function rowToCard(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    isFinalized: Boolean(row.isFinalized),
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

router.get('/personal-planning/cards', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM personal_planning_cards ORDER BY createdAt').all()
  res.json(rows.map(rowToCard))
})

router.post('/personal-planning/cards', (req, res) => {
  const db = req.app.locals.db
  const payload = req.body

  if (!payload || typeof payload.title !== 'string') {
    return res.status(400).json({ message: 'Invalid payload' })
  }
  if (!VALID_STATUS.has(payload.status) || !VALID_PRIORITY.has(payload.priority)) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const now = new Date().toISOString()
  const card = {
    id: payload.id || require('crypto').randomUUID(),
    title: payload.title.trim(),
    status: payload.status,
    priority: payload.priority,
    isFinalized: payload.isFinalized ? 1 : 0,
    completedAt: payload.completedAt ?? null,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  }

  db
    .prepare(
      'INSERT INTO personal_planning_cards (id,title,status,priority,isFinalized,completedAt,createdAt,updatedAt) VALUES (@id,@title,@status,@priority,@isFinalized,@completedAt,@createdAt,@updatedAt)'
    )
    .run(card)

  const row = db.prepare('SELECT * FROM personal_planning_cards WHERE id = ?').get(card.id)
  res.status(201).json(rowToCard(row))
})

router.patch('/personal-planning/cards/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM personal_planning_cards WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const payload = req.body || {}
  const nextStatus = payload.status ?? existing.status
  const nextPriority = payload.priority ?? existing.priority
  if (!VALID_STATUS.has(nextStatus) || !VALID_PRIORITY.has(nextPriority)) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const updated = {
    id,
    title: typeof payload.title === 'string' ? payload.title.trim() : existing.title,
    status: nextStatus,
    priority: nextPriority,
    isFinalized:
      payload.isFinalized === undefined ? existing.isFinalized : payload.isFinalized ? 1 : 0,
    completedAt: payload.completedAt === undefined ? existing.completedAt : payload.completedAt,
    updatedAt: new Date().toISOString(),
  }

  db
    .prepare(
      'UPDATE personal_planning_cards SET title=@title, status=@status, priority=@priority, isFinalized=@isFinalized, completedAt=@completedAt, updatedAt=@updatedAt WHERE id=@id'
    )
    .run(updated)

  const row = db.prepare('SELECT * FROM personal_planning_cards WHERE id = ?').get(id)
  res.json(rowToCard(row))
})

router.delete('/personal-planning/cards/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM personal_planning_cards WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

module.exports = router
