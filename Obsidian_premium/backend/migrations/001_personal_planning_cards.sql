-- Tabela para planejamento pessoal (Kanban). Dados separados do planejamento empresarial.
CREATE TABLE IF NOT EXISTS personal_planning_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  isFinalized INTEGER NOT NULL DEFAULT 0,
  completedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
