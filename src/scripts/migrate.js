const pool = require('../config/database');

async function runMigrations() {
  try {
    console.log('🔄 Iniciando migrações do banco de dados...');

    // 1. Criar tabela de métricas do sistema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google.system_metrics (
        id SERIAL PRIMARY KEY,
        requests BIGINT DEFAULT 0,
        errors BIGINT DEFAULT 0,
        webhooks BIGINT DEFAULT 0,
        syncs BIGINT DEFAULT 0,
        avg_response_time INTEGER DEFAULT 0,
        memory_usage JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela system_metrics criada');

    // 2. Criar tabela de configurações do sistema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google.system_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela system_config criada');

    // 3. Adicionar colunas faltantes na tabela calendar_events
    await pool.query(`
      ALTER TABLE google.calendar_events 
      ADD COLUMN IF NOT EXISTS icaluid TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    console.log('✅ Colunas adicionadas em calendar_events');

    // 4. Remover constraints problemáticos
    await pool.query(`
      ALTER TABLE google.calendar_events 
      DROP CONSTRAINT IF EXISTS uk_calendar_events_event_id_usuario_id,
      DROP CONSTRAINT IF EXISTS idx_calendar_events_unique_event;
    `);
    console.log('✅ Constraints problemáticos removidos');

    // 5. Criar índices únicos corretos
    await pool.query(`
      DROP INDEX IF EXISTS google.idx_calendar_events_unique_icaluid;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique_icaluid 
      ON google.calendar_events (icaluid) WHERE icaluid IS NOT NULL;
    `);
    console.log('✅ Índice único em icaluid criado');

    // 6. Criar tabelas de canais de webhook
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google.drive_channels (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        resource_id TEXT UNIQUE NOT NULL,
        channel_id TEXT,
        page_token TEXT,
        atualizado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela drive_channels criada');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS google.calendar_channels (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        resource_id TEXT UNIQUE NOT NULL,
        channel_id TEXT,
        calendar_id TEXT,
        atualizado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela calendar_channels criada');

    // 7. Inserir configurações padrão
    await pool.query(`
      INSERT INTO google.system_config (key, value, description) VALUES
      ('webhook_cache_ttl', '300000', 'Cache TTL para webhooks em milissegundos'),
      ('max_retry_attempts', '3', 'Número máximo de tentativas de retry'),
      ('sync_batch_size', '100', 'Tamanho do lote para sincronização'),
      ('log_retention_days', '30', 'Dias para retenção de logs')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✅ Configurações padrão inseridas');

    // 8. Criar índices de performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at 
      ON google.system_metrics (created_at);
      
      CREATE INDEX IF NOT EXISTS idx_drive_channels_email 
      ON google.drive_channels (email);
      
      CREATE INDEX IF NOT EXISTS idx_calendar_channels_email 
      ON google.calendar_channels (email);
      
      CREATE INDEX IF NOT EXISTS idx_calendar_events_data_inicio 
      ON google.calendar_events (data_inicio);
      
      CREATE INDEX IF NOT EXISTS idx_calendar_events_usuario_id 
      ON google.calendar_events (usuario_id);
    `);
    console.log('✅ Índices de performance criados');

    console.log('🎉 Migrações concluídas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Migração finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations }; 