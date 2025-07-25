-- Script completo para corrigir a tabela calendar_events
-- Execute este script no seu banco PostgreSQL

-- 1. Adicionar colunas que estão faltando
ALTER TABLE google.calendar_events 
ADD COLUMN IF NOT EXISTS icaluid TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 2. Corrigir a sequência do campo id (resolve problema de duplicação)
SELECT setval(
    pg_get_serial_sequence('google.calendar_events', 'id'), 
    COALESCE((SELECT MAX(id) FROM google.calendar_events), 1)
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_id ON google.calendar_events (usuario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON google.calendar_events (event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid ON google.calendar_events (icaluid);
CREATE INDEX IF NOT EXISTS idx_calendar_events_data_inicio ON google.calendar_events (data_inicio);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendario_id ON google.calendar_events (calendario_id);

-- 4. Remover índices únicos antigos se existirem
DROP INDEX IF EXISTS google.idx_calendar_events_unique_event;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;

-- 5. Criar índices únicos corretos
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_event 
ON google.calendar_events (event_id, usuario_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 6. Verificar se funcionou
SELECT 
    'Tabela corrigida!' as status,
    COUNT(*) as total_eventos,
    'Próximo ID será: ' || nextval(pg_get_serial_sequence('google.calendar_events', 'id')) as proximo_id
FROM google.calendar_events; 