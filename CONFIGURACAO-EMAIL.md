# 📧 Configuração de Email para Produção

Este documento explica como configurar as credenciais de email para envio de relatórios.

## 🔐 Onde Colocar a Senha?

### Opção 1: Arquivo `.env` (RECOMENDADO para produção)

1. **Crie um arquivo `.env` na raiz do projeto:**
   ```
   dashboard_noetika_2_96 - como anterior mas gera relatório pdf/
   ├── .env          ← Crie este arquivo
   ├── backend.py
   ├── requirements.txt
   └── ...
   ```

2. **Copie o template e preencha:**
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

3. **Edite o arquivo `.env` e preencha a senha:**
   ```env
   EMAIL_PASSWORD=sua_senha_de_app_do_gmail_aqui
   ```

   ⚠️ **IMPORTANTE:** O arquivo `.env` está no `.gitignore` e **NÃO será commitado no Git**, então suas credenciais estão seguras!

### Opção 2: Variáveis de Ambiente do Sistema (Produção)

Dependendo de onde você vai fazer deploy, configure as variáveis de ambiente:

#### **Heroku:**
```bash
heroku config:set EMAIL_PASSWORD=sua_senha
heroku config:set EMAIL_FROM=noetikaai@gmail.com
heroku config:set EMAIL_TO="noetikaai@gmail.com, gabriel.silva@ufabc.edu.br"
```

#### **Railway:**
- Dashboard Railway → Variáveis de Ambiente → Adicione:
  - `EMAIL_PASSWORD`
  - `EMAIL_FROM`
  - `EMAIL_TO`

#### **Render.com:**
- Dashboard → Environment → Add Environment Variable:
  - `EMAIL_PASSWORD`
  - `EMAIL_FROM`
  - `EMAIL_TO`

#### **VPS/Linux (systemd):**
Edite o arquivo de serviço `/etc/systemd/system/seu-app.service`:
```ini
[Service]
Environment="EMAIL_PASSWORD=sua_senha"
Environment="EMAIL_FROM=noetikaai@gmail.com"
Environment="EMAIL_TO=noetikaai@gmail.com, gabriel.silva@ufabc.edu.br"
```

#### **Windows Server/IIS:**
Configure no IIS Manager → Application → Environment Variables

#### **Docker:**
No `docker-compose.yml`:
```yaml
services:
  backend:
    environment:
      - EMAIL_PASSWORD=sua_senha
      - EMAIL_FROM=noetikaai@gmail.com
      - EMAIL_TO=noetikaai@gmail.com, gabriel.silva@ufabc.edu.br
```

Ou no `Dockerfile`:
```dockerfile
ENV EMAIL_PASSWORD=sua_senha
ENV EMAIL_FROM=noetikaai@gmail.com
ENV EMAIL_TO="noetikaai@gmail.com, gabriel.silva@ufabc.edu.br"
```

## 🔑 Senha de App do Gmail

Se sua conta Gmail tem **verificação em 2 etapas ativada**, você precisa criar uma **Senha de App**:

1. Acesse: https://myaccount.google.com/apppasswords
2. Selecione "Email" e o dispositivo
3. Gere a senha (16 caracteres)
4. Use essa senha no `EMAIL_PASSWORD` (você pode usar com ou sem espaços)

## ✅ Verificação

Após configurar, teste se está funcionando:

```bash
python backend.py
```

Você deve ver:
```
🚀 Starting Noetika Tracking Backend...
📊 Server running at http://localhost:5000
```

Se a senha estiver configurada, não aparecerá aviso. Se não estiver, verá:
```
⚠️ EMAIL_PASSWORD não configurado. Email não será enviado.
```

## 📋 Configurações Disponíveis

| Variável | Padrão | Descrição |
|----------|-------|-----------|
| `SMTP_SERVER` | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | `587` | Porta SMTP |
| `EMAIL_FROM` | `noetikaai@gmail.com` | Email remetente |
| `EMAIL_PASSWORD` | *(vazio)* | **OBRIGATÓRIO** - Senha do remetente |
| `EMAIL_TO` | `noetikaai@gmail.com, gabriel.silva@ufabc.edu.br` | Destinatário(s), separados por vírgula |

## 🚨 Segurança

- ✅ **NUNCA** commite o arquivo `.env` no Git
- ✅ O `.env` já está no `.gitignore`
- ✅ Use senhas de app para Gmail quando possível
- ✅ Em produção, prefira variáveis de ambiente do sistema/deploy




