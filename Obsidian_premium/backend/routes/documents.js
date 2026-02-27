const express = require('express')
const router = express.Router()

function rowToDoc(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    cover: row.cover,
    content: row.content,
    interest: row.interest,
    area: row.area,
    tags: JSON.parse(row.tags || '[]'),
    relations: JSON.parse(row.relations || '[]'),
    createdAt: row.createdAt,
  }
}

router.get('/', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM documents ORDER BY title').all()
  res.json(rows.map(rowToDoc))
})

router.get('/:id', (req, res) => {
  const db = req.app.locals.db
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  const doc = rowToDoc(row)
  if (!doc) return res.status(404).json({ message: 'Not found' })
  res.json(doc)
})

router.post('/', (req, res) => {
  const db = req.app.locals.db
  const d = req.body
  if (!d || !d.id || !d.createdAt) return res.status(400).json({ message: 'Invalid payload' })
  db
    .prepare(
      `INSERT INTO documents (id,title,cover,content,interest,area,tags,relations,createdAt)
       VALUES (@id,@title,@cover,@content,@interest,@area,@tags,@relations,@createdAt)`
    )
    .run({
      id: d.id,
      title: d.title || 'Sem título',
      cover: d.cover || '',
      content: d.content || '',
      interest: d.interest || '',
      area: d.area || '',
      tags: JSON.stringify(d.tags || []),
      relations: JSON.stringify(d.relations || []),
      createdAt: d.createdAt,
    })
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(d.id)
  res.status(201).json(rowToDoc(row))
})

router.patch('/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const payload = req.body
  const updated = {
    id,
    title: payload.title ?? existing.title,
    cover: payload.cover ?? existing.cover,
    content: payload.content ?? existing.content,
    interest: payload.interest ?? existing.interest,
    area: payload.area ?? existing.area,
    tags: JSON.stringify(payload.tags ?? JSON.parse(existing.tags || '[]')),
    relations: JSON.stringify(payload.relations ?? JSON.parse(existing.relations || '[]')),
    createdAt: existing.createdAt,
  }
  db
    .prepare(
      `UPDATE documents SET title=@title, cover=@cover, content=@content, interest=@interest, area=@area, tags=@tags, relations=@relations WHERE id=@id`
    )
    .run(updated)
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  res.json(rowToDoc(row))
})

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db
  const info = db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

module.exports = router

