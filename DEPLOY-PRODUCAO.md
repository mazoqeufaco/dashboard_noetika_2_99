# 🚀 Deploy em Produção

Este guia explica como fazer deploy deste projeto em produção, resolvendo o aviso do Flask sobre servidor de desenvolvimento.

## ⚠️ Problema: Servidor de Desenvolvimento

O Flask mostra este aviso:
```
WARNING: This is a development server. Do not use it in a production deployment.
```

**Solução:** Usar um servidor WSGI adequado para produção.

## ✅ Solução Implementada

O projeto agora usa **Waitress** em produção, que é um servidor WSGI multiplataforma (Windows/Linux/Mac).

## 🔧 Como Usar

### Desenvolvimento (Localhost)

**Método normal** - servidor de desenvolvimento:
```bash
python backend.py
```

Isso usa o servidor embutido do Flask (com o aviso, mas OK para desenvolvimento).

### Produção

**Opção 1: Usando variável de ambiente**
```bash
# Windows PowerShell
$env:FLASK_ENV="production"
python backend.py

# Linux/Mac
export FLASK_ENV=production
python backend.py
```

**Opção 2: Usando Waitress diretamente**
```bash
waitress-serve --host=0.0.0.0 --port=5000 backend:app
```

## 🌐 Deploy em Plataformas

### Heroku

**Procfile:**
```
web: waitress-serve --host=0.0.0.0 --port=$PORT backend:app
worker: python backend.py
```

Configure variáveis:
```bash
heroku config:set FLASK_ENV=production
heroku config:set EMAIL_PASSWORD=sua_senha
```

### Railway / Render.com

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
waitress-serve --host=0.0.0.0 --port=$PORT backend:app
```

**Variáveis de Ambiente:**
- `FLASK_ENV=production`
- `EMAIL_PASSWORD=sua_senha`
- `EMAIL_FROM=noetikaai@gmail.com`
- `EMAIL_TO=noetikaai@gmail.com, gabriel.silva@ufabc.edu.br`

### VPS Linux (systemd)

**Arquivo:** `/etc/systemd/system/noetika-backend.service`

```ini
[Unit]
Description=Noetika Backend API
After=network.target

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/caminho/para/projeto
Environment="FLASK_ENV=production"
Environment="EMAIL_PASSWORD=sua_senha"
Environment="EMAIL_FROM=noetikaai@gmail.com"
Environment="EMAIL_TO=noetikaai@gmail.com, gabriel.silva@ufabc.edu.br"
ExecStart=/usr/bin/python3 -m waitress --host=0.0.0.0 --port=5000 backend:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl enable noetika-backend
sudo systemctl start noetika-backend
sudo systemctl status noetika-backend
```

### Docker

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_ENV=production

EXPOSE 5000

CMD ["waitress-serve", "--host=0.0.0.0", "--port=5000", "backend:app"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - EMAIL_PASSWORD=${EMAIL_PASSWORD}
      - EMAIL_FROM=${EMAIL_FROM}
      - EMAIL_TO=${EMAIL_TO}
    volumes:
      - ./tracking_data:/app/tracking_data
    restart: unless-stopped
```

### Nginx como Proxy Reverso (Recomendado)

Configure Nginx para fazer proxy para o backend:

**/etc/nginx/sites-available/noetika**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        # Serve arquivos estáticos do Node.js na porta 8000
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📋 Checklist de Produção

- [ ] Instalar dependências: `pip install -r requirements.txt`
- [ ] Configurar variáveis de ambiente (especialmente `EMAIL_PASSWORD`)
- [ ] Usar `FLASK_ENV=production` ou `waitress-serve`
- [ ] Configurar firewall (porta 5000 e 8000)
- [ ] Configurar HTTPS/SSL (certbot, Let's Encrypt)
- [ ] Configurar backup dos arquivos CSV em `tracking_data/`
- [ ] Monitorar logs do servidor
- [ ] Configurar reinício automático (systemd, PM2, etc.)

## 🔒 Segurança em Produção

1. **NUNCA** commite o arquivo `.env`
2. Use variáveis de ambiente do sistema/deploy
3. Configure HTTPS (SSL/TLS)
4. Use firewall (UFW, iptables)
5. Mantenha dependências atualizadas
6. Configure rate limiting se necessário
7. Monitore logs para tentativas de acesso suspeitas

## 📊 Monitoramento

Para verificar se está rodando em modo produção:

```bash
# Ver processos
ps aux | grep waitress

# Ver logs
tail -f /var/log/noetika-backend.log  # ou onde configurar
```

## ✅ Resumo

- **Desenvolvimento:** `python backend.py` (com aviso, mas OK)
- **Produção:** `FLASK_ENV=production python backend.py` ou `waitress-serve`
- **Waitress** é multiplataforma e adequado para produção
- Configure variáveis de ambiente para credenciais




