-- Script completo para corrigir todas as constraints da tabela calendar_events

-- 1. Verificar todas as constraints únicas atuais
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

-- 2. Remover TODAS as constraints únicas existentes
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'google' 
            AND tc.table_name = 'calendar_events'
            AND tc.constraint_type = 'UNIQUE'
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE google.calendar_events DROP CONSTRAINT "' || constraint_record.constraint_name || '"';
            RAISE NOTICE 'Constraint removida: %', constraint_record.constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao remover constraint %: %', constraint_record.constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Verificar se todas foram removidas
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

-- 4. Verificar se há dados duplicados que possam impedir a criação das constraints
SELECT 'Duplicatas por (icaluid, usuario_id):' as tipo, icaluid, usuario_id, COUNT(*) as total
FROM google.calendar_events 
WHERE icaluid IS NOT NULL AND icaluid != ''
GROUP BY icaluid, usuario_id 
HAVING COUNT(*) > 1
LIMIT 5;

SELECT 'Duplicatas por (event_id, usuario_id):' as tipo, event_id, usuario_id, COUNT(*) as total
FROM google.calendar_events 
GROUP BY event_id, usuario_id 
HAVING COUNT(*) > 1
LIMIT 5;

-- 5. Criar apenas as constraints corretas
-- Constraint para (icaluid, usuario_id) - para eventos com iCalUID
DO $$
BEGIN
    BEGIN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_icaluid_usuario_unique 
        UNIQUE (icaluid, usuario_id);
        RAISE NOTICE 'Constraint (icaluid, usuario_id) criada com sucesso';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao criar constraint (icaluid, usuario_id): %', SQLERRM;
    END;
END $$;

-- Constraint para (event_id, usuario_id) - para eventos sem iCalUID
DO $$
BEGIN
    BEGIN
        ALTER TABLE google.calendar_events 
        ADD CONSTRAINT calendar_events_event_id_usuario_unique 
        UNIQUE (event_id, usuario_id);
        RAISE NOTICE 'Constraint (event_id, usuario_id) criada com sucesso';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao criar constraint (event_id, usuario_id): %', SQLERRM;
    END;
END $$;

-- 6. Verificar constraints finais
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

-- 7. Resumo final
SELECT 
    'RESUMO FINAL' as status,
    COUNT(*) as total_constraints,
    STRING_AGG(tc.constraint_name, ', ') as constraint_names
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events'
    AND tc.constraint_type = 'UNIQUE'; 