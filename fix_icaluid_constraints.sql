-- Script para remover constraints e índices problemáticos do icaluid
-- Execute este script para resolver definitivamente o problema

-- 1. Remover constraints únicas problemáticas primeiro
ALTER TABLE google.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_icaluid_usuario_unique;
ALTER TABLE google.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_icaluid_unique;
ALTER TABLE google.calendar_events DROP CONSTRAINT IF EXISTS uk_calendar_events_icaluid;

-- 2. Remover todos os índices únicos conhecidos
DROP INDEX IF EXISTS google.idx_calendar_events_icaluid;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS google.calendar_events_icaluid_usuario_unique;
DROP INDEX IF EXISTS idx_calendar_events_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

-- 3. Remover qualquer outro índice único que contenha icaluid
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
        RAISE NOTICE '🗑️ Removido índice único: %', index_name;
    END LOOP;
END $$;

-- 4. Remover constraints únicas que contenham icaluid
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'google.calendar_events'::regclass 
        AND contype = 'u'
        AND (conname LIKE '%icaluid%' OR conname LIKE '%calendar_events_icaluid%')
    LOOP
        EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE '🗑️ Removida constraint única: %', constraint_name;
    END LOOP;
END $$;

-- 5. Garantir que a constraint principal (event_id, usuario_id) existe
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
        RAISE NOTICE '✅ Constraint principal criada: (event_id, usuario_id)';
    ELSE
        RAISE NOTICE 'ℹ️ Constraint principal já existe: (event_id, usuario_id)';
    END IF;
END $$;

-- 6. Criar índice normal para icaluid
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid_normal 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 7. Verificar resultado
SELECT 
    '✅ PROBLEMA RESOLVIDO!' as status,
    'Todas as constraints e índices únicos de icaluid foram removidos' as acao;

-- 8. Mostrar constraints restantes
SELECT 
    'Constraints únicas restantes:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'google.calendar_events'::regclass
AND contype = 'u'; 