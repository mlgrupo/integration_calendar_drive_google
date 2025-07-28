-- Script para remover TODOS os índices únicos problemáticos do icaluid
-- Execute este script para resolver definitivamente o erro de constraint

-- 1. Verificar todos os índices únicos que contêm icaluid
SELECT 
    'Índices únicos problemáticos encontrados:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
AND indexname LIKE '%icaluid%'
AND indexdef LIKE '%UNIQUE%';

-- 2. Remover TODOS os índices únicos que contêm icaluid
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

-- 3. Remover também por nomes específicos conhecidos
DROP INDEX IF EXISTS google.idx_calendar_events_icaluid;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_unique_icaluid;

-- 4. Verificar se ainda existem índices únicos problemáticos
SELECT 
    'Verificação final - Índices únicos restantes:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
AND indexdef LIKE '%UNIQUE%';

-- 5. Criar índice normal (não único) para icaluid
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid_normal 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 6. Status final
SELECT 
    '✅ PROBLEMA RESOLVIDO - Status final:' as info,
    'Todos os índices únicos de icaluid foram removidos' as acao,
    'Índice normal criado para busca por icaluid' as index_status; 