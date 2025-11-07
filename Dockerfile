# Dockerfile para Railway
# Usa imagem oficial do Node.js e adiciona Python
FROM node:18-slim

# Instala Python 3 e ferramentas necessárias de forma mais eficiente
# Separa update e install para melhor cache do Docker
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3 \
        python3-dev \
        python3-pip \
        python3-venv \
        curl \
        build-essential \
        ca-certificates && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    python3 -m ensurepip --upgrade --default-pip || true

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências (um por vez para melhor debug)
COPY requirements.txt /app/requirements.txt
COPY package.json /app/package.json
COPY package-lock.json* /app/

# Verifica se os arquivos foram copiados
RUN echo "=== Arquivos copiados ===" && \
    ls -la /app/ && \
    echo "=== Conteúdo do package.json ===" && \
    cat /app/package.json || (echo "ERRO: package.json não encontrado!" && exit 1)

# Instala dependências Python (usa python3 explicitamente)
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel --break-system-packages && \
    python3 -m pip install --no-cache-dir -r /app/requirements.txt --break-system-packages

# Verifica se Flask e outras dependências foram instaladas
RUN python3 -c "import flask; print('✅ Flask:', flask.__version__)" && \
    python3 -c "import flask_cors; print('✅ Flask-CORS instalado')" && \
    python3 -c "import waitress; print('✅ Waitress instalado')" && \
    echo "✅ Todas as dependências Python verificadas"

# Instala dependências Node.js (verifica se package.json existe primeiro)
RUN if [ ! -f /app/package.json ]; then \
        echo "ERRO: package.json não encontrado!" && \
        ls -la /app/ && \
        exit 1; \
    fi && \
    echo "✅ package.json encontrado, instalando dependências..." && \
    cd /app && \
    npm install --omit=dev

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

