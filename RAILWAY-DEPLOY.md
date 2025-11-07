# 🚂 Guia de Deploy no Railway.app

Este documento explica as modificações feitas para permitir o deploy no Railway.app.

## 📋 Modificações Realizadas

### 1. **Arquivos Criados**

- **`start.js`**: Script de inicialização que inicia o backend Python e o servidor Node.js
- **`Procfile`**: Arquivo usado pelo Railway para identificar o comando de inicialização
- **`nixpacks.toml`**: Configuração do Nixpacks (builder usado pelo Railway)
- **`railway.json`**: Configuração adicional do Railway

### 2. **Arquivos Modificados**

- **`server.js`**: 
  - Agora usa `process.env.PORT` (variável fornecida pelo Railway)
  - Escuta em `0.0.0.0` para aceitar conexões externas
  - Mantém compatibilidade com desenvolvimento local

- **`backend.py`**:
  - Usa variável de ambiente `BACKEND_PORT` (padrão 5000)
  - Detecta automaticamente ambiente de produção via variável `PORT`
  - Usa Waitress em produção (servidor WSGI adequado)

- **`package.json`**:
  - Script `start` agora executa `start.js` (para produção)
  - Script `start:dev` mantém comportamento original (desenvolvimento)

## 🚀 Como Fazer Deploy no Railway

### Passo 1: Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo" (recomendado) ou "Empty Project"

### Passo 2: Conectar Repositório (se usando GitHub)

1. Autorize o Railway a acessar seu repositório
2. Selecione o repositório do projeto
3. O Railway detectará automaticamente a configuração

### Passo 3: Configurar Variáveis de Ambiente

No painel do Railway, vá em "Variables" e adicione:

```
FLASK_ENV=production
ENVIRONMENT=production
BACKEND_PORT=5000
EMAIL_PASSWORD=sua_senha_app_gmail
EMAIL_FROM=noetikaai@gmail.com
EMAIL_TO=noetikaai@gmail.com,gabriel.silva@ufabc.edu.br
```

⚠️ **Importante**: A variável `PORT` é automaticamente fornecida pelo Railway, não precisa configurá-la manualmente.

### Passo 4: Deploy Automático

1. O Railway detectará automaticamente:
   - `Procfile` → usará `node start.js`
   - `package.json` → instalará dependências Node.js
   - `requirements.txt` → instalará dependências Python
   - `nixpacks.toml` → configurará o ambiente corretamente

2. O deploy será iniciado automaticamente após o push no repositório

## 🔧 Como Funciona

### Inicialização no Railway

1. O Railway executa: `node start.js` (definido no Procfile)
2. `start.js`:
   - Inicia o backend Python em background na porta 5000
   - Aguarda 3 segundos para garantir que o Python está rodando
   - Inicia o servidor Node.js na porta definida por `PORT` (Railway)
   - O Node.js faz proxy de `/api/*` para o backend Python em `localhost:5000`

### Comunicação entre Serviços

```
Cliente → Railway (PORT) → Node.js (server.js)
                              ↓
                         /api/* → Python Backend (localhost:5000)
```

## 🐛 Solução de Problemas

### Erro: "Python não encontrado"

O script `start.js` tenta automaticamente:
- `python3` no Linux/Mac
- `python` no Windows
- Se falhar, tenta a alternativa

### Erro: "Backend Python não disponível"

- Verifique os logs no Railway para ver se o Python iniciou corretamente
- Verifique se `requirements.txt` foi instalado: `pip install -r requirements.txt`
- Verifique se `FLASK_ENV=production` está configurado

### Erro: "Porta já em uso"

- No Railway, isso não deve acontecer, pois cada instância recebe uma porta única
- Se acontecer localmente, use: `npm run kill-port`

### Servidor não responde

1. Verifique os logs no Railway
2. Verifique se ambos os serviços iniciaram:
   - Deve aparecer: `[Python] 🚀 Starting Noetika Tracking Backend...`
   - Deve aparecer: `✅ Servidor rodando em http://0.0.0.0:PORT`

## 📝 Notas

- O projeto funciona localmente usando `npm run start:dev` (apenas Node.js)
- Para desenvolvimento completo, inicie também: `python backend.py`
- Em produção (Railway), `start.js` gerencia ambos os serviços automaticamente

## ✅ Checklist de Deploy

- [ ] Repositório conectado ao Railway
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy iniciado automaticamente
- [ ] Logs mostram ambos os serviços rodando
- [ ] Aplicação acessível via URL do Railway
- [ ] API `/api/*` funcionando corretamente

## 🔗 Links Úteis

- [Documentação do Railway](https://docs.railway.app)
- [Nixpacks Documentation](https://nixpacks.com/docs)
- [Procfile Guide](https://docs.railway.app/deploy/builds#procfile)
