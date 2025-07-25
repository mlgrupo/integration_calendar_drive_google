-- SCRIPT COMPLETO - Remover TODOS os constraints problemáticos
-- Execute este script para parar definitivamente os loops infinitos

-- 1. Listar TODOS os constraints únicos existentes
SELECT 'CONSTRAINTS ATUAIS:' as info;
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND tc.constraint_type = 'UNIQUE';

-- 2. Listar TODOS os índices únicos
SELECT 'ÍNDICES ÚNICOS ATUAIS:' as info;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'google' 
    AND tablename = 'calendar_events'
    AND indexdef LIKE '%UNIQUE%';

-- 3. Remover TODOS os constraints únicos (exceto icaluid)
ALTER TABLE google.calendar_events 
DROP CONSTRAINT IF EXISTS uk_calendar_events_event_id_usuario_id;

ALTER TABLE google.calendar_events 
DROP CONSTRAINT IF EXISTS idx_calendar_events_unique_event;

ALTER TABLE google.calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_event_id_usuario_id_key;

-- 4. Remover TODOS os índices únicos problemáticos
DROP INDEX IF EXISTS google.uk_calendar_events_event_id_usuario_id;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_event;
DROP INDEX IF EXISTS google.calendar_events_event_id_usuario_id_key;
DROP INDEX IF EXISTS uk_calendar_events_event_id_usuario_id;
DROP INDEX IF EXISTS idx_calendar_events_unique_event;
DROP INDEX IF EXISTS calendar_events_event_id_usuario_id_key;

-- 5. Garantir que apenas o índice único em icaluid existe
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

CREATE UNIQUE INDEX idx_calendar_events_unique_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 6. Criar índices normais (não únicos) para performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id 
ON google.calendar_events (event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_id 
ON google.calendar_events (usuario_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_event_usuario 
ON google.calendar_events (event_id, usuario_id);

-- 7. Verificar resultado final
SELECT 'CONSTRAINTS FINAIS:' as info;
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND tc.constraint_type = 'UNIQUE';

SELECT 'ÍNDICES FINAIS:' as info;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'google' 
    AND tablename = 'calendar_events'
    AND indexdef LIKE '%UNIQUE%';

SELECT '✅ TODOS OS CONSTRAINTS PROBLEMÁTICOS REMOVIDOS!' as resultado; 