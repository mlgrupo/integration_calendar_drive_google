-- Script simples para remover o índice único problemático do icaluid
-- Execute este script para resolver o erro de constraint

-- Remover o índice único problemático
DROP INDEX IF EXISTS google.idx_calendar_events_icaluid;
DROP INDEX IF EXISTS idx_calendar_events_icaluid;

-- Verificar se foi removido
SELECT 
    'Status após remoção:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'calendar_events' 
            AND schemaname = 'google' 
            AND indexname = 'idx_calendar_events_icaluid'
        ) THEN '❌ Índice ainda existe'
        ELSE '✅ Índice removido com sucesso'
    END as status; 