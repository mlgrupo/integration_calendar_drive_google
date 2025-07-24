# 🚀 Guia: Webhooks em Tempo Real - Passo a Passo

## ❓ Por que não está funcionando agora?

O Google Drive precisa enviar notificações para uma **URL pública HTTPS**. Atualmente seu servidor está em `localhost:3000`, que não é acessível externamente.

## 🎯 Soluções Disponíveis

### **Opção 1: ngrok (Recomendado para Testes)**

#### Passo 1: Instalar ngrok
```bash
# Baixar de: https://ngrok.com/download
# Ou usar chocolatey (Windows)
choco install ngrok

# Ou baixar manualmente e adicionar ao PATH
```

#### Passo 2: Expor o servidor
```bash
# Em um terminal separado (mantenha o servidor rodando)
ngrok http 3000
```

#### Passo 3: Copiar a URL HTTPS
Exemplo: `https://abc123.ngrok.io`

#### Passo 4: Configurar no .env
```env
WEBHOOK_URL=https://abc123.ngrok.io/webhook
```

#### Passo 5: Configurar webhooks
```bash
# Configurar para todos os usuários
node src/scripts/configurar-webhooks.js

# Ou para um usuário específico
curl -X POST "http://localhost:3000/api/webhook/configurar/leorosso@reconectaoficial.com.br"
```

### **Opção 2: webhook.site (Mais Simples)**

#### Passo 1: Acessar webhook.site
1. Vá para: https://webhook.site
2. Copie a URL única fornecida

#### Passo 2: Configurar
```env
WEBHOOK_URL=https://webhook.site/your-unique-url
```

### **Opção 3: Servidor em Produção**

Deploy em serviços como:
- Heroku
- Railway  
- DigitalOcean
- AWS
- Google Cloud

## 🧪 Testando Agora (Sem URL Pública)

### **Teste 1: Simular Webhooks Localmente**

```bash
# Simular eventos do Drive
node src/scripts/simular-webhook.js
```

### **Teste 2: Verificar se o Webhook Está Funcionando**

```bash
# Verificar status
curl -X GET "http://localhost:3000/api/webhook/status"

# Testar endpoint manualmente
curl -X POST "http://localhost:3000/api/webhook/drive" \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"fileId":"test-123","removed":false}]}'
```

### **Teste 3: Verificar Logs**

```bash
# Ver logs em tempo real
tail -f logs/app.log | grep "WEBHOOK"
```

## 🔧 Configuração Completa

### **1. Configurar Variáveis de Ambiente**

```env
# .env
WEBHOOK_URL=https://seu-dominio-publico.com/webhook
GOOGLE_CLIENT_EMAIL=seu-service-account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
ADMIN_EMAIL=leorosso@reconectaoficial.com.br
```

### **2. Configurar Webhooks**

```bash
# Para todos os usuários
node src/scripts/configurar-webhooks.js

# Para um usuário específico
node src/scripts/configurar-webhooks.js --test leorosso@reconectaoficial.com.br
```

### **3. Verificar Configuração**

```bash
# Status dos webhooks
curl -X GET "http://localhost:3000/api/webhook/status"

# Testar sincronização
curl -X GET "http://localhost:3000/api/drive/sync"
```

## 📊 Monitoramento

### **Verificar se está funcionando:**

1. **Logs do servidor**:
   ```bash
   # Ver logs em tempo real
   tail -f logs/app.log
   ```

2. **Logs do banco de dados**:
   ```sql
   -- Ver eventos recentes
   SELECT * FROM drive_events 
   ORDER BY timestamp_evento DESC 
   LIMIT 10;
   ```

3. **API de status**:
   ```bash
   curl -X GET "http://localhost:3000/api/webhook/status"
   ```

## 🚨 Troubleshooting

### **Problema: Webhook não recebe notificações**

**Solução:**
1. Verificar se a URL é pública e HTTPS
2. Verificar se o webhook está configurado:
   ```bash
   curl -X GET "http://localhost:3000/api/webhook/status"
   ```
3. Renovar webhooks:
   ```bash
   curl -X POST "http://localhost:3000/api/webhook/renovar"
   ```

### **Problema: Erro de autenticação**

**Solução:**
1. Verificar variáveis de ambiente
2. Verificar Domain Wide Delegation
3. Testar autenticação:
   ```bash
   curl -X GET "http://localhost:3000/api/drive/testar-autenticacao"
   ```

### **Problema: Servidor não responde**

**Solução:**
1. Verificar se o servidor está rodando
2. Verificar logs de erro
3. Reiniciar o servidor

## 🎯 Próximos Passos

### **Para Produção:**

1. **Deploy do servidor** em um serviço com HTTPS
2. **Configurar domínio** personalizado
3. **Configurar webhooks** para todos os usuários
4. **Monitorar logs** e métricas

### **Para Desenvolvimento:**

1. **Usar ngrok** para testes
2. **Simular eventos** com o script
3. **Testar diferentes cenários**

## 📞 Suporte

Se ainda não funcionar:

1. **Verificar logs** completos
2. **Testar autenticação** do Google
3. **Verificar configuração** do Domain Wide Delegation
4. **Testar com ngrok** primeiro

## 🔄 Fluxo Completo

1. **Configurar URL pública** (ngrok, webhook.site ou produção)
2. **Configurar webhooks** para usuários
3. **Fazer mudanças no Drive** (criar, editar, renomear arquivos)
4. **Verificar logs** para confirmar recebimento
5. **Verificar banco de dados** para confirmar atualização

---

**💡 Dica:** Comece com ngrok para testar, depois migre para produção! 