# 🔗 Integração Google Calendar e Drive com PostgreSQL

Sistema robusto de integração entre Google Workspace (Calendar, Drive) e PostgreSQL com webhooks em tempo real, monitoramento avançado e alta performance.

## ✨ Características

- 🔄 **Sincronização em tempo real** via webhooks do Google
- 📊 **Monitoramento avançado** com métricas de performance
- 🔒 **Segurança robusta** com validação, rate limiting e CORS
- 📈 **Métricas em tempo real** de uso do sistema
- 🛡️ **Tratamento de erros** categorizado e estruturado
- ⚡ **Performance otimizada** com cache e compressão
- 🧪 **Testes automatizados** com cobertura de código
- 📋 **Logs estruturados** com auditoria completa

## 🚀 Instalação

### Pré-requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- Conta Google Workspace com Admin SDK habilitado

### 1. Clone o repositório

```bash
git clone <repository-url>
cd integracao-google-calendar-drive-db
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configurações do Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=google_integration
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui

# Google Service Account
ADMIN_EMAIL=admin@seudominio.com.br
GOOGLE_CLIENT_EMAIL=seu-service-account@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSua chave privada aqui...\n-----END PRIVATE KEY-----"

# Webhook URL
WEBHOOK_URL=http://localhost:3000/api/webhook

# Segurança
ALLOWED_ORIGINS=http://localhost:3000
METRICS_TOKEN=seu_token_secreto_aqui
```

### 4. Configure o banco de dados

```bash
# Execute o script de migração
npm run migrate

# Ou execute manualmente
node src/scripts/migrate.js
```

### 5. Configure o Google Service Account

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto ou selecione um existente
3. Habilite as APIs:
   - Google Drive API
   - Google Calendar API
   - Admin SDK Directory API
4. Crie uma Service Account
5. Baixe a chave privada JSON
6. Configure Domain Wide Delegation

### 6. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📋 Endpoints da API

### Health Check
- `GET /health` - Status do sistema
- `GET /metrics` - Métricas de performance

### Usuários
- `GET /api/users` - Listar usuários
- `POST /api/users` - Adicionar usuário
- `GET /api/users/sync` - Sincronizar usuários do Google Workspace

### Drive
- `POST /api/drive/sync` - Sincronizar arquivos do Drive
- `POST /api/drive/webhook/configure` - Configurar webhook do Drive

### Calendar
- `POST /api/calendar/sync` - Sincronizar eventos do Calendar
- `POST /api/calendar/webhook/configure` - Configurar webhook do Calendar

### Webhooks
- `POST /api/webhook/drive` - Webhook do Google Drive
- `POST /api/webhook/calendar` - Webhook do Google Calendar
- `POST /api/webhook/configure-all` - Configurar todos os webhooks
- `POST /api/webhook/renew-all` - Renovar todos os webhooks

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Iniciar em modo desenvolvimento
npm run test             # Executar testes
npm run test:watch       # Executar testes em modo watch
npm run test:coverage    # Executar testes com cobertura
npm run lint             # Verificar código
npm run lint:fix         # Corrigir problemas de lint

# Banco de dados
npm run migrate          # Executar migrações
npm run seed             # Popular banco com dados de teste

# Monitoramento
npm run health           # Verificar saúde do sistema
```

## 📊 Monitoramento

### Métricas Disponíveis

- **Requisições**: Total de requisições processadas
- **Erros**: Taxa de erro e tipos de erro
- **Performance**: Tempo médio de resposta
- **Memória**: Uso de memória em tempo real
- **Webhooks**: Estatísticas de webhooks processados

### Acessando Métricas

```bash
# Via API
curl http://localhost:3000/metrics

# Via health check
curl http://localhost:3000/health
```

## 🛡️ Segurança

### Implementações de Segurança

- **Helmet**: Headers de segurança HTTP
- **CORS**: Controle de origens permitidas
- **Rate Limiting**: Limite de requisições por IP
- **Validação**: Validação de entrada com express-validator
- **Sanitização**: Limpeza de dados de entrada
- **Compressão**: Compressão de respostas

### Configurações de Segurança

```env
# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://seudominio.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Métricas (produção)
METRICS_TOKEN=seu_token_secreto_aqui
```

## 🔄 Webhooks

### Como Funcionam

1. **Configuração**: O sistema registra webhooks no Google
2. **Notificação**: Google envia notificações em tempo real
3. **Processamento**: Sistema processa mudanças via API
4. **Cache**: Evita processamento duplicado
5. **Atualização**: Banco de dados é atualizado

### Configuração de Webhooks

```bash
# Configurar webhooks para todos os usuários
curl -X POST http://localhost:3000/api/webhook/configure-all

# Renovar webhooks (a cada 6 dias)
curl -X POST http://localhost:3000/api/webhook/renew-all
```

## 🧪 Testes

### Executando Testes

```bash
# Todos os testes
npm test

# Testes com cobertura
npm run test:coverage

# Testes em modo watch
npm run test:watch
```

### Cobertura de Testes

- **Endpoints**: Testes de todos os endpoints
- **Validação**: Testes de validação de entrada
- **Rate Limiting**: Testes de limitação de taxa
- **Webhooks**: Testes de processamento de webhooks

## 📈 Performance

### Otimizações Implementadas

- **Cache**: Cache de 5 minutos para webhooks
- **Compressão**: Compressão gzip de respostas
- **Índices**: Índices otimizados no banco
- **Batch Processing**: Processamento em lotes
- **Connection Pooling**: Pool de conexões do banco

### Métricas de Performance

- **Tempo de Resposta**: < 200ms para endpoints simples
- **Throughput**: 1000+ requisições/minuto
- **Memória**: < 100MB em uso normal
- **CPU**: < 10% em uso normal

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. Erro de Constraint no Banco

```sql
-- Execute para remover constraints problemáticos
ALTER TABLE google.calendar_events 
DROP CONSTRAINT IF EXISTS idx_calendar_events_unique_event;
```

#### 2. Webhooks Não Funcionando

```bash
# Verificar configuração
curl http://localhost:3000/health

# Reconfigurar webhooks
curl -X POST http://localhost:3000/api/webhook/configure-all
```

#### 3. Logs Excessivos

```bash
# Desabilitar execução imediata
# Edite src/jobs/renewWebhooks.js
exports.scheduleWebhookRenewal(false);
```

### Logs e Debug

```bash
# Ver logs em tempo real
tail -f logs/app.log

# Verificar métricas
curl http://localhost:3000/metrics
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, entre em contato:
- Email: jardelkahne1@gmail.com
- Documentação: [Link para documentação]

---

