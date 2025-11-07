# 🚀 Como Iniciar o Servidor

Este projeto possui várias formas de iniciar o servidor local, todas garantindo que o servidor sempre inicia no diretório correto do projeto.

## ⚡ Métodos Recomendados

### 1. **Script Node.js (Recomendado)**
```bash
npm start
```
ou diretamente:
```bash
node server.js
```

O `server.js` sempre serve do diretório onde está localizado, independente de onde você executa o comando.

### 2. **Scripts Windows**

**Opção A - Batch (.bat):**
```bash
start-server.bat
```
Duplo clique no arquivo `start-server.bat`

**Opção B - PowerShell (.ps1):**
```powershell
.\start-server.ps1
```

### 3. **Método Manual (Python - apenas se não tiver Node.js)**
```bash
cd "caminho/para/o/projeto"
python -m http.server 8000
```

**⚠️ IMPORTANTE:** Sempre execute o comando Python a partir do diretório do projeto!

## ✅ Verificação

Após iniciar, acesse: **http://localhost:8000**

Você deve ver a página do dashboard, não uma listagem de diretórios.

## 🔧 Por que isso acontecia?

O Python `http.server` serve o diretório **de onde o comando é executado**, não necessariamente o diretório do projeto. Se você executar de outro lugar, ele serve aquele diretório.

**Solução:** O `server.js` sempre resolve o caminho baseado na localização do próprio arquivo, garantindo consistência.

## 🔄 Detecção Automática de Porta

O servidor agora **automaticamente detecta** se a porta 8000 está em uso e tenta portas alternativas (8001, 8002, etc.) até encontrar uma livre. Você verá uma mensagem informando qual porta foi usada.

**Exemplo:**
```
⚠️  Porta 8000 em uso. Tentando porta 8001...
✅ Servidor rodando em http://localhost:8001
```

## 🛠️ Ferramentas Adicionais

### Liberar Porta Manualmente

Se quiser forçar a liberação da porta 8000:

**Node.js (Recomendado):**
```bash
npm run kill-port
```
ou especificar outra porta:
```bash
node kill-port.js 8000
node kill-port.js 8080
```

**Windows (Batch):**
```bash
kill-port.bat
```

**Script completo (limpa porta + inicia servidor):**
```bash
start-clean.bat
```

## 📝 Notas

- O servidor Node.js (`server.js`) detecta automaticamente o diretório correto
- **NOVO:** Detecta automaticamente se a porta está em uso e tenta alternativas
- Os scripts `.bat` e `.ps1` mudam para o diretório do projeto antes de iniciar
- Porta padrão: **8000** (com fallback automático)
- Se precisar matar processos na porta: `npm run kill-port`

