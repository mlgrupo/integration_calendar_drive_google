-- Comando direto para resolver o problema dos índices únicos do icaluid
-- Execute este arquivo para remover TODOS os índices únicos problemáticos

-- Remover todos os índices únicos conhecidos
DROP INDEX IF EXISTS google.idx_calendar_events_icaluid;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

-- Remover qualquer outro índice único que contenha icaluid
DO $$
DECLARE
    index_name text;
BEGIN
    FOR index_name IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'calendar_events' 
        AND schemaname = 'google'
        AND indexname LIKE '%icaluid%'
        AND indexdef LIKE '%UNIQUE%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS google.' || index_name;
        RAISE NOTICE 'Removido: %', index_name;
    END LOOP;
END $$;

-- Criar índice normal para icaluid
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid_normal 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- Verificar resultado
SELECT 'PROBLEMA RESOLVIDO!' as status; 