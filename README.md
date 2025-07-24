# Integração Google Calendar e Drive com Banco de Dados

Sistema de integração entre Google Workspace (Calendar e Drive) e banco de dados PostgreSQL usando Node.js.

## 🚀 Funcionalidades

- **Sincronização do Google Drive**: Busca e salva informações de arquivos e pastas
- **Sincronização do Google Calendar**: Busca e salva eventos e reuniões
- **Webhooks em tempo real**: Recebe notificações de mudanças no Drive e Calendar
- **Renovação automática de webhooks**: Sistema que renova webhooks a cada 6 dias
- **Gestão de usuários**: Busca e cadastra usuários do domínio Google Workspace
- **Logs detalhados**: Registra todas as operações no banco de dados

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- PostgreSQL
- Conta Google Workspace com Admin SDK habilitado
- Service Account do Google Cloud Platform

## 🔧 Configuração

### 1. Variáveis de Ambiente

Copie o arquivo `env.example` para `.env` e configure as variáveis:

```bash
cp env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Configuração do Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=google_integration
DB_USER=seu_usuario
DB_PASSWORD=sua_senha

# Configuração do Google Service Account
ADMIN_EMAIL=admin@seu-dominio.com
GOOGLE_CLIENT_EMAIL=seu-service-account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Configuração do Servidor
PORT=3000
```

### 4. Configure o banco de dados

Execute os scripts SQL para criar as tabelas:

```bash
# Conecte ao PostgreSQL e execute:
psql -U postgres -d google_integration -f scripts/criar_banco.sql
```

### 5. Configure as APIs do Google

No Google Cloud Console, ative as seguintes APIs:
- Google Drive API
- Google Calendar API
- Admin SDK Directory API

### 6. Configure as permissões da Service Account

1. No Google Workspace Admin Console, vá para "Segurança" > "Controles de acesso" > "Contas de serviço"
2. Adicione sua Service Account com as permissões necessárias
3. Configure o domínio para permitir impersonation da Service Account

## 🚀 Executando o projeto

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📡 Endpoints da API

### Drive
- `GET /api/drive/sync` - Sincroniza arquivos do Drive
- `GET /api/drive/files` - Lista arquivos sincronizados
- `GET /api/drive/folders` - Lista pastas sincronizadas

### Calendar (Desativado temporariamente)
- `GET /api/calendar/sync` - Sincroniza eventos do Calendar
- `GET /api/calendar/events` - Lista eventos sincronizados

### Webhooks
- `POST /api/webhook` - Endpoint para receber notificações
- `GET /api/webhook/status` - Status dos webhooks
- `POST /api/webhook/renew` - Renova webhooks manualmente

### Usuários
- `GET /api/users/sync` - Sincroniza usuários do domínio
- `GET /api/users` - Lista usuários sincronizados

### Debug
- `GET /api/debug/webhook` - Status detalhado dos webhooks
- `GET /api/debug/drive` - Lista arquivos recentes do Drive

## 🔄 Webhooks

O sistema configura automaticamente webhooks para:
- **Google Drive**: Monitora mudanças em arquivos e pastas
- **Google Calendar**: Monitora mudanças em eventos (desativado temporariamente)

Os webhooks são renovados automaticamente a cada 6 dias.

## 📊 Estrutura do Banco de Dados

### Tabelas principais:
- `usuarios` - Usuários do Google Workspace
- `drive_folders` - Pastas do Google Drive
- `drive_files` - Arquivos do Google Drive
- `calendar_events` - Eventos do Google Calendar
- `calendar_meetings` - Reuniões do Google Calendar
- `webhooks` - Configurações de webhooks
- `logs` - Logs de operações

## 🔒 Segurança

- ✅ Configuração simples com apenas 3 variáveis essenciais
- ✅ Credenciais da Service Account como variáveis de ambiente
- ✅ Arquivo `account` no `.gitignore`
- ✅ Validação de entrada em todos os endpoints
- ✅ Logs de auditoria para todas as operações

## 🐛 Solução de Problemas

### Erro de autenticação Google
- Verifique se as APIs estão ativadas no Google Cloud Console
- Confirme se a Service Account tem as permissões corretas
- Verifique se as variáveis de ambiente estão configuradas corretamente

### Erro de conexão com banco de dados
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no arquivo `.env`
- Execute os scripts SQL para criar as tabelas

### Webhooks não funcionando
- Verifique se a URL do webhook está acessível publicamente
- Confirme se o domínio está configurado no Google Cloud Console
- Use o endpoint `/api/debug/webhook` para verificar o status

## 📝 Logs

Os logs são salvos em:
- Console (desenvolvimento)
- Arquivo `logs/app.log` (produção)
- Banco de dados (tabela `logs`)

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes. 