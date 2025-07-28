-- Script para verificar todos os índices da tabela calendar_events
-- Execute este script para ver o que está causando o problema

-- 1. Verificar todos os índices
SELECT 
    'Todos os índices da tabela calendar_events:' as info,
    indexname,
    indexdef,
    CASE 
        WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
        ELSE 'NORMAL'
    END as tipo
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
ORDER BY indexname;

-- 2. Verificar constraints únicas
SELECT 
    'Constraints únicas da tabela calendar_events:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'google.calendar_events'::regclass
AND contype = 'u';

-- 3. Verificar especificamente o índice problemático
SELECT 
    'Verificação específica do índice problemático:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'calendar_events' 
            AND schemaname = 'google' 
            AND indexname = 'idx_calendar_events_icaluid'
        ) THEN '❌ PROBLEMA: Índice idx_calendar_events_icaluid ainda existe'
        ELSE '✅ OK: Índice idx_calendar_events_icaluid não existe'
    END as status;

-- 4. Verificar se há outros índices únicos em icaluid
SELECT 
    'Índices únicos que contêm icaluid:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND schemaname = 'google'
AND indexname LIKE '%icaluid%'
AND indexdef LIKE '%UNIQUE%'; 