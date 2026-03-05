import pathlib

p = pathlib.Path("assistant/llm.py")
c = p.read_bytes()

old = b'  - criar_lembrete, atualizar_lembrete: {"id": "uuid se atualizar", "titulo": "...", "body": "opcional", "firstDueAt": "ISO 8601 data/hora", "recurrence": "once|daily|every_2_days|weekly"}'
new = b'  - criar_lembrete, atualizar_lembrete: {"id": "uuid se atualizar", "titulo": "...", "body": "opcional", "firstDueAt": "ISO 8601 com offset de Brasilia (UTC-3), ex: 2026-03-04T23:55:00-03:00", "recurrence": "once|daily|every_2_days|weekly"}'

if old in c:
    c2 = c.replace(old, new, 1)
    p.write_bytes(c2)
    print("OK - prompt atualizado com fuso horario de Brasilia")
else:
    print("AVISO - texto nao encontrado. Verificando conteudo:")
    idx = c.find(b"criar_lembrete, atualizar_lembrete")
    if idx >= 0:
        print(repr(c[idx:idx+250]))
    else:
        print("linha nao encontrada no arquivo")
