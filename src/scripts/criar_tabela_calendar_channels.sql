-- Script para criar a tabela calendar_channels se não existir

-- 1. Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'google' 
        AND table_name = 'calendar_channels'
    ) THEN
        -- Criar a tabela calendar_channels
        CREATE TABLE google.calendar_channels (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            resource_id VARCHAR(255) NOT NULL,
            channel_id VARCHAR(255) NOT NULL,
            calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            active BOOLEAN DEFAULT true
        );
        
        -- Criar índices
        CREATE INDEX idx_calendar_channels_usuario_id ON google.calendar_channels(usuario_id);
        CREATE INDEX idx_calendar_channels_resource_id ON google.calendar_channels(resource_id);
        CREATE INDEX idx_calendar_channels_channel_id ON google.calendar_channels(channel_id);
        CREATE INDEX idx_calendar_channels_active ON google.calendar_channels(active);
        
        -- Criar constraint único
        ALTER TABLE google.calendar_channels 
        ADD CONSTRAINT calendar_channels_usuario_calendar_unique 
        UNIQUE (usuario_id, calendar_id);
        
        RAISE NOTICE 'Tabela google.calendar_channels criada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela google.calendar_channels já existe!';
    END IF;
END $$;

-- 2. Verificar se a tabela drive_channels existe também
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'google' 
        AND table_name = 'drive_channels'
    ) THEN
        -- Criar a tabela drive_channels
        CREATE TABLE google.drive_channels (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            resource_id VARCHAR(255) NOT NULL,
            channel_id VARCHAR(255) NOT NULL,
            page_token VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            active BOOLEAN DEFAULT true
        );
        
        -- Criar índices
        CREATE INDEX idx_drive_channels_usuario_id ON google.drive_channels(usuario_id);
        CREATE INDEX idx_drive_channels_resource_id ON google.drive_channels(resource_id);
        CREATE INDEX idx_drive_channels_channel_id ON google.drive_channels(channel_id);
        CREATE INDEX idx_drive_channels_active ON google.drive_channels(active);
        
        -- Criar constraint único
        ALTER TABLE google.drive_channels 
        ADD CONSTRAINT drive_channels_usuario_unique 
        UNIQUE (usuario_id);
        
        RAISE NOTICE 'Tabela google.drive_channels criada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela google.drive_channels já existe!';
    END IF;
END $$;

-- 3. Mostrar estrutura das tabelas
SELECT 
    'calendar_channels' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'google' 
AND table_name = 'calendar_channels'
ORDER BY ordinal_position;

SELECT 
    'drive_channels' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'google' 
AND table_name = 'drive_channels'
ORDER BY ordinal_position; 