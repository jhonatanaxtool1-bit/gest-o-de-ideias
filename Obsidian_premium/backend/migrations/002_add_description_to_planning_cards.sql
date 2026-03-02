-- planning_cards (empresarial)
ALTER TABLE planning_cards ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- personal_planning_cards (pessoal)
ALTER TABLE personal_planning_cards ADD COLUMN description TEXT NOT NULL DEFAULT '';
