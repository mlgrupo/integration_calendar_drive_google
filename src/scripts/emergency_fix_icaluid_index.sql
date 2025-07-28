-- SCRIPT DE EMERGÊNCIA: Remover índice único problemático do icaluid
-- Execute este script IMEDIATAMENTE para resolver o erro de constraint

-- 1. Remover o índice único problemático
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

-- 2. Verificar e remover outros índices únicos problemáticos
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
        RAISE NOTICE '🗑️ REMOVIDO índice único problemático: %', index_name;
    END LOOP;
END $$;

-- 3. Criar índice normal (não único) para icaluid
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid_normal 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 4. Verificar se a constraint principal existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'google.calendar_events'::regclass 
        AND contype = 'u'
        AND conname = 'uk_calendar_events_event_id_usuario_id'
    ) THEN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT uk_calendar_events_event_id_usuario_id 
        UNIQUE (event_id, usuario_id);
        RAISE NOTICE '✅ Constraint (event_id, usuario_id) criada';
    ELSE
        RAISE NOTICE 'ℹ️ Constraint (event_id, usuario_id) já existe';
    END IF;
END $$;

-- 5. Status final
SELECT 
    '✅ PROBLEMA RESOLVIDO - Status final:' as info,
    'Índices únicos removidos' as acao,
    'Constraint (event_id, usuario_id) mantida' as constraint_status,
    'Índice normal criado para icaluid' as index_status;

-- 6. Verificar índices atuais
SELECT 
    'Índices atuais na tabela calendar_events:' as info,
    indexname,
    CASE 
        WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
        ELSE 'NORMAL'
    END as tipo
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
ORDER BY indexname; 