# 📊 Sistema de Tracking de Usuários

Este projeto agora inclui um sistema completo de tracking de usuários que registra IP, localização geográfica, data/hora de acesso e eventos de interação.

## 🎯 O que é rastreado?

### Dados de Sessão
- **IP do usuário** (obtido via API ipapi.co)
- **Localização geográfica**: cidade, região, país, latitude, longitude, timezone
- **Data e hora de início da sessão**
- **User Agent** (navegador e SO)
- **Resolução de tela**
- **Idioma do navegador**
- **Referrer** (página de origem)

### Eventos Rastreados
- Visualização inicial da página
- Confirmação de prioridades (valores RGB)
- Cálculo de resultados
- Visualização de ranking completo
- Visualização de árvore de soluções
- Visualização de detalhes de solução
- Cliques em botões
- Mudanças nos valores de prioridade (inputs)
- Interações com o triângulo
- Tempo gasto na página (a cada 30 segundos)
- Scroll depth (25%, 50%, 75%, 100%)
- Mudanças de aba (quando o usuário sai/volta)
- Fim de sessão

## 🚀 Como usar

### Opção 1: Backend Python (Recomendado - Salva dados em CSV)

1. **Instale as dependências Python:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Inicie o backend Python (porta 5000):**
   ```bash
   python backend.py
   ```

3. **Em outro terminal, inicie o servidor Node.js (porta 8000):**
   ```bash
   npm start
   # ou
   node server.js
   ```

4. **Acesse:** `http://localhost:8000`

Os dados serão salvos automaticamente em:
- `tracking_data/sessions.csv` - Dados de cada sessão
- `tracking_data/events.csv` - Todos os eventos

### Opção 2: Apenas Frontend (Dados salvos no localStorage)

Se você não quiser rodar o backend Python, o tracking ainda funciona:
- Os dados são salvos no localStorage do navegador
- Você pode exportar manualmente usando o console do navegador:
  ```javascript
  window.tracking.exportCSV()  // Download CSV
  window.tracking.exportJSON() // Download JSON
  ```

## 📁 Estrutura de Dados

### sessions.csv
Contém uma linha por sessão com:
- `session_id` - ID único da sessão
- `start_time` - Data/hora de início (ISO 8601)
- `user_agent` - Navegador e sistema operacional
- `screen_resolution` - Resolução da tela
- `language` - Idioma
- `referrer` - Página de origem
- `ip` - Endereço IP
- `city`, `region`, `country` - Localização
- `latitude`, `longitude` - Coordenadas
- `timezone` - Fuso horário

### events.csv
Contém uma linha por evento com:
- `session_id` - ID da sessão
- `event_type` - Tipo do evento
- `timestamp` - Data/hora do evento (ISO 8601)
- `page` - Seção/página onde ocorreu
- `event_data` - Dados adicionais em JSON

## 🔍 Acessando os Dados

### Via API do Backend

- **Estatísticas:** `http://localhost:5000/api/stats`
- **Todas as sessões:** `http://localhost:5000/api/sessions`
- **Eventos de uma sessão:** `http://localhost:5000/api/events/{session_id}`

### Via Console do Navegador

```javascript
// Ver dados da sessão atual
window.tracking.session

// Exportar dados
window.tracking.exportCSV()
window.tracking.exportJSON()

// Rastrear evento manual
window.tracking.trackEvent('meu_evento', { dados: 'extra' })
```

## ⚙️ Configuração

O tracking é inicializado automaticamente quando a página carrega. Não requer configuração adicional.

### Desabilitar Tracking (se necessário)

Para desabilitar, comente ou remova a linha no `index.html`:
```html
<!-- <script src="tracking.js"></script> -->
```

## 📝 Notas Importantes

1. **API de Geolocalização**: Usa a API gratuita `ipapi.co`. Há limites de requisições (1000/dia no plano gratuito).

2. **Privacidade**: Todos os dados são armazenados localmente. Certifique-se de estar em conformidade com LGPD/GDPR se for usar em produção.

3. **Performance**: O tracking é assíncrono e não bloqueia a interface. Se o backend não estiver disponível, os dados são salvos apenas no localStorage.

4. **Arquivos CSV**: Os arquivos são criados automaticamente na primeira execução do backend.

## 🐛 Troubleshooting

**Backend não recebe dados:**
- Verifique se o backend está rodando na porta 5000
- Verifique o console do navegador (F12) para erros
- Certifique-se de que CORS está habilitado (já está no código)

**IP/Localização não aparece:**
- Pode ser limitação da API gratuita (ipapi.co)
- Verifique sua conexão com a internet
- Os dados aparecerão como vazios mas ainda serão salvos

## 📚 Arquivos Criados

- `tracking.js` - Sistema de tracking frontend
- `backend.py` - Backend Flask para salvar dados
- `requirements.txt` - Dependências Python
- `tracking_data/` - Diretório para armazenar CSVs
  - `sessions.csv` - Dados de sessões
  - `events.csv` - Dados de eventos

