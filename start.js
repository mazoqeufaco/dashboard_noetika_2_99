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
console.log(`   Diretório: ${projectDir}`);
console.log(`   Backend path: ${path.join(projectDir, 'backend.py')}`);

// Verifica se backend.py existe
const backendPath = path.join(projectDir, 'backend.py');
if (!fs.existsSync(backendPath)) {
  console.error(`❌ ERRO: backend.py não encontrado em ${backendPath}`);
  process.exit(1);
}

console.log('✅ backend.py encontrado, iniciando...');

// Verifica se python3 está disponível
const { execSync } = require('child_process');
try {
  const pythonVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf-8', timeout: 5000 });
  console.log(`✅ ${pythonCmd} encontrado: ${pythonVersion.trim()}`);
} catch (err) {
  console.error(`❌ ${pythonCmd} não encontrado ou não acessível:`, err.message);
  process.exit(1);
}

// Verifica se backend.py é executável e tem conteúdo
try {
  const stats = fs.statSync(backendPath);
  console.log(`✅ backend.py existe (${stats.size} bytes)`);
  
  // Tenta verificar se o Python consegue importar o backend (teste rápido)
  try {
    const testResult = execSync(`${pythonCmd} -c "import sys; sys.path.insert(0, '${projectDir}'); import backend; print('✅ backend.py pode ser importado')"`, { 
      encoding: 'utf-8', 
      timeout: 5000,
      cwd: projectDir 
    });
    console.log(testResult.trim());
  } catch (testErr) {
    console.warn('⚠️  Aviso: Não foi possível testar importação do backend.py:', testErr.message);
    console.warn('   Isso pode ser normal se houver dependências faltando, mas o processo continuará.');
  }
} catch (err) {
  console.error(`❌ Erro ao verificar backend.py:`, err.message);
  process.exit(1);
}

console.log('📋 Variáveis de ambiente Python:');
console.log(`   FLASK_ENV: ${process.env.FLASK_ENV || 'não definido'}`);
console.log(`   ENVIRONMENT: ${process.env.ENVIRONMENT || 'não definido'}`);
console.log(`   BACKEND_PORT: ${process.env.BACKEND_PORT || 'não definido'}`);
console.log(`   PORT: ${process.env.PORT || 'não definido'}`);
console.log(`   PWD: ${process.env.PWD || process.cwd()}`);

console.log('🔧 Tentando spawnar processo Python...');
const pythonBackend = spawn(pythonCmd, ['backend.py'], {
  cwd: projectDir,
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

console.log('✅ spawn() chamado, aguardando evento spawn...');

// Captura TODOS os logs do Python (stdout e stderr)
pythonBackend.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(`[Python] ${output}`);
  }
});

pythonBackend.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    // Mostra TODOS os erros do Python para debug
    console.error(`[Python ERR] ${output}`);
  }
});

// Log quando o processo Python inicia
pythonBackend.on('spawn', () => {
  console.log('✅ Processo Python spawnado com sucesso (PID:', pythonBackend.pid, ')');
  console.log('⏳ Aguardando saída do backend Python...');
});

// Log imediatamente após criar o processo (pode ser antes do spawn)
setTimeout(() => {
  if (pythonBackend.pid) {
    console.log('✅ Processo Python criado (PID:', pythonBackend.pid, ')');
  } else {
    console.error('❌ ERRO: Processo Python NÃO tem PID após 100ms!');
    console.error('   Isso indica que o spawn falhou silenciosamente.');
    console.error('   Verifique se python3 está instalado e acessível.');
  }
}, 100);

// Log adicional após 1 segundo
setTimeout(() => {
  if (pythonBackend.pid) {
    console.log('✅ Processo Python ainda ativo após 1s (PID:', pythonBackend.pid, ')');
  } else {
    console.error('❌ ERRO CRÍTICO: Processo Python não tem PID após 1 segundo!');
  }
}, 1000);

pythonBackend.on('error', (err) => {
  console.error('❌ ERRO ao spawnar processo Python:', err);
  console.error('   Código:', err.code);
  console.error('   Mensagem:', err.message);
  console.error('   Stack:', err.stack);
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

pythonBackend.on('exit', (code, signal) => {
  console.error(`❌ Backend Python encerrou!`);
  console.error(`   Código de saída: ${code}`);
  console.error(`   Sinal: ${signal || 'nenhum'}`);
  if (code !== 0 && code !== null) {
    console.error(`❌ Backend Python falhou com código ${code}`);
    console.error('💡 Verifique os logs do Python acima para mais detalhes');
    process.exit(1);
  } else if (code === 0) {
    console.log('⚠️  Backend Python encerrou normalmente (código 0) - isso não deveria acontecer em produção');
  }
});

// Função para verificar se o backend Python está pronto
function waitForBackend(maxAttempts = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    let attempts = 0;
    
    const checkBackend = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:5000/api/health`, { timeout: 500 }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          console.log('✅ Backend Python está pronto!');
          resolve();
        } else {
          if (attempts < maxAttempts) {
            setTimeout(checkBackend, delay);
          } else {
            reject(new Error('Backend Python não respondeu a tempo'));
          }
        }
      });
      
      req.on('error', () => {
        if (attempts < maxAttempts) {
          console.log(`⏳ Aguardando backend Python... (tentativa ${attempts}/${maxAttempts})`);
          setTimeout(checkBackend, delay);
        } else {
          reject(new Error('Backend Python não está disponível'));
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(checkBackend, delay);
        } else {
          reject(new Error('Timeout aguardando backend Python'));
        }
      });
    };
    
    // Aguarda 5 segundos antes da primeira tentativa (Python pode demorar para iniciar)
    console.log('⏳ Aguardando 5 segundos antes de verificar backend Python...');
    setTimeout(checkBackend, 5000);
  });
}

// Aguarda o backend Python estar pronto antes de iniciar Node.js
// Primeiro, aguarda o processo Python ser spawnado
const waitForSpawn = new Promise((resolve, reject) => {
  let spawnResolved = false;
  
  pythonBackend.on('spawn', () => {
    if (!spawnResolved) {
      spawnResolved = true;
      console.log('✅ Processo Python spawnado, aguardando backend estar pronto...');
      resolve();
    }
  });
  
  // Timeout de segurança: se após 3 segundos não houve spawn, verifica se tem PID
  setTimeout(() => {
    if (!spawnResolved) {
      if (pythonBackend.pid) {
        console.log('⚠️  Processo Python tem PID mas evento spawn não foi disparado (PID:', pythonBackend.pid, ')');
        spawnResolved = true;
        resolve();
      } else {
        console.error('❌ ERRO: Processo Python não foi spawnado após 3 segundos!');
        reject(new Error('Python não foi spawnado'));
      }
    }
  }, 3000);
});

waitForSpawn
  .then(() => {
    console.log('⏳ Aguardando backend Python estar pronto (health check)...');
    return waitForBackend();
  })
  .then(() => {
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
  })
  .catch((err) => {
    console.error('❌ Erro ao aguardar backend Python:', err.message);
    console.error('💡 Verifique os logs do backend Python acima');
    if (pythonBackend.pid) {
      pythonBackend.kill();
    }
    process.exit(1);
  });
