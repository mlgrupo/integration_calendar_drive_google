-- Script simples para corrigir o problema de duplicação de chave primária
-- Execute este script no seu banco PostgreSQL

-- 1. Adicionar coluna icaluid se não existir
ALTER TABLE google.calendar_events 
ADD COLUMN IF NOT EXISTS icaluid TEXT;

-- 2. Corrigir a sequência do campo id (isso resolve o problema de duplicação)
SELECT setval(
    pg_get_serial_sequence('google.calendar_events', 'id'), 
    COALESCE((SELECT MAX(id) FROM google.calendar_events), 1)
);

-- 3. Criar índice único para evitar duplicatas de eventos
DROP INDEX IF EXISTS google.idx_calendar_events_unique_event;
CREATE UNIQUE INDEX idx_calendar_events_unique_event 
ON google.calendar_events (event_id, usuario_id);

-- 4. Verificar se funcionou
SELECT 'Sequência corrigida. Próximo ID será: ' || nextval(pg_get_serial_sequence('google.calendar_events', 'id')) as resultado; 