const Database = require('better-sqlite3')

function createDb(dbPath) {
  const db = new Database(dbPath)

  // documents
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cover TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        interest TEXT NOT NULL DEFAULT '',
        area TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        relations TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL
      );`
    )
    .run()

  // interests
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS interests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );`
    )
    .run()

  // areas
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        interestId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );`
    )
    .run()

  // daily tasks
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS daily_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      );`
    )
    .run()

  // professional planning cards
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS planning_cards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        isFinalized INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );`
    )
    .run()
  // seed default organization if empty
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM interests').get().c
    if (!count || count === 0) {
      const crypto = require('crypto')
      const now = new Date().toISOString()
      const personalId = crypto.randomUUID()
      db.prepare('INSERT INTO interests (id,name,createdAt) VALUES (@id,@name,@createdAt)').run({
        id: personalId,
        name: 'Pessoal',
        createdAt: now,
      })
      db.prepare('INSERT INTO areas (id,name,interestId,createdAt) VALUES (@id,@name,@interestId,@createdAt)').run({
        id: crypto.randomUUID(),
        name: 'Inbox',
        interestId: personalId,
        createdAt: now,
      })
      db.prepare('INSERT INTO areas (id,name,interestId,createdAt) VALUES (@id,@name,@interestId,@createdAt)').run({
        id: crypto.randomUUID(),
        name: 'Áreas',
        interestId: personalId,
        createdAt: now,
      })
    }
  } catch (e) {
    // ignore seed errors
  }

  return db
}

module.exports = createDb


