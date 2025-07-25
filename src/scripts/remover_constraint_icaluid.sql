-- Script para remover a constraint problemática do icaluid

-- 1. Verificar constraints atuais
SELECT 
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND kcu.column_name = 'icaluid'
    AND tc.constraint_type = 'UNIQUE';

-- 2. Remover a constraint problemática especificamente
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Encontrar a constraint problemática
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'google' 
        AND tc.table_name = 'calendar_events'
        AND kcu.column_name = 'icaluid'
        AND tc.constraint_type = 'UNIQUE';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT "' || constraint_name || '"';
        RAISE NOTICE 'Constraint removida: %', constraint_name;
    ELSE
        RAISE NOTICE 'Nenhuma constraint única encontrada no icaluid';
    END IF;
END $$;

-- 3. Verificar se foi removida
SELECT 
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND kcu.column_name = 'icaluid'
    AND tc.constraint_type = 'UNIQUE';

-- 4. Criar constraint composta se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'google' 
            AND tc.table_name = 'calendar_events'
            AND tc.constraint_type = 'UNIQUE'
            AND tc.constraint_name LIKE '%icaluid%'
    ) THEN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_icaluid_usuario_unique 
        UNIQUE (icaluid, usuario_id);
        RAISE NOTICE 'Constraint única composta criada: (icaluid, usuario_id)';
    ELSE
        RAISE NOTICE 'Constraint única composta já existe';
    END IF;
END $$;

-- 5. Verificar constraints finais
SELECT 
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_name; 