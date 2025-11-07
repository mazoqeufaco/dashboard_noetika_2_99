// Script para matar processos usando uma porta específica
const { exec } = require('child_process');
const port = process.argv[2] || 8000;
const isWindows = process.platform === 'win32';

console.log(`\n🔍 Procurando processos na porta ${port}...\n`);

if (isWindows) {
  // Windows: usa netstat e taskkill
  exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
    if (err || !stdout.trim()) {
      console.log(`✅ Nenhum processo encontrado na porta ${port}`);
      process.exit(0);
    }

    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const match = line.trim().match(/\s+(\d+)\s*$/);
      if (match) {
        pids.add(match[1]);
      }
    });

    if (pids.size === 0) {
      console.log(`✅ Nenhum processo encontrado na porta ${port}`);
      process.exit(0);
    }

    console.log(`Encontrados ${pids.size} processo(s):`);
    pids.forEach(pid => {
      console.log(`  - PID ${pid}`);
    });

    console.log(`\nFinalizando processos...\n`);

    let completed = 0;
    pids.forEach(pid => {
      exec(`taskkill /F /PID ${pid}`, (killErr) => {
        completed++;
        if (!killErr) {
          console.log(`✅ PID ${pid} finalizado`);
        } else {
          console.log(`⚠️  Não foi possível finalizar PID ${pid}`);
        }

        if (completed === pids.size) {
          console.log(`\n✅ Concluído!\n`);
          process.exit(0);
        }
      });
    });
  });
} else {
  // Linux/Mac: usa lsof
  exec(`lsof -ti:${port}`, (err, stdout) => {
    if (err || !stdout.trim()) {
      console.log(`✅ Nenhum processo encontrado na porta ${port}`);
      process.exit(0);
    }

    const pids = stdout.trim().split('\n').filter(Boolean);
    console.log(`Encontrados ${pids.length} processo(s):`);
    pids.forEach(pid => console.log(`  - PID ${pid}`));

    console.log(`\nFinalizando processos...\n`);

    pids.forEach(pid => {
      exec(`kill -9 ${pid}`, (killErr) => {
        if (!killErr) {
          console.log(`✅ PID ${pid} finalizado`);
        } else {
          console.log(`⚠️  Não foi possível finalizar PID ${pid}`);
        }
      });
    });

    setTimeout(() => {
      console.log(`\n✅ Concluído!\n`);
      process.exit(0);
    }, 500);
  });
}
