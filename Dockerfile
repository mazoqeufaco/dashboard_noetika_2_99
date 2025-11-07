# Dockerfile para Railway
# Usa imagem oficial do Node.js e adiciona Python
FROM node:18-slim

# Instala Python 3.11 e ferramentas necessárias
# Nota: Não fazemos upgrade do pip aqui para evitar erro PEP 668
RUN apt-get update && \
    apt-get install -y python3.11 python3.11-dev python3-pip python3.11-venv curl build-essential && \
    ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verifica instalações e caminhos
RUN node --version && npm --version && \
    python --version && python3 --version && \
    which python && which python3 && \
    pip --version && pip3 --version

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

