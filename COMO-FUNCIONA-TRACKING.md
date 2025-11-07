# 📊 Como Funciona o Sistema de Tracking

## 🗂️ Onde os dados são salvos?

**Localização:** `tracking_data/` dentro do diretório do projeto
- `tracking_data/sessions.csv` - Uma linha por sessão de usuário
- `tracking_data/events.csv` - Uma linha por evento de interação

## ⚡ Quando os dados são salvos?

**✅ TEMPO REAL** - Os dados são salvos **IMEDIATAMENTE** quando cada evento ocorre:
- Não espera o usuário sair do site
- Cada clique, mudança de valor, visualização é salva na hora
- Funciona em **localhost** sim!

## 🔄 Como funciona o fluxo?

1. **Frontend (tracking.js)** detecta um evento (ex: clique no botão)
2. **Imediatamente** envia para `/api/track` via POST
3. **Backend Python** recebe e salva **na hora** no CSV
4. Se o backend não estiver rodando, os dados ficam no **localStorage** do navegador

## 🚀 Como usar?

### Opção 1: Script Automático (Recomendado)
```bash
# Windows
INICIAR-TRACKING.bat

# Isso abre 2 janelas:
# - Backend Python (porta 5000)
# - Servidor Node.js (porta 8000)
```

### Opção 2: Manual (2 terminais)

**Terminal 1 - Backend Python:**
```bash
python backend.py
```

**Terminal 2 - Servidor Node.js:**
```bash
node server.js
```

Depois acesse: `http://localhost:8000`

## 📍 Localização Exata dos Arquivos

Os CSVs são salvos em:
```
C:\Users\ENTRANCE  UEFI  EVO\OneDrive\Gabriel\UFABC\Desenvolvimento Integrado de Produto\dashboard_noetika_2_9 - tentando user tracking sobre 2_8\tracking_data\
```

Ou seja: **mesmo diretório onde está o backend.py**

## ⏱️ Quanto tempo leva para salvar?

**Menos de 1 segundo!** É quase instantâneo:
- Evento acontece → Frontend envia → Backend salva → Pronto!

## 🧪 Como testar se está funcionando?

1. **Inicie os servidores** (INICIAR-TRACKING.bat)
2. **Acesse** `http://localhost:8000`
3. **Interaja** com o dashboard (clique, mude valores, etc.)
4. **Verifique os arquivos:**
   ```powershell
   # Ver conteúdo dos CSVs
   Get-Content tracking_data\sessions.csv
   Get-Content tracking_data\events.csv
   ```

5. **Ou via API:**
   - http://localhost:5000/api/stats
   - http://localhost:5000/api/sessions

## ⚠️ Problemas Comuns

**CSV está vazio?**
- Backend Python não está rodando (iniciar com `python backend.py`)
- Nenhum evento foi disparado ainda (tente interagir com o dashboard)

**Backend não inicia?**
- Verifique se Flask está instalado: `pip install -r requirements.txt`
- Verifique se a porta 5000 está livre

**Dados não aparecem?**
- Abra o console do navegador (F12) e veja se há erros
- Verifique se aparece: `✅ Tracking initialized`
- Os dados podem estar apenas no localStorage se o backend não estiver rodando

## 💡 Dica: Ver dados em tempo real

Execute em outro terminal:
```powershell
# Windows PowerShell
Get-Content tracking_data\events.csv -Wait -Tail 10
```

Isso mostra as últimas 10 linhas e atualiza automaticamente quando novos eventos chegam!

