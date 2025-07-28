# 📁 Funcionalidades de Shared Drives

## 🎯 **O que foi implementado:**

O sistema agora foi modificado para trabalhar **apenas com Shared Drives** (drives compartilhados), removendo a busca do "Meu Drive" pessoal.

## ✅ **Principais mudanças:**

### 1. **Sincronização Modificada**
- ✅ **Antes**: Buscava arquivos do "Meu Drive" + Shared Drives
- ✅ **Agora**: Busca **apenas** dos Shared Drives
- ✅ **Benefício**: Foco em arquivos compartilhados da organização

### 2. **Funções Modificadas para Shared Drives**
- `syncDriveFilesJWT()` - Sincronização apenas de Shared Drives (modificada)
- `registrarWebhookDriveJWT()` - Registra webhook apenas para Shared Drives (modificada)
- `processarArquivoDriveJWT()` - Processa arquivos apenas de Shared Drives (modificada)
- `syncDrive()` - Controller de sincronização focado em Shared Drives (modificada)
- `configurarWebhookDrive()` - Configuração de webhook focado em Shared Drives (modificada)

### 3. **Rotas Existentes (Modificadas para Shared Drives)**

#### Sincronização (agora apenas Shared Drives)
```bash
POST /api/drive/sync
```

#### Configurar webhook (agora apenas Shared Drives)
```bash
POST /api/drive/configurar-webhook
```

## 🧪 **Como testar:**

### 1. **Teste via Script**
```bash
# Teste geral de Shared Drives
node src/scripts/test_shared_drives.js

# Teste de período do Calendar (1 mês para trás e 1 mês para frente)
node src/scripts/test_calendar_period.js

# Teste de sincronização completa do Drive (com paginação)
node src/scripts/test_drive_sync_complete.js
```

### 2. **Teste via API**
```bash
# Sincronizar Shared Drives (rota modificada)
curl -X POST "http://localhost:3000/api/drive/sync"

# Configurar webhook de Shared Drives (rota modificada)
curl -X POST "http://localhost:3000/api/drive/configurar-webhook"
```

## 📊 **Logs esperados:**

```
📁 Encontrados 3 Shared Drives para usuario@dominio.com
📂 Processando Shared Drive: Projetos (0B1234567890)
   📄 Buscando página 1...
   📄 Página 1: 1000 arquivos encontrados
   📄 Buscando página 2...
   📄 Página 2: 500 arquivos encontrados
📄 Total de 1500 itens no Shared Drive: Projetos (2 páginas)
✅ Usuário usuario@dominio.com: 1200 arquivos, 300 pastas processados (apenas Shared Drives)

🔗 Webhook de Shared Drives:
📁 Encontrados 3 Shared Drives para usuario@dominio.com
✅ Webhook de Shared Drives registrado com sucesso!
📊 Configurado para monitorar 3 Shared Drives
📁 Mudança em Shared Drive detectada: 0B1234567890
✅ Mudança significativa em Shared Drive: change_123

📅 Calendar (1 mês para trás e 1 mês para frente):
📅 Processando calendário: Primary (primary)
📅 Encontrados 15 eventos no calendário Primary
✅ Usuário usuario@dominio.com: 12 eventos, 3 reuniões processados
```

## 🔧 **Configuração necessária:**

### 1. **Permissões do Google Workspace**
- O usuário deve ter acesso aos Shared Drives
- A conta de serviço deve ter permissões adequadas

### 2. **Variáveis de ambiente**
```env
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
WEBHOOK_URL=https://seu-dominio.com/webhook
```

## 📋 **Estrutura dos dados:**

### Shared Drive
```json
{
  "id": "0B1234567890",
  "name": "Projetos",
  "createdTime": "2023-01-01T00:00:00.000Z",
  "capabilities": { ... },
  "restrictions": { ... }
}
```

### Arquivo em Shared Drive
```json
{
  "id": "1ABC123DEF456",
  "name": "documento.pdf",
  "mimeType": "application/pdf",
  "sharedDriveId": "0B1234567890",
  "sharedDriveName": "Projetos",
  "owners": [{ "emailAddress": "admin@dominio.com" }],
  "shared": true
}
```

## 🎯 **Benefícios:**

1. **Foco organizacional**: Apenas arquivos compartilhados da empresa
2. **Performance**: Menos dados para processar
3. **Segurança**: Não acessa arquivos pessoais
4. **Colaboração**: Foco em trabalho em equipe

## ⚠️ **Limitações:**

- Não sincroniza arquivos do "Meu Drive" pessoal
- Requer que o usuário tenha acesso aos Shared Drives
- Depende das permissões configuradas no Google Workspace

## 🚀 **Próximos passos:**

1. Testar as novas funcionalidades
2. Configurar webhooks para Shared Drives
3. Monitorar performance e logs
4. Ajustar permissões conforme necessário 