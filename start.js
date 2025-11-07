#!/usr/bin/env node
/**
 * Script de inicialização para Railway
 * Inicia o backend Python em background e depois o servidor Node.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.resolve(__dirname || process.cwd());
const isProduction = process.env.PORT || process.env.RAILWAY_ENVIRONMENT;

console.log('🚀 Iniciando serviços...');
console.log(`📁 Diretório: ${projectDir}`);
console.log(`🌐 Ambiente: ${isProduction ? 'PRODUÇÃO (Railway)' : 'DESENVOLVIMENTO'}\n`);

// Verifica se backend.py existe
const backendPath = path.join(projectDir, 'backend.py');
if (!fs.existsSync(backendPath)) {
  console.error('❌ Erro: backend.py não encontrado!');
  process.exit(1);
}

// Configura ambiente para Python em produção
if (isProduction) {
  process.env.FLASK_ENV = 'production';
  process.env.ENVIRONMENT = 'production';
  process.env.BACKEND_PORT = '5000';
}

// Inicia backend Python
console.log('🐍 Iniciando backend Python...');
// No Railway/Docker sempre usa python3
const pythonCmd = 'python3';
console.log(`   Usando comando: ${pythonCmd}`);
const pythonBackend = spawn(pythonCmd, ['backend.py'], {
  cwd: projectDir,
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

pythonBackend.stdout.on('data', (data) => {
  console.log(`[Python] ${data.toString().trim()}`);
});

pythonBackend.stderr.on('data', (data) => {
  const output = data.toString().trim();
  // Ignora avisos do Flask em produção (já usamos Waitress)
  if (!output.includes('WARNING: This is a development server')) {
    console.error(`[Python ERR] ${output}`);
  }
});

pythonBackend.on('error', (err) => {
  if (err.code === 'ENOENT') {
    // Tenta python3 se python não funcionar (apenas Linux/Mac)
    if (pythonCmd === 'python' && process.platform !== 'win32') {
      console.log('⚠️  python não encontrado, tentando python3...');
      const python3Backend = spawn('python3', ['backend.py'], {
        cwd: projectDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      python3Backend.stdout.on('data', (data) => {
        console.log(`[Python] ${data.toString().trim()}`);
      });
      
      python3Backend.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (!output.includes('WARNING: This is a development server')) {
          console.error(`[Python ERR] ${output}`);
        }
      });
      
      python3Backend.on('error', (err2) => {
        console.error('❌ Erro ao iniciar backend Python:', err2.message);
        console.error('💡 Certifique-se de que Python está instalado e as dependências estão instaladas');
        console.error('   Execute: pip install -r requirements.txt');
        process.exit(1);
      });
      
      python3Backend.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`❌ Backend Python encerrou com código ${code}`);
          process.exit(1);
        }
      });
      
      // Continua com python3Backend ao invés de pythonBackend
      setTimeout(() => {
        console.log('\n📦 Iniciando servidor Node.js...\n');
        
        const nodeServer = spawn('node', ['server.js'], {
          cwd: projectDir,
          env: { ...process.env },
          stdio: 'inherit'
        });

        nodeServer.on('error', (err) => {
          console.error('❌ Erro ao iniciar servidor Node.js:', err.message);
          python3Backend.kill();
          process.exit(1);
        });

        nodeServer.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.error(`❌ Servidor Node.js encerrou com código ${code}`);
          }
          python3Backend.kill();
          process.exit(code || 0);
        });

        process.on('SIGTERM', () => {
          console.log('\n🛑 Recebido SIGTERM, encerrando serviços...');
          nodeServer.kill();
          python3Backend.kill();
          process.exit(0);
        });

        process.on('SIGINT', () => {
          console.log('\n🛑 Recebido SIGINT, encerrando serviços...');
          nodeServer.kill();
          python3Backend.kill();
          process.exit(0);
        });
      }, 3000);
      
      return; // Sai da função para não continuar com o pythonBackend original
    } else {
      console.error('❌ Erro ao iniciar backend Python:', err.message);
      console.error('💡 Certifique-se de que Python está instalado e as dependências estão instaladas');
      console.error('   Execute: pip install -r requirements.txt');
      process.exit(1);
    }
  } else {
    console.error('❌ Erro ao iniciar backend Python:', err.message);
    console.error('💡 Certifique-se de que Python está instalado e as dependências estão instaladas');
    console.error('   Execute: pip install -r requirements.txt');
    process.exit(1);
  }
});

pythonBackend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Backend Python encerrou com código ${code}`);
    process.exit(1);
  }
});

// Aguarda alguns segundos para o Python iniciar
setTimeout(() => {
  console.log('\n📦 Iniciando servidor Node.js...\n');
  
  // Inicia servidor Node.js
  const nodeServer = spawn('node', ['server.js'], {
    cwd: projectDir,
    env: { ...process.env },
    stdio: 'inherit'
  });

  nodeServer.on('error', (err) => {
    console.error('❌ Erro ao iniciar servidor Node.js:', err.message);
    pythonBackend.kill();
    process.exit(1);
  });

  nodeServer.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Servidor Node.js encerrou com código ${code}`);
    }
    pythonBackend.kill();
    process.exit(code || 0);
  });

  // Trata encerramento gracioso
  process.on('SIGTERM', () => {
    console.log('\n🛑 Recebido SIGTERM, encerrando serviços...');
    nodeServer.kill();
    pythonBackend.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Recebido SIGINT, encerrando serviços...');
    nodeServer.kill();
    pythonBackend.kill();
    process.exit(0);
  });
}, 3000); // Aguarda 3 segundos para Python iniciar
