# 📦 Arquivos Atualizados para Corrigir Erro "node: command not found"

## ⚠️ Arquivos que PRECISAM ser atualizados no GitHub:

### 1. `Dockerfile` (ATUALIZADO - CRÍTICO)
- Agora inclui `apt-get update` antes de instalar Node.js
- Verifica instalação do Node.js durante build
- Define PATH explicitamente

### 2. `railway.toml` (SIMPLIFICADO)
- Removido `startCommand` (o Dockerfile já define)
- Apenas `builder = "DOCKERFILE"`

### 3. `Procfile` (REMOVIDO)
- Não é mais necessário quando usa Dockerfile
- O Dockerfile define o CMD diretamente

## 🔧 Mudanças no Dockerfile:

1. ✅ Adicionado `apt-get update` antes de instalar Node.js
2. ✅ Adicionado `gnupg` como dependência
3. ✅ Verificação de instalação do Node.js durante build
4. ✅ PATH explicitamente definido

## 📝 Para Subir Manualmente:

1. **Dockerfile** - Substituir o arquivo existente
2. **railway.toml** - Substituir o arquivo existente  
3. **Procfile** - REMOVER do repositório (se existir)

Após subir esses arquivos, o Railway deve:
- Usar o Dockerfile corretamente
- Instalar Node.js durante o build
- Encontrar o comando `node` quando executar

