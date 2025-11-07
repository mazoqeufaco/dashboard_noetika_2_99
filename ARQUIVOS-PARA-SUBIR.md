# 📦 Arquivos Essenciais para Subir no GitHub

## ⚠️ ARQUIVOS CRÍTICOS (Obrigatórios para Railway funcionar)

Estes arquivos **DEVEM** estar no repositório para o Railway funcionar:

### 1. `Dockerfile` (NOVO - CRÍTICO)
- Este arquivo faz o Railway usar Docker em vez de Nixpacks
- Sem ele, o Railway vai tentar usar Nixpacks e dar erro do `pip`

### 2. `railway.toml` (NOVO - CRÍTICO)  
- Força o Railway a usar o Dockerfile
- Configura o comando de start

### 3. `Procfile` (NOVO - CRÍTICO)
- Define o comando de inicialização

### 4. `start.js` (NOVO - CRÍTICO)
- Script que inicia Python e Node.js juntos
- Necessário para produção no Railway

### 5. `backend.py` (Modificado)
- Ajustado para usar variável PORT do Railway
- Detecta produção automaticamente

### 6. `server.js` (Modificado)
- Ajustado para usar variável PORT do Railway
- Escuta em 0.0.0.0 para conexões externas

### 7. `package.json` (Modificado)
- Script `start` agora usa `start.js`

### 8. `requirements.txt` (Se não existe no repo)
- Dependências Python

### 9. `.gitignore` (Modificado)
- Adicionado `.nixpacks/` e `*.nix` para ignorar cache do Nixpacks

## 📝 Arquivos Opcionais (mas recomendados)

- `.dockerignore` - Ignora arquivos desnecessários no build
- `runtime.txt` - Especifica versão Python (3.11)
- `.nixpacksignore` - Garante que Nixpacks não seja usado

## 🔄 Arquivos Modificados (já existiam, mas foram atualizados)

- `entrada.js` - Correção do triângulo para mobile
- `app.js` - Modificações gerais
- `index.html` - Canvas sem dimensões fixas
- `style.css` - Responsividade do triângulo (aspect-ratio)

## ✅ Checklist de Upload

- [ ] `Dockerfile` (na raiz)
- [ ] `railway.toml` (na raiz)
- [ ] `Procfile` (na raiz)
- [ ] `start.js` (na raiz)
- [ ] `backend.py` (na raiz)
- [ ] `server.js` (na raiz)
- [ ] `package.json` (na raiz)
- [ ] `requirements.txt` (na raiz)
- [ ] `.gitignore` (na raiz, atualizado)

## 🚨 IMPORTANTE

1. **O `Dockerfile` é o mais importante** - sem ele, o Railway não vai funcionar
2. Todos esses arquivos devem estar na **raiz do repositório**
3. Após fazer upload, o Railway deve detectar automaticamente e fazer deploy

