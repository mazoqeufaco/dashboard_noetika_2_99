# Dockerfile para Railway
# Usa imagem oficial do Node.js e adiciona Python
FROM node:18-slim

# Instala Python 3.11 e ferramentas necessárias
# Adiciona retry logic para evitar falhas de rede
RUN apt-get update --fix-missing || apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-dev \
        python3-pip \
        python3.11-venv \
        curl \
        build-essential \
        ca-certificates && \
    ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Garante que pip está instalado e funcional
RUN python3.11 -m ensurepip --upgrade --default-pip || true

# Verifica instalações básicas (sem verificar pip diretamente, usamos python3 -m pip)
RUN echo "=== Verificando Node.js ===" && \
    node --version && \
    npm --version && \
    echo "=== Verificando Python ===" && \
    python3.11 --version && \
    python3 --version && \
    python --version && \
    which python3.11 && \
    which python3 && \
    which python && \
    echo "✅ Verificações básicas concluídas"

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY requirements.txt package*.json ./

# Instala dependências Python (usa python3 explicitamente)
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel --break-system-packages && \
    python3 -m pip install --no-cache-dir -r requirements.txt --break-system-packages

# Verifica se Flask e outras dependências foram instaladas
RUN python3 -c "import flask; print('✅ Flask:', flask.__version__)" && \
    python3 -c "import flask_cors; print('✅ Flask-CORS instalado')" && \
    python3 -c "import waitress; print('✅ Waitress instalado')" && \
    echo "✅ Todas as dependências Python verificadas"

# Instala dependências Node.js
RUN npm install --production

# Copia o resto dos arquivos
COPY . .

# Expõe porta (Railway define a variável PORT automaticamente)
# PORT será definido pelo Railway em tempo de execução
EXPOSE 8080

# Define PATH explicitamente para garantir que node seja encontrado
ENV PATH="/usr/bin:$PATH"

# Comando de inicialização
# Railway injeta PORT automaticamente via variável de ambiente
CMD ["node", "start.js"]

