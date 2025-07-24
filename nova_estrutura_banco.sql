-- SCHEMA
CREATE SCHEMA IF NOT EXISTS google;

-- ===== TABELAS DE USUÁRIOS =====
CREATE TABLE IF NOT EXISTS google.usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TABELAS DO GOOGLE DRIVE =====

CREATE TABLE IF NOT EXISTS google.drive_folders (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    folder_id VARCHAR(255) NOT NULL,
    nome VARCHAR(500) NOT NULL,
    caminho_completo TEXT,
    parent_folder_id VARCHAR(255),
    cor_rgb VARCHAR(10),
    compartilhado BOOLEAN DEFAULT FALSE,
    visibilidade VARCHAR(50),
    permissoes JSONB,
    criado_em TIMESTAMP,
    modificado_em TIMESTAMP,
    ultimo_acesso TIMESTAMP,
    tamanho_total BIGINT DEFAULT 0,
    quantidade_arquivos INTEGER DEFAULT 0,
    quantidade_subpastas INTEGER DEFAULT 0,
    dados_completos JSONB,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_drive_folders_folder_id_usuario_id UNIQUE (folder_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS google.drive_files (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    file_id VARCHAR(255) NOT NULL,
    nome VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    tamanho BIGINT,
    folder_id VARCHAR(255),
    caminho_completo TEXT,
    dono_email VARCHAR(255),
    compartilhado BOOLEAN DEFAULT FALSE,
    visibilidade VARCHAR(50),
    permissoes JSONB,
    criado_em TIMESTAMP,
    modificado_em TIMESTAMP,
    ultimo_acesso TIMESTAMP,
    versao INTEGER DEFAULT 1,
    md5_checksum VARCHAR(32),
    web_view_link TEXT,
    download_link TEXT,
    thumbnail_link TEXT,
    starred BOOLEAN DEFAULT FALSE,
    trashed BOOLEAN DEFAULT FALSE,
    tipo_arquivo VARCHAR(100),
    extensao VARCHAR(255),
    dados_completos JSONB,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_drive_files_file_id_usuario_id UNIQUE (file_id, usuario_id)
);

-- ===== TABELAS DO GOOGLE CALENDAR =====

CREATE TABLE IF NOT EXISTS google.calendar_events (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    event_id VARCHAR(255) NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT,
    localizacao VARCHAR(500),
    data_inicio TIMESTAMP,
    data_fim TIMESTAMP,
    duracao_minutos INTEGER,
    recorrente BOOLEAN DEFAULT FALSE,
    recorrencia TEXT,
    calendario_id VARCHAR(255),
    calendario_nome VARCHAR(255),
    status VARCHAR(50),
    visibilidade VARCHAR(50),
    transparencia VARCHAR(50),
    convidados JSONB,
    organizador_email VARCHAR(255),
    organizador_nome VARCHAR(255),
    criado_em TIMESTAMP,
    modificado_em TIMESTAMP,
    dados_completos JSONB,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_calendar_events_event_id_usuario_id UNIQUE (event_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS google.calendar_reunioes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    event_id VARCHAR(255) NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT,
    tipo_reuniao VARCHAR(100),
    link_reuniao TEXT,
    codigo_acesso VARCHAR(50),
    senha VARCHAR(100),
    data_inicio TIMESTAMP,
    data_fim TIMESTAMP,
    duracao_minutos INTEGER,
    participantes JSONB,
    organizador_email VARCHAR(255),
    organizador_nome VARCHAR(255),
    status VARCHAR(50),
    gravacao_disponivel BOOLEAN DEFAULT FALSE,
    link_gravacao TEXT,
    transcricao_disponivel BOOLEAN DEFAULT FALSE,
    link_transcricao TEXT,
    dados_completos JSONB,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_calendar_reunioes_event_id_usuario_id UNIQUE (event_id, usuario_id)
);

-- ===== TABELAS DE LOGS DE EVENTOS =====

CREATE TABLE IF NOT EXISTS google.eventos_drive (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    tipo_evento VARCHAR(100) NOT NULL,
    recurso_tipo VARCHAR(50),
    recurso_id VARCHAR(255),
    detalhes TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_origem VARCHAR(45),
    user_agent TEXT,
    timestamp_evento TIMESTAMP,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google.eventos_calendar (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    tipo_evento VARCHAR(100) NOT NULL,
    recurso_tipo VARCHAR(50),
    recurso_id VARCHAR(255),
    detalhes TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_origem VARCHAR(45),
    user_agent TEXT,
    timestamp_evento TIMESTAMP,
    criado_no_banco TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TABELA DE LOGS GENÉRICA (COM CAMPO TIPO) =====
CREATE TABLE IF NOT EXISTS google.logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    tipo VARCHAR(100),
    descricao TEXT,
    detalhes TEXT,
    erro BOOLEAN DEFAULT FALSE,
    dados_raw JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TABELA DE LOGS DE AUDITORIA =====
CREATE TABLE IF NOT EXISTS google.logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES google.usuarios(id),
    acao VARCHAR(255),
    detalhes TEXT,
    erro BOOLEAN DEFAULT FALSE,
    dados_raw JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== ÍNDICES PARA PERFORMANCE =====
CREATE INDEX IF NOT EXISTS idx_drive_folders_usuario ON google.drive_folders(usuario_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON google.drive_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_usuario ON google.drive_files(usuario_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON google.drive_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_tipo ON google.drive_files(tipo_arquivo);
CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario ON google.calendar_events(usuario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_data ON google.calendar_events(data_inicio);
CREATE INDEX IF NOT EXISTS idx_calendar_reunioes_usuario ON google.calendar_reunioes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reunioes_data ON google.calendar_reunioes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_eventos_drive_usuario ON google.eventos_drive(usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_drive_timestamp ON google.eventos_drive(timestamp_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_calendar_usuario ON google.eventos_calendar(usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_calendar_timestamp ON google.eventos_calendar(timestamp_evento); 