const pool = require('../config/database');

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      webhooks: 0,
      syncs: 0,
      startTime: Date.now()
    };
    
    this.performance = {
      responseTimes: [],
      memoryUsage: [],
      cpuUsage: []
    };
  }

  // Incrementar contadores
  incrementRequest() {
    this.metrics.requests++;
  }

  incrementError() {
    this.metrics.errors++;
  }

  incrementWebhook() {
    this.metrics.webhooks++;
  }

  incrementSync() {
    this.metrics.syncs++;
  }

  // Registrar tempo de resposta
  recordResponseTime(time) {
    this.performance.responseTimes.push(time);
    if (this.performance.responseTimes.length > 1000) {
      this.performance.responseTimes.shift();
    }
  }

  // Registrar uso de memória
  recordMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.performance.memoryUsage.push({
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    });
    
    if (this.performance.memoryUsage.length > 100) {
      this.performance.memoryUsage.shift();
    }
  }

  // Obter estatísticas
  getStats() {
    const uptime = Date.now() - this.metrics.startTime;
    const avgResponseTime = this.performance.responseTimes.length > 0 
      ? this.performance.responseTimes.reduce((a, b) => a + b, 0) / this.performance.responseTimes.length 
      : 0;

    const currentMemory = process.memoryUsage();
    
    return {
      uptime: {
        milliseconds: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000)
      },
      metrics: {
        ...this.metrics,
        errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        currentMemory: {
          rss: Math.round(currentMemory.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(currentMemory.heapTotal / 1024 / 1024) + 'MB',
          external: Math.round(currentMemory.external / 1024 / 1024) + 'MB'
        },
        memoryHistory: this.performance.memoryUsage.slice(-10)
      }
    };
  }

  // Verificar saúde do banco de dados
  async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Verificar saúde das APIs do Google
  async checkGoogleAPIsHealth() {
    const results = {
      drive: { status: 'unknown', error: null },
      calendar: { status: 'unknown', error: null },
      admin: { status: 'unknown', error: null }
    };

    try {
      const { getDriveClient } = require('../config/googleJWT');
      const drive = await getDriveClient(process.env.ADMIN_EMAIL);
      await drive.about.get({ fields: 'user' });
      results.drive.status = 'healthy';
    } catch (error) {
      results.drive.status = 'unhealthy';
      results.drive.error = error.message;
    }

    try {
      const { getCalendarClient } = require('../config/googleJWT');
      const calendar = await getCalendarClient(process.env.ADMIN_EMAIL);
      await calendar.calendarList.list({ maxResults: 1 });
      results.calendar.status = 'healthy';
    } catch (error) {
      results.calendar.status = 'unhealthy';
      results.calendar.error = error.message;
    }

    return results;
  }

  // Obter relatório completo de saúde
  async getHealthReport() {
    const [dbHealth, googleHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkGoogleAPIsHealth()
    ]);

    return {
      timestamp: new Date().toISOString(),
      system: this.getStats(),
      database: dbHealth,
      googleAPIs: googleHealth,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  // Salvar métricas no banco
  async saveMetrics() {
    try {
      const stats = this.getStats();
      const timestamp = new Date();
      
      // Função para converter string de memória para número
      const parseMemoryValue = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          // Remove "MB" e converte para número
          const numValue = parseFloat(value.replace('MB', ''));
          return isNaN(numValue) ? 0 : numValue;
        }
        return 0;
      };
      
      // Salvar métricas individuais
      const metrics = [
        { type: 'requests', name: 'total', value: stats.metrics.requests },
        { type: 'errors', name: 'total', value: stats.metrics.errors },
        { type: 'webhooks', name: 'total', value: stats.metrics.webhooks },
        { type: 'syncs', name: 'total', value: stats.metrics.syncs },
        { type: 'performance', name: 'avg_response_time', value: stats.performance.avgResponseTime },
        { type: 'memory', name: 'heap_used_mb', value: parseMemoryValue(stats.performance.currentMemory.heapUsed) },
        { type: 'memory', name: 'heap_total_mb', value: parseMemoryValue(stats.performance.currentMemory.heapTotal) },
        { type: 'memory', name: 'rss_mb', value: parseMemoryValue(stats.performance.currentMemory.rss) },
        { type: 'memory', name: 'external_mb', value: parseMemoryValue(stats.performance.currentMemory.external) }
      ];

      // Inserir cada métrica individualmente
      for (const metric of metrics) {
        await pool.query(
          `INSERT INTO google.system_metrics 
           (timestamp, metric_type, metric_name, metric_value, metric_data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            timestamp,
            metric.type,
            metric.name,
            metric.value,
            JSON.stringify({ 
              timestamp: timestamp.toISOString(),
              original_value: stats.performance.currentMemory[metric.name.replace('_mb', '')] || metric.value
            })
          ]
        );
      }

      console.log(`✅ Métricas salvas: ${metrics.length} registros`);
    } catch (error) {
      console.error('Erro ao salvar métricas:', error);
    }
  }
}

// Instância singleton
const monitoringService = new MonitoringService();

// Coletar métricas periodicamente
setInterval(() => {
  monitoringService.recordMemoryUsage();
}, 60000); // A cada minuto

// Salvar métricas no banco periodicamente
setInterval(() => {
  monitoringService.saveMetrics();
}, 300000); // A cada 5 minutos

module.exports = monitoringService; 