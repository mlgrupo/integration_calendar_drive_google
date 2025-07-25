-- Script para adicionar a coluna icaluid se não existir
DO $$
BEGIN
    -- Verificar se a coluna icaluid existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_events' 
        AND column_name = 'icaluid'
    ) THEN
        -- Adicionar a coluna icaluid
        ALTER TABLE google.calendar_events ADD COLUMN icaluid TEXT;
        RAISE NOTICE 'Coluna icaluid adicionada à tabela calendar_events';
    ELSE
        RAISE NOTICE 'Coluna icaluid já existe na tabela calendar_events';
    END IF;
END $$; 