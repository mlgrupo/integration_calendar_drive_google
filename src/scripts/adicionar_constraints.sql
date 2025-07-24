-- Script para adicionar constraints únicas necessárias para o ON CONFLICT
-- Execute este script após criar as tabelas com nova_estrutura_banco.sql

-- Constraint única para drive_files (file_id + usuario_id)
ALTER TABLE google.drive_files 
ADD CONSTRAINT uk_drive_files_file_id_usuario_id 
UNIQUE (file_id, usuario_id);

-- Constraint única para drive_folders (folder_id + usuario_id)
ALTER TABLE google.drive_folders 
ADD CONSTRAINT uk_drive_folders_folder_id_usuario_id 
UNIQUE (folder_id, usuario_id);

-- Constraint única para calendar_events (event_id + usuario_id)
ALTER TABLE google.calendar_events 
ADD CONSTRAINT uk_calendar_events_event_id_usuario_id 
UNIQUE (event_id, usuario_id);

-- Constraint única para calendar_reunioes (event_id + usuario_id)
ALTER TABLE google.calendar_reunioes 
ADD CONSTRAINT uk_calendar_reunioes_event_id_usuario_id 
UNIQUE (event_id, usuario_id);

-- Constraint única para eventos_drive (recurso_id + usuario_id)
ALTER TABLE google.eventos_drive 
ADD CONSTRAINT uk_eventos_drive_recurso_id_usuario_id 
UNIQUE (recurso_id, usuario_id);

-- Constraint única para eventos_calendar (recurso_id + usuario_id)
ALTER TABLE google.eventos_calendar 
ADD CONSTRAINT uk_eventos_calendar_recurso_id_usuario_id 
UNIQUE (recurso_id, usuario_id);

-- Verificar se as constraints foram criadas
SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name; 