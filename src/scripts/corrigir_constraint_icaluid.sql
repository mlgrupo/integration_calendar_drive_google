-- Script para corrigir constraint única do icaluid

-- 1. Verificar constraints atuais
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
    AND (kcu.column_name = 'icaluid' OR tc.constraint_type = 'UNIQUE');

-- 2. Verificar duplicatas de icaluid
SELECT 
    icaluid,
    COUNT(*) as total,
    STRING_AGG(event_id || ' (' || usuario_id || ')', ', ') as eventos
FROM google.calendar_events 
WHERE icaluid IS NOT NULL 
    AND icaluid != ''
GROUP BY icaluid 
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- 3. Verificar se existe constraint única no icaluid
SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'google' 
        AND tc.table_name = 'calendar_events'
        AND kcu.column_name = 'icaluid'
        AND tc.constraint_type = 'UNIQUE'
) as tem_constraint_icaluid;

-- 4. Se existir constraint única no icaluid, remover
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'google' 
            AND tc.table_name = 'calendar_events'
            AND kcu.column_name = 'icaluid'
            AND tc.constraint_type = 'UNIQUE'
    ) THEN
        -- Encontrar o nome da constraint
        DECLARE
            constraint_name text;
        BEGIN
            SELECT tc.constraint_name INTO constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'google' 
                AND tc.table_name = 'calendar_events'
                AND kcu.column_name = 'icaluid'
                AND tc.constraint_type = 'UNIQUE';
            
            EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT ' || constraint_name;
            RAISE NOTICE 'Constraint única removida: %', constraint_name;
        END;
    ELSE
        RAISE NOTICE 'Nenhuma constraint única encontrada no icaluid';
    END IF;
END $$;

-- 5. Criar constraint única composta (icaluid, usuario_id) se não existir
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

-- 6. Garantir que existe constraint única em (event_id, usuario_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'google' 
            AND tc.table_name = 'calendar_events'
            AND tc.constraint_type = 'UNIQUE'
            AND tc.constraint_name LIKE '%event_id%'
    ) THEN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_event_id_usuario_unique 
        UNIQUE (event_id, usuario_id);
        RAISE NOTICE 'Constraint única criada: (event_id, usuario_id)';
    ELSE
        RAISE NOTICE 'Constraint única (event_id, usuario_id) já existe';
    END IF;
END $$;

-- 7. Verificar constraints finais
SELECT 
    tc.constraint_name,
    tc.table_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.table_name, tc.constraint_type
ORDER BY tc.constraint_name;

-- 8. Estatísticas da tabela
SELECT 
    COUNT(*) as total_eventos,
    COUNT(DISTINCT icaluid) as icaluids_unicos,
    COUNT(DISTINCT event_id) as event_ids_unicos,
    COUNT(DISTINCT usuario_id) as usuarios_unicos,
    COUNT(*) FILTER (WHERE icaluid IS NOT NULL AND icaluid != '') as eventos_com_icaluid,
    COUNT(*) FILTER (WHERE icaluid IS NULL OR icaluid = '') as eventos_sem_icaluid
FROM google.calendar_events; 