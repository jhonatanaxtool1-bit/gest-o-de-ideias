const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

/**
 * Cria a tabela de controle de migrations (se não existir) e executa
 * todos os arquivos .sql pendentes, em ordem alfabética.
 * Roda automaticamente na inicialização do backend (incl. VPS).
 */
function runMigrations(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )`
  ).run()

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((row) => row.name)
  )

  let files = []
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return
  }

  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of sqlFiles) {
    const name = file
    if (applied.has(name)) continue

    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(filePath, 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)').run(
      name,
      new Date().toISOString()
    )
  }
}

module.exports = { runMigrations }
