const express = require('express')
const router = express.Router({ mergeParams: true })

function rowToList(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    listType: row.listType || 'geral',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function rowToItem(row) {
  if (!row) return null
  return {
    id: row.id,
    listId: row.listId,
    label: row.label,
    order: row.order,
    done: Boolean(row.done),
    createdAt: row.createdAt,
  }
}

router.get('/', (req, res) => {
  const db = req.app.locals.db
  const rows = db.prepare('SELECT * FROM lists ORDER BY updatedAt DESC').all()
  const lists = rows.map((row) => {
    const list = rowToList(row)
    const items = db.prepare('SELECT * FROM list_items WHERE listId = ? ORDER BY "order", createdAt').all(row.id)
    return { ...list, items: items.map(rowToItem) }
  })
  res.json(lists)
})

router.get('/:id', (req, res) => {
  const db = req.app.locals.db
  const row = db.prepare('SELECT * FROM lists WHERE id = ?').get(req.params.id)
  const list = rowToList(row)
  if (!list) return res.status(404).json({ message: 'Not found' })
  const items = db.prepare('SELECT * FROM list_items WHERE listId = ? ORDER BY "order", createdAt').all(list.id)
  res.json({ ...list, items: items.map(rowToItem) })
})

router.post('/', (req, res) => {
  const db = req.app.locals.db
  const d = req.body
  if (!d || !d.id || !d.createdAt || !d.updatedAt) return res.status(400).json({ message: 'Invalid payload' })
  db
    .prepare('INSERT INTO lists (id, title, listType, createdAt, updatedAt) VALUES (@id, @title, @listType, @createdAt, @updatedAt)')
    .run({
      id: d.id,
      title: d.title || 'Sem título',
      listType: d.listType || 'geral',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })
  const items = Array.isArray(d.items) ? d.items : []
  for (const it of items) {
    if (!it.id || !it.createdAt) continue
    db.prepare(
      'INSERT INTO list_items (id, listId, label, "order", done, createdAt) VALUES (@id, @listId, @label, @order, @done, @createdAt)'
    ).run({
      id: it.id,
      listId: d.id,
      label: it.label || '',
      order: typeof it.order === 'number' ? it.order : 0,
      done: it.done ? 1 : 0,
      createdAt: it.createdAt,
    })
  }
  const row = db.prepare('SELECT * FROM lists WHERE id = ?').get(d.id)
  const list = rowToList(row)
  const itemRows = db.prepare('SELECT * FROM list_items WHERE listId = ? ORDER BY "order", createdAt').all(d.id)
  res.status(201).json({ ...list, items: itemRows.map(rowToItem) })
})

router.patch('/:id', (req, res) => {
  const db = req.app.locals.db
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM lists WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const payload = req.body
  const updatedAt = new Date().toISOString()
  const updated = {
    id,
    title: payload.title ?? existing.title,
    listType: payload.listType ?? existing.listType,
    createdAt: existing.createdAt,
    updatedAt,
  }
  db.prepare('UPDATE lists SET title=@title, listType=@listType, updatedAt=@updatedAt WHERE id=@id').run(updated)
  if (Array.isArray(payload.items)) {
    db.prepare('DELETE FROM list_items WHERE listId = ?').run(id)
    for (const it of payload.items) {
      if (!it.id || !it.createdAt) continue
      db.prepare(
        'INSERT INTO list_items (id, listId, label, "order", done, createdAt) VALUES (@id, @listId, @label, @order, @done, @createdAt)'
      ).run({
        id: it.id,
        listId: id,
        label: it.label || '',
        order: typeof it.order === 'number' ? it.order : 0,
        done: it.done ? 1 : 0,
        createdAt: it.createdAt,
      })
    }
  }
  const row = db.prepare('SELECT * FROM lists WHERE id = ?').get(id)
  const list = rowToList(row)
  const itemRows = db.prepare('SELECT * FROM list_items WHERE listId = ? ORDER BY "order", createdAt').all(id)
  res.json({ ...list, items: itemRows.map(rowToItem) })
})

router.delete('/:id', (req, res) => {
  const db = req.app.locals.db
  db.prepare('DELETE FROM list_items WHERE listId = ?').run(req.params.id)
  const info = db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  res.status(204).end()
})

// Item-level endpoints for bot and fine-grained updates
router.post('/:listId/items', (req, res) => {
  const db = req.app.locals.db
  const listId = req.params.listId
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(listId)
  if (!list) return res.status(404).json({ message: 'List not found' })
  const it = req.body
  if (!it || !it.id || !it.createdAt) return res.status(400).json({ message: 'Invalid payload' })
  const order = typeof it.order === 'number' ? it.order : 0
  db.prepare(
    'INSERT INTO list_items (id, listId, label, "order", done, createdAt) VALUES (@id, @listId, @label, @order, @done, @createdAt)'
  ).run({
    id: it.id,
    listId,
    label: it.label || '',
    order,
    done: it.done ? 1 : 0,
    createdAt: it.createdAt,
  })
  db.prepare('UPDATE lists SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), listId)
  const row = db.prepare('SELECT * FROM list_items WHERE id = ?').get(it.id)
  res.status(201).json(rowToItem(row))
})

router.patch('/:listId/items/:itemId', (req, res) => {
  const db = req.app.locals.db
  const { listId, itemId } = req.params
  const existing = db.prepare('SELECT * FROM list_items WHERE id = ? AND listId = ?').get(itemId, listId)
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const payload = req.body
  const label = payload.label !== undefined ? payload.label : existing.label
  const order = payload.order !== undefined ? payload.order : existing.order
  const done = payload.done !== undefined ? (payload.done ? 1 : 0) : existing.done
  db.prepare('UPDATE list_items SET label=@label, "order"=@order, done=@done WHERE id=@id').run({
    id: itemId,
    label,
    order,
    done,
  })
  db.prepare('UPDATE lists SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), listId)
  const row = db.prepare('SELECT * FROM list_items WHERE id = ?').get(itemId)
  res.json(rowToItem(row))
})

router.delete('/:listId/items/:itemId', (req, res) => {
  const db = req.app.locals.db
  const { listId, itemId } = req.params
  const info = db.prepare('DELETE FROM list_items WHERE id = ? AND listId = ?').run(itemId, listId)
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' })
  db.prepare('UPDATE lists SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), listId)
  res.status(204).end()
})

module.exports = router
