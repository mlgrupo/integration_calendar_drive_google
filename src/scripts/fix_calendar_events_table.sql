-- Script para corrigir a tabela calendar_events
-- Execute este script no seu banco PostgreSQL

-- 1. Verificar estrutura atual da tabela
\d google.calendar_events;

-- 2. Verificar se há dados na tabela
SELECT COUNT(*) FROM google.calendar_events;

-- 3. Verificar constraints atuais
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'google' 
    AND tc.table_name = 'calendar_events';

-- 4. Verificar sequência do campo id
SELECT 
    sequence_name,
    last_value,
    is_called
FROM information_schema.sequences 
WHERE sequence_name LIKE '%calendar_events%';

-- 5. Corrigir a sequência se necessário
-- Se a sequência não estiver sincronizada com os dados existentes
SELECT setval(
    pg_get_serial_sequence('google.calendar_events', 'id'), 
    COALESCE((SELECT MAX(id) FROM google.calendar_events), 1)
);

-- 6. Adicionar coluna icaluid se não existir
ALTER TABLE google.calendar_events 
ADD COLUMN IF NOT EXISTS icaluid TEXT;

-- 7. Criar índices únicos corretos
-- Remover índices únicos problemáticos se existirem
DROP INDEX IF EXISTS google.idx_calendar_events_unique_event;
DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;

-- Criar índice único para event_id + usuario_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_event 
ON google.calendar_events (event_id, usuario_id);

-- Criar índice único para icaluid (apenas se não for null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;

-- 8. Verificar se o campo id é realmente SERIAL
-- Se não for, recriar a tabela
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'google' 
            AND table_name = 'calendar_events' 
            AND column_name = 'id' 
            AND column_default LIKE 'nextval%'
    ) THEN
        RAISE NOTICE 'Campo id não é autoincremento. Recrie a tabela.';
    ELSE
        RAISE NOTICE 'Campo id está correto (autoincremento).';
    END IF;
END $$;

-- 9. Se precisar recriar a tabela (execute apenas se necessário):
/*
-- Fazer backup dos dados
CREATE TABLE google.calendar_events_backup AS 
SELECT * FROM google.calendar_events;

-- Recriar tabela com estrutura correta
DROP TABLE google.calendar_events CASCADE;

CREATE TABLE google.calendar_events (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  icaluid TEXT,
  titulo TEXT,
  descricao TEXT,
  localizacao TEXT,
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  duracao_minutos INTEGER,
  recorrente BOOLEAN DEFAULT FALSE,
  recorrencia TEXT,
  calendario_id TEXT,
  calendario_nome TEXT,
  status TEXT DEFAULT 'confirmed',
  visibilidade TEXT DEFAULT 'default',
  transparencia TEXT DEFAULT 'opaque',
  convidados JSONB,
  organizador_email TEXT,
  organizador_nome TEXT,
  criado_em TIMESTAMP,
  modificado_em TIMESTAMP,
  dados_completos JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Restaurar dados (sem o campo id para deixar o banco gerar)
INSERT INTO google.calendar_events (
  usuario_id, event_id, icaluid, titulo, descricao, localizacao, 
  data_inicio, data_fim, duracao_minutos, recorrente, recorrencia, 
  calendario_id, calendario_nome, status, visibilidade, transparencia, 
  convidados, organizador_email, organizador_nome, criado_em, 
  modificado_em, dados_completos, created_at, updated_at
)
SELECT 
  usuario_id, event_id, icaluid, titulo, descricao, localizacao, 
  data_inicio, data_fim, duracao_minutos, recorrente, recorrencia, 
  calendario_id, calendario_nome, status, visibilidade, transparencia, 
  convidados, organizador_email, organizador_nome, criado_em, 
  modificado_em, dados_completos, created_at, updated_at
FROM google.calendar_events_backup;

-- Remover backup
DROP TABLE google.calendar_events_backup;

-- Recriar índices
CREATE INDEX idx_calendar_events_usuario_id ON google.calendar_events (usuario_id);
CREATE INDEX idx_calendar_events_event_id ON google.calendar_events (event_id);
CREATE INDEX idx_calendar_events_icaluid ON google.calendar_events (icaluid);
CREATE INDEX idx_calendar_events_data_inicio ON google.calendar_events (data_inicio);
CREATE INDEX idx_calendar_events_calendario_id ON google.calendar_events (calendario_id);

CREATE UNIQUE INDEX idx_calendar_events_unique_event 
ON google.calendar_events (event_id, usuario_id);

CREATE UNIQUE INDEX idx_calendar_events_unique_icaluid 
ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;
*/ 