# 📊 Explicação sobre o Tracking

## Como os arquivos CSV funcionam

### `sessions.csv` - Histórico de Sessões
✅ **ACUMULA TODO O HISTÓRICO**
- Cada nova sessão é **ADICIONADA** ao arquivo
- **NÃO sobrescreve** sessões antigas
- Mantém histórico completo de todas as sessões desde o início

**Exemplo:** Se você usar o dashboard hoje e amanhã, terá 2 linhas (uma para cada dia)

### `events.csv` - Histórico de Eventos  
✅ **ACUMULA TODO O HISTÓRICO**
- Cada evento é **ADICIONADO** ao arquivo
- **NÃO sobrescreve** eventos antigos
- Mantém todos os eventos de todas as sessões

**Exemplo:** Todas as interações (cliques, mudanças, visualizações) são salvas permanentemente

## Sobre IP e Localização

### Por que aparece `127.0.0.1`?

Quando você acessa `localhost:8000`, seu navegador está se conectando ao servidor local (na sua própria máquina). Nesse caso:

- **IP do cliente:** `127.0.0.1` (localhost)
- **Localização:** Não pode ser determinada porque é um IP local

### Para obter IP e localização reais:

1. **Em produção (servidor remoto):**
   - O sistema automaticamente obtém o IP público do usuário
   - A API `ipapi.co` retorna cidade, país, coordenadas, etc.

2. **Em localhost (desenvolvimento):**
   - Só aparece `127.0.0.1` porque é local
   - Se a API `ipapi.co` estiver acessível, o backend tenta obter o IP público do servidor
   - Mas mesmo assim a localização será do servidor, não do cliente

## Estrutura dos Dados

### sessions.csv
Uma linha por sessão de usuário com:
- Informações básicas (session_id, data/hora, navegador, resolução)
- IP e localização (quando disponível)

### events.csv
Uma linha por evento de interação:
- Cliques
- Mudanças de valores
- Visualizações
- Tempo na página
- etc.

## Comportamento Esperado

✅ **Ambos os arquivos são cumulativos** - nunca sobrescrevem dados antigos

✅ **Cada sessão é única** - identificada por `session_id`

✅ **Eventos são vinculados à sessão** - você pode filtrar por `session_id` no events.csv

## Limitações em Localhost

⚠️ **IP:** Sempre será `127.0.0.1` (localhost)

⚠️ **Localização:** Não pode ser determinada (localhost não tem localização geográfica)

✅ **Em produção:** Tudo funciona perfeitamente com IPs públicos e localização real

