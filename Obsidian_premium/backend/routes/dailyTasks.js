const express = require('express')

const router = express.Router()

function rowToTask(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    createdAt: row.createdAt,
  }
}

router.get('/daily-tasks', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM daily_tasks ORDER BY createdAt DESC').all()
  res.json(rows.map(rowToTask))
})

router.post('/daily-tasks', (req, res) => {
  const db = req.app.locals.db
  const task = req.body
  if (!task || !task.id || !task.title || !task.createdAt) {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  db
    .prepare('INSERT INTO daily_tasks (id,title,done,createdAt) VALUES (@id,@title,@done,@createdAt)')
    .run({
      id: task.id,
      title: task.title,
      done: task.done ? 1 : 0,
      createdAt: task.createdAt,
    })

  const row = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(task.id)
  res.status(201).json(rowToTask(row))
})

router.patch('/daily-tasks/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const payload = req.body
  const updated = {
    id,
    title: payload.title ?? existing.title,
    done: payload.done === undefined ? existing.done : payload.done ? 1 : 0,
  }

  db.prepare('UPDATE daily_tasks SET title=@title, done=@done WHERE id=@id').run(updated)
  const row = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(id)
  res.json(rowToTask(row))
})

router.delete('/daily-tasks/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM daily_tasks WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

module.exports = router
