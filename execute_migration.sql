-- Executar migração para criar tabelas do sistema
-- Execute este script no seu banco PostgreSQL

BEGIN;

-- 1. Criar tabela de métricas do sistema
CREATE TABLE IF NOT EXISTS google.system_metrics (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  metric_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp 
ON google.system_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type_name 
ON google.system_metrics(metric_type, metric_name);

-- 3. Criar tabela de configuração do sistema
CREATE TABLE IF NOT EXISTS google.system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  config_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Inserir configurações padrão
INSERT INTO google.system_config (config_key, config_value, config_type, description) 
VALUES 
  ('webhook_enabled', 'true', 'boolean', 'Status dos webhooks (true/false)'),
  ('webhook_cache_ttl', '300000', 'number', 'TTL do cache de webhooks em ms'),
  ('sync_batch_size', '100', 'number', 'Tamanho do lote para sincronização'),
  ('log_level', 'info', 'string', 'Nível de log (debug, info, warn, error)'),
  ('auto_renewal_enabled', 'true', 'boolean', 'Renovação automática de webhooks'),
  ('monitoring_enabled', 'true', 'boolean', 'Monitoramento do sistema')
ON CONFLICT (config_key) DO NOTHING;

-- 5. Verificar se as tabelas foram criadas
SELECT 'system_metrics' as table_name, COUNT(*) as row_count FROM google.system_metrics
UNION ALL
SELECT 'system_config' as table_name, COUNT(*) as row_count FROM google.system_config;

COMMIT;

-- Mensagem de sucesso
SELECT '✅ Migração concluída com sucesso!' as status; 