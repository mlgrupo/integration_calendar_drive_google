# Webhooks em Tempo Real - Google Drive

Este sistema permite receber notificações em tempo real quando arquivos são criados, modificados, renomeados ou removidos no Google Drive.

## 🚀 Como Funciona

1. **Configuração**: O sistema configura webhooks para cada usuário do domínio
2. **Notificações**: Quando um arquivo é alterado, o Google envia uma notificação para nosso servidor
3. **Processamento**: O sistema processa a mudança e atualiza o banco de dados automaticamente
4. **Logs**: Todas as mudanças são registradas para auditoria

## 📋 Pré-requisitos

### 1. URL Pública
Você precisa de uma URL pública para receber as notificações do Google:

```bash
# Exemplo de URLs válidas:
https://seu-dominio.com/webhook/drive
https://api.seudominio.com/webhooks/drive
https://webhook.site/your-unique-url
```

### 2. Variável de Ambiente
Configure a URL do webhook no arquivo `.env`:

```env
WEBHOOK_URL=https://seu-dominio.com/webhook
```

## 🔧 Configuração

### 1. Configurar Webhooks para Todos os Usuários

```bash
# Executar o script de configuração
node src/scripts/configurar-webhooks.js
```

### 2. Configurar Webhook para um Usuário Específico

```bash
# Via API
curl -X POST "http://localhost:3000/api/webhook/configurar/leorosso@reconectaoficial.com.br"

# Via script
node src/scripts/configurar-webhooks.js --test leorosso@reconectaoficial.com.br
```

### 3. Verificar Status dos Webhooks

```bash
curl -X GET "http://localhost:3000/api/webhook/status"
```

## 📡 Endpoints de Webhook

### Receber Notificações do Drive
```
POST /api/webhook/drive
```

**Exemplo de payload recebido:**
```json
{
  "changes": [
    {
      "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      "removed": false
    }
  ]
}
```

### Forçar Renovação de Webhooks
```
POST /api/webhook/renovar
```

### Verificar Status
```
GET /api/webhook/status
```

## 🔄 Renovação Automática

Os webhooks do Google Drive expiram após 7 dias. O sistema renova automaticamente:

- **Frequência**: A cada 6 dias às 2h da manhã
- **Configuração**: Automática via cron job
- **Logs**: Todas as renovações são registradas

## 📊 Logs e Auditoria

Todas as mudanças são registradas na tabela `drive_events`:

```sql
-- Exemplo de log
INSERT INTO drive_events (
  usuario_id, tipo_evento, recurso_tipo, recurso_id, 
  detalhes, dados_novos, timestamp_evento
) VALUES (
  1, 'criado', 'file', 'file-id-123',
  'Mudança em tempo real via webhook: documento.pdf (criado)',
  '{"id": "file-id-123", "name": "documento.pdf", ...}',
  NOW()
);
```

## 🧪 Testando

### 1. Teste Manual
```bash
# Configurar webhook de teste
curl -X POST "http://localhost:3000/api/webhook/configurar/leorosso@reconectaoficial.com.br"

# Criar/modificar um arquivo no Drive e verificar os logs
```

### 2. Teste via Script
```bash
# Testar webhook para um usuário específico
node src/scripts/configurar-webhooks.js --test leorosso@reconectaoficial.com.br
```

### 3. Verificar Logs
```bash
# Ver logs em tempo real
tail -f logs/app.log

# Ver logs no banco de dados
SELECT * FROM drive_events ORDER BY timestamp_evento DESC LIMIT 10;
```

## 🚨 Troubleshooting

### Webhook não está funcionando?

1. **Verificar URL pública**:
   ```bash
   curl -X GET "https://seu-dominio.com/webhook/drive"
   ```

2. **Verificar logs do servidor**:
   ```bash
   tail -f logs/app.log | grep "WEBHOOK"
   ```

3. **Verificar configuração do Google**:
   - Domain Wide Delegation configurado
   - Service Account com permissões adequadas

4. **Renovar webhooks manualmente**:
   ```bash
   curl -X POST "http://localhost:3000/api/webhook/renovar"
   ```

### Erro de autenticação?

1. Verificar variáveis de ambiente:
   ```env
   GOOGLE_CLIENT_EMAIL=seu-service-account@projeto.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   ```

2. Verificar Domain Wide Delegation no Google Workspace Admin Console

## 📈 Monitoramento

### Métricas Importantes

- **Taxa de sucesso**: % de webhooks processados com sucesso
- **Tempo de resposta**: Tempo para processar cada mudança
- **Erros**: Quantidade e tipos de erros
- **Renovações**: Status das renovações automáticas

### Alertas Recomendados

- Webhook não respondendo por mais de 5 minutos
- Taxa de erro acima de 5%
- Falha na renovação automática
- Servidor offline

## 🔒 Segurança

### Validação de Webhooks

O sistema valida:
- Headers de autenticação do Google
- IP de origem (quando possível)
- Formato do payload
- Timestamp da notificação

### Logs de Auditoria

Todos os eventos são registrados com:
- IP de origem
- User-Agent
- Timestamp
- Dados completos da mudança

## 📝 Exemplos de Uso

### 1. Monitorar Criação de Arquivos
```javascript
// O webhook detecta automaticamente quando um arquivo é criado
// e atualiza o banco de dados
```

### 2. Sincronizar Renomeação
```javascript
// Quando um arquivo é renomeado, o webhook atualiza o nome no banco
```

### 3. Detectar Remoção
```javascript
// Arquivos removidos são marcados como "removido" no banco
```

## 🎯 Próximos Passos

1. **Implementar retry automático** para webhooks que falham
2. **Adicionar webhooks do Calendar** para eventos
3. **Criar dashboard** para monitoramento em tempo real
4. **Implementar notificações** por email/Slack para mudanças importantes 