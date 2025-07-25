-- Script para corrigir duplicatas do Calendar e garantir estrutura correta

-- 1. Verificar se a coluna icaluid existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_events' 
        AND column_name = 'icaluid'
    ) THEN
        ALTER TABLE google.calendar_events ADD COLUMN icaluid VARCHAR(255);
        RAISE NOTICE 'Coluna icaluid adicionada';
    ELSE
        RAISE NOTICE 'Coluna icaluid já existe';
    END IF;
END $$;

-- 2. Remover duplicatas existentes (manter apenas a mais recente)
DELETE FROM google.calendar_events 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM google.calendar_events 
    GROUP BY event_id, usuario_id
);

-- 3. Criar constraint único para icaluid (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_icaluid_unique'
    ) THEN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_icaluid_unique 
        UNIQUE (icaluid);
        RAISE NOTICE 'Constraint único para icaluid criado';
    ELSE
        RAISE NOTICE 'Constraint único para icaluid já existe';
    END IF;
END $$;

-- 4. Garantir que o constraint (event_id, usuario_id) existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_event_id_usuario_id_unique'
    ) THEN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_event_id_usuario_id_unique 
        UNIQUE (event_id, usuario_id);
        RAISE NOTICE 'Constraint único para (event_id, usuario_id) criado';
    ELSE
        RAISE NOTICE 'Constraint único para (event_id, usuario_id) já existe';
    END IF;
END $$;

-- 5. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_icaluid ON google.calendar_events(icaluid);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON google.calendar_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_id ON google.calendar_events(usuario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_data_inicio ON google.calendar_events(data_inicio);

-- 6. Mostrar estatísticas
SELECT 
    'Total de eventos' as info,
    COUNT(*) as total
FROM google.calendar_events
UNION ALL
SELECT 
    'Eventos com icaluid' as info,
    COUNT(*) as total
FROM google.calendar_events 
WHERE icaluid IS NOT NULL
UNION ALL
SELECT 
    'Eventos sem icaluid' as info,
    COUNT(*) as total
FROM google.calendar_events 
WHERE icaluid IS NULL
UNION ALL
SELECT 
    'Duplicatas por event_id' as info,
    COUNT(*) as total
FROM (
    SELECT event_id, usuario_id, COUNT(*) as cnt
    FROM google.calendar_events
    GROUP BY event_id, usuario_id
    HAVING COUNT(*) > 1
) duplicatas; 