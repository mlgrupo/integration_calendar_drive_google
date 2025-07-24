# Versão Antiga - Integração Google Calendar e Drive

Esta é a versão que estava funcionando antes da refatoração. Use esta versão se a versão atual não estiver funcionando.

## 🚀 Como usar

### 1. Instalar dependências
```bash
cd old
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `config.env` para `.env`:
```bash
cp config.env .env
```

### 3. Executar o servidor
```bash
npm start
```

## 📡 Endpoints disponíveis

- `GET /api/users/sync` - Sincronizar usuários do domínio
- `GET /api/drive/sync` - Sincronizar arquivos do Drive
- `GET /api/users` - Listar usuários
- `GET /api/drive/files` - Listar arquivos do Drive
- `GET /api/drive/folders` - Listar pastas do Drive
- `POST /api/drive/webhook/config` - Configurar webhook do Drive
- `POST /api/webhook/renew` - Renovar webhooks
- `GET /api/webhook/status` - Status dos webhooks
- `GET /health` - Health check

## 🔧 Configuração

O arquivo `account` contém as credenciais da Service Account do Google. O sistema usa este arquivo diretamente para autenticação.

## 📊 Banco de dados

Certifique-se de que as tabelas necessárias existem no banco:
- `usuarios`
- `drive_files`
- `drive_folders`
- `webhooks`
- `logs`

## ⚠️ Importante

Esta versão usa o arquivo `account` diretamente para autenticação. Certifique-se de que este arquivo está presente e contém as credenciais corretas da Service Account. 