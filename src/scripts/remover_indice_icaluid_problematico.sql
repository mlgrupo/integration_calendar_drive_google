-- Script para remover o índice único problemático do icaluid
-- Este índice está causando conflitos porque icaluid pode ser duplicado entre usuários

-- 1. Verificar se o índice existe
SELECT 
    'Verificando índices únicos na tabela calendar_events:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
AND indexdef LIKE '%UNIQUE%';

-- 2. Remover o índice único problemático do icaluid
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

-- 3. Verificar se existem outros índices únicos problemáticos
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
        RAISE NOTICE '🗑️ Removido índice único problemático: %', index_name;
    END LOOP;
END $$;

-- 4. Criar índice normal (não único) para icaluid se não existir
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid_normal 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 5. Verificar constraints únicas
SELECT 
    'Constraints únicas atuais:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'google.calendar_events'::regclass
AND contype = 'u';

-- 6. Garantir que apenas a constraint (event_id, usuario_id) existe
DO $$
BEGIN
    -- Remover constraints únicas que não sejam (event_id, usuario_id)
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'google.calendar_events'::regclass 
        AND contype = 'u'
        AND conname != 'uk_calendar_events_event_id_usuario_id'
    LOOP
        EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE '🗑️ Removida constraint única problemática: %', constraint_name;
    END LOOP;
END $$;

-- 7. Status final
SELECT 
    'Status final - Índices na tabela calendar_events:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
ORDER BY indexname; 