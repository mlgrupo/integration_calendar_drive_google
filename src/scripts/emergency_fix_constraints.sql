-- SCRIPT DE EMERGÊNCIA - Remover constraints problemáticos
-- Execute este script para parar os loops infinitos de erros

-- 1. Remover constraint único problemático de (event_id, usuario_id)
ALTER TABLE google.calendar_events 
DROP CONSTRAINT IF EXISTS uk_calendar_events_event_id_usuario_id;

-- 2. Remover índice único problemático se existir
DROP INDEX IF EXISTS google.uk_calendar_events_event_id_usuario_id;
DROP INDEX IF EXISTS uk_calendar_events_event_id_usuario_id;

-- 3. Verificar se ainda existe algum constraint único problemático
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

-- 4. Manter apenas o índice único em icaluid (que é o correto)
-- Se não existir, criar
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 5. Verificar resultado
SELECT 'Constraints removidos com sucesso!' as status; 