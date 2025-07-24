-- Remove a constraint antiga UNIQUE de file_id
ALTER TABLE google.drive_files DROP CONSTRAINT IF EXISTS drive_files_file_id_key;

-- Adiciona a constraint composta UNIQUE (file_id, usuario_id)
ALTER TABLE google.drive_files
ADD CONSTRAINT uk_drive_files_file_id_usuario_id
UNIQUE (file_id, usuario_id); 