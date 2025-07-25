-- Script FINAL para corrigir todos os problemas da tabela calendar_events
-- Este script resolve o erro "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- 1. Adicionar coluna icaluid se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_events' 
        AND column_name = 'icaluid'
    ) THEN
        ALTER TABLE google.calendar_events ADD COLUMN icaluid TEXT;
        RAISE NOTICE '✅ Coluna icaluid adicionada';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna icaluid já existe';
    END IF;
END $$;

-- 2. Remover TODAS as constraints problemáticas que possam existir
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Remover constraints únicas problemáticas
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'google.calendar_events'::regclass 
        AND contype = 'u'
        AND conname != 'uk_calendar_events_event_id_usuario_id'
    LOOP
        EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE '🗑️ Removida constraint: %', constraint_name;
    END LOOP;
END $$;

-- 3. Remover índices únicos problemáticos do icaluid
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

DO $$
DECLARE
    index_name text;
BEGIN
    -- Remover todos os índices únicos que contenham icaluid
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

-- 4. Garantir que a constraint principal (event_id, usuario_id) existe
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

-- 5. Criar índices úteis
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_data_inicio 
ON google.calendar_events (data_inicio);

CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_data 
ON google.calendar_events (usuario_id, data_inicio);

-- 6. Mostrar status final
SELECT 
    'Status da tabela calendar_events:' as info,
    COUNT(*) as total_eventos,
    COUNT(DISTINCT usuario_id) as usuarios_unicos,
    COUNT(DISTINCT event_id) as eventos_unicos,
    COUNT(*) FILTER (WHERE icaluid IS NOT NULL AND icaluid != '') as eventos_com_icaluid,
    COUNT(*) FILTER (WHERE icaluid IS NULL OR icaluid = '') as eventos_sem_icaluid
FROM google.calendar_events;

-- 7. Mostrar constraints atuais
SELECT 
    'Constraints atuais:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'google.calendar_events'::regclass; 