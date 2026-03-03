const express = require('express')
const router = express.Router()

const VALID_RECURRENCE = new Set(['once', 'daily', 'every_2_days', 'weekly'])

function rowToReminder(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    body: typeof row.body === 'string' ? row.body : '',
    firstDueAt: row.firstDueAt,
    recurrence: row.recurrence,
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function isDue(row, now) {
  const first = new Date(row.firstDueAt).getTime()
  const last = row.lastTriggeredAt ? new Date(row.lastTriggeredAt).getTime() : null
  const t = now.getTime()

  if (row.recurrence === 'once') {
    return first <= t && !last
  }
  if (last === null) {
    return first <= t
  }
  const dayMs = 24 * 60 * 60 * 1000
  if (row.recurrence === 'daily') return last + dayMs <= t
  if (row.recurrence === 'every_2_days') return last + 2 * dayMs <= t
  if (row.recurrence === 'weekly') return last + 7 * dayMs <= t
  return false
}

router.get('/reminders', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM reminders ORDER BY firstDueAt').all()
  res.json(rows.map(rowToReminder))
})

router.get('/reminders/due', (req, res) => {
  const db = req.app.locals.db
  const now = new Date()
  const rows = db.prepare('SELECT * FROM reminders ORDER BY firstDueAt').all()
  const due = rows.filter((r) => isDue(r, now))
  res.json(due.map(rowToReminder))
})

router.get('/reminders/:id', (req, res) => {
  const db = req.app.locals.db
  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ message: 'Not found' })
  res.json(rowToReminder(row))
})

router.post('/reminders', (req, res) => {
  const db = req.app.locals.db
  const payload = req.body

  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) {
    return res.status(400).json({ message: 'title é obrigatório' })
  }
  const firstDueAt = payload.firstDueAt && typeof payload.firstDueAt === 'string' ? payload.firstDueAt.trim() : null
  if (!firstDueAt || Number.isNaN(new Date(firstDueAt).getTime())) {
    return res.status(400).json({ message: 'firstDueAt deve ser uma data/hora ISO válida' })
  }
  const recurrence = VALID_RECURRENCE.has(payload.recurrence) ? payload.recurrence : 'once'

  const now = new Date().toISOString()
  const reminder = {
    id: payload.id || require('crypto').randomUUID(),
    title: payload.title.trim(),
    body: typeof payload.body === 'string' ? payload.body.trim() : '',
    firstDueAt,
    recurrence,
    lastTriggeredAt: null,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  }

  db
    .prepare(
      'INSERT INTO reminders (id,title,body,firstDueAt,recurrence,lastTriggeredAt,createdAt,updatedAt) VALUES (@id,@title,@body,@firstDueAt,@recurrence,@lastTriggeredAt,@createdAt,@updatedAt)'
    )
    .run(reminder)

  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminder.id)
  res.status(201).json(rowToReminder(row))
})

router.patch('/reminders/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const payload = req.body || {}
  const title = typeof payload.title === 'string' ? payload.title.trim() : existing.title
  const body = typeof payload.body === 'string' ? payload.body : existing.body
  let firstDueAt = existing.firstDueAt
  if (payload.firstDueAt && typeof payload.firstDueAt === 'string') {
    const d = payload.firstDueAt.trim()
    if (!Number.isNaN(new Date(d).getTime())) firstDueAt = d
  }
  const recurrence = VALID_RECURRENCE.has(payload.recurrence) ? payload.recurrence : existing.recurrence
  const lastTriggeredAt = payload.lastTriggeredAt !== undefined
    ? (payload.lastTriggeredAt && typeof payload.lastTriggeredAt === 'string' ? payload.lastTriggeredAt : null)
    : existing.lastTriggeredAt

  const updated = {
    id,
    title,
    body,
    firstDueAt,
    recurrence,
    lastTriggeredAt,
    updatedAt: new Date().toISOString(),
  }

  db
    .prepare(
      'UPDATE reminders SET title=@title, body=@body, firstDueAt=@firstDueAt, recurrence=@recurrence, lastTriggeredAt=@lastTriggeredAt, updatedAt=@updatedAt WHERE id=@id'
    )
    .run(updated)

  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id)
  res.json(rowToReminder(row))
})

router.delete('/reminders/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

module.exports = router
