import { initEntrada } from './entrada.js';

const IMG_SRC = 'public/triangulo2.png';
const CSV_ZSCORES = 'data/Matriz de Decisão - Zscores dash covs(1).csv';
const CSV_NOMES   = 'data/Matriz de Decisão - só nomes e coordenadas.csv';
const SOLUTION_DESC = 'solution_description5.json';

// -------- CSV util --------
function parseCSV(text){
  // Se houver ';' no arquivo (padrão BR/Excel), usa ';' como separador;
  // caso contrário, usa ','
  let sep = (text.indexOf(';') > -1) ? ';' : ',';
  const lines = text.replace(/\r/g,'').split('\n').filter(l=>l.trim().length>0);
  if(!lines.length) return {header:[], rows:[]};
  const header = lines[0].split(sep).map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep);
    const o = {}; header.forEach((h,j)=>o[h]=(cols[j]??'').trim());
    rows.push(o);
  }
  return {header, rows};
}
const coerceNum = s => {
  if (s === null || s === undefined || s === '') return 0;
  const cleaned = String(s).replace(/"/g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

async function loadCSVs(){
  const [zs, nm] = await Promise.allSettled([
    fetch(CSV_ZSCORES, {cache:'no-store'}).then(r=>r.text()),
    fetch(CSV_NOMES,   {cache:'no-store'}).then(r=>r.text())
  ]);
  const zText = zs.status==='fulfilled' ? zs.value : '';
  const nText = nm.status==='fulfilled' ? nm.value : '';
  return { z: parseCSV(zText), n: parseCSV(nText) };
}

let solutionDescriptions = null;
async function loadSolutionDescriptions(){
  try {
    const response = await fetch(SOLUTION_DESC, {cache:'no-store'});
    if(!response.ok) throw new Error('Não foi possível carregar solution_description5.json');
    solutionDescriptions = await response.json();
    return solutionDescriptions;
  } catch(err) {
    console.warn('Erro ao carregar solution_description5.json:', err);
    return null;
  }
}

// -------- helpers de header/coord --------
function headerLike(header, key){
  const norm = s => s.toLowerCase().replace(/\s+/g,'');
  const K = norm(key);
  return header.find(h => norm(h).includes(K));
}

function parseCoord(s){
  if(!s) return null;
  const m = String(s).trim().match(/^([IVXLCDM]+)\s*[\.\-]\s*(\d+)\s*[\.\-]\s*([a-z])$/i);
  if(!m) return null;
  return { pri:m[1].toUpperCase(), sec:parseInt(m[2],10), ter:m[3].toLowerCase() };
}
function romanToInt(r){
  const map={I:1,V:5,X:10,L:50,C:100,D:500,M:1000}; let n=0, prev=0;
  for(const ch of r.split('').reverse()){ const v=map[ch]||0; if(v<prev) n-=v; else n+=v, prev=v; }
  return n;
}

// -------- ranking bruto --------
function computeRanking(zData, {r,g,b}){
  const {header, rows} = zData;
  const ZC = headerLike(header,'zcusto');
  const ZQ = headerLike(header,'zqual');
  const ZP = headerLike(header,'zprazo');
  const sC = headerLike(header,'s_zcusto') || headerLike(header,'szcusto');
  const sQ = headerLike(header,'s_zqual')  || headerLike(header,'szqual');
  const sP = headerLike(header,'s_zprazo') || headerLike(header,'szprazo');
  
  if(!ZC||!ZQ||!ZP) throw new Error('CSV de Zscores deve ter ZCusto, ZQualidade e ZPrazo.');
  
  // Verifica se temos as 9 colunas (3 Z + 3 s + 3 covariâncias)
  const covCols = header.slice(-3);
  const hasCovariances = covCols.length === 3;
  const hasErrors = sC && sQ && sP;

  const results = rows.map((row, i)=>{
    const zc=coerceNum(row[ZC]), zq=coerceNum(row[ZQ]), zp=coerceNum(row[ZP]);
    
    // r, g, b já estão entre 0 e 1 (não percentual)
    // Zranking = (-r*zc) + (g*zq) + (-b*zp)
    // NOTA: Sem divisão por 3 e sem somar 1 - os Z-scores já têm média 0 por definição
    const Zranking = (-r*zc) + (g*zq) + (-b*zp);
    
    let s_Zrank = 0;
    
    if(hasErrors){
      const sc=coerceNum(row[sC] || 0);
      const sq=coerceNum(row[sQ] || 0);
      const sp=coerceNum(row[sP] || 0);
      
      if(hasCovariances){
        // Fórmula COMPLETA com covariâncias conforme especificação
        // s0 = sqrt(r²sC² + g²sQ² + b²sP²)
        // s_Zrank = sqrt( s0² - 2*( r*g*cov(C,Q)² + r*b*cov(C,P)² - g*b*cov(Q,P)² ) )
        const cov_CQ = coerceNum(row[covCols[0]] || 0); // cov(ZCusto, ZQual)
        const cov_CP = coerceNum(row[covCols[1]] || 0); // cov(ZCusto, ZPrazo)
        const cov_QP = coerceNum(row[covCols[2]] || 0); // cov(ZQual, ZPrazo)
        
        const s0_squared = (r*sc)**2 + (g*sq)**2 + (b*sp)**2;
        const s0 = Math.sqrt(s0_squared);
        
        const correction = 2 * (
          r*g * cov_CQ**2 - 
          r*b * cov_CP**2 + 
          g*b * cov_QP**2
        );
        
        s_Zrank = Math.sqrt(Math.abs(s0_squared - correction));
      } else {
        // Fórmula SIMPLES sem covariâncias
        // s0 = sqrt(r²sC² + g²sQ² + b²sP²)
        const s0 = Math.sqrt(
          (r*sc)**2 + 
          (g*sq)**2 + 
          (b*sp)**2
        );
        s_Zrank = s0; // Sem covariâncias, s_Zrank = s0
      }
    }
    
    return { idx:i, id:(i+1), Zranking, s_Zrank };
  });

  // Reescalonamento para nota absoluta 0-10 baseado em distribuição gaussiana
  // Zranking <= -3 → nota 0, Zranking >= +3 → nota 10
  // Entre -3 e +3: interpolação linear (99,7% dos resultados estão nesse intervalo)
  const Z_MIN = -3;
  const Z_MAX = 3;
  const Z_RANGE = Z_MAX - Z_MIN; // 6
  
  // Calcula número de casas decimais baseado no menor erro (2 algarismos significativos)
  function significativeDecimalPlaces(n){
    if(n === 0) return 2;
    const absN = Math.abs(n);
    
    // Converte para notação científica para identificar posição do primeiro dígito
    const exp = Math.floor(Math.log10(absN));
    
    // Número de casas decimais para números < 1 é |expoente|, para >= 1 é 2
    if(exp < 0){
      // Para 0.01 (exp=-2), precisamos de 2 casas
      // Para 0.001 (exp=-3), precisamos de 3 casas
      return Math.abs(exp);
    } else {
      // Para números >= 1, sempre 2 casas
      return 2;
    }
  }
  
  const sZValues = results.map(r => r.s_Zrank).filter(e => e > 0);
  // Se não houver erros, usa 2 casas decimais padrão
  const numDecimals = sZValues.length > 0 
    ? significativeDecimalPlaces(Math.min(...sZValues))
    : 2;
  
  const processed = results.map(r => {
    // Mapeia de [-3, +3] para [0, 10] - escala absoluta baseada em distribuição gaussiana
    let nota;
    if(r.Zranking <= Z_MIN) {
      nota = 0; // Zranking <= -3 → nota 0
    } else if(r.Zranking >= Z_MAX) {
      nota = 10; // Zranking >= +3 → nota 10
    } else {
      // Interpolação linear entre -3 e +3
      nota = ((r.Zranking - Z_MIN) / Z_RANGE) * 10;
    }
    
    // Reescalona margem de erro proporcionalmente para a escala 0-10
    const margemErroReescalada = (r.s_Zrank / Z_RANGE) * 10;
    const multiplier = Math.pow(10, numDecimals);
    return { 
      ...r, 
      nota: Math.round(nota * multiplier) / multiplier,
      margemErro: Math.round(margemErroReescalada * multiplier) / multiplier
    };
  });
  
  // Retorna os resultados junto com o número de casas decimais
  return { items: processed, decimals: numDecimals };
}

// -------- enriquece com nomes/coords --------
function enrichWithNames(rows, namesParsed){
  const nameCol  = headerLike(namesParsed.header, 'nome') || namesParsed.header[0];
  const coordCol = headerLike(namesParsed.header, 'coordenadas') || headerLike(namesParsed.header,'coord');
  return rows.map(r=>{
    const nome = namesParsed.rows[r.idx]?.[nameCol] ?? `Sol ${r.id}`;
    let coordStr = namesParsed.rows[r.idx]?.[coordCol] ?? '';
    const coordOriginal = coordStr; // Guarda original
    // Normaliza: III.1a -> III.1.a, mas mantém busca por original também
    coordStr = coordStr.replace(/(\d+)([a-z])/i, '$1.$2'); // III.1a -> III.1.a
    const coord = parseCoord(coordStr) || parseCoord(coordOriginal);
    return { ...r, nome, coordStr, coordOriginal, coord };
  });
}

// -------- Clustering GMM simplificado --------
function gmmCluster(items, maxComponents = 8){
  if(items.length <= 1) return items.map((item, i) => ({...item, cluster: 1}));
  if(items.length <= 3) return items.map((item, i) => ({...item, cluster: i+1}));
  
  const x = items.map(item => item.nota);
  const n = x.length;
  
  // Encontra número ótimo de clusters usando método do joelho em distâncias
  function findOptimalK(data, maxK){
    if(data.length <= maxK) return Math.min(3, data.length);
    
    const sorted = [...data].sort((a,b) => a - b);
    const bics = [];
    
    // Testa de 1 até maxK clusters
    for(let k = 1; k <= Math.min(maxK, n-1); k++){
      // K-means simples para inicialização
      const centroids = kmeansInit(sorted, k);
      const labels = assignClusters(sorted, centroids);
      const bic = calculateBIC(sorted, labels, k);
      bics.push(bic);
    }
    
    // Encontra o mínimo de BIC
    let optimalK = 1;
    let minBIC = bics[0];
    for(let i = 1; i < bics.length; i++){
      if(bics[i] < minBIC){
        minBIC = bics[i];
        optimalK = i + 1;
      }
    }
    
    return optimalK;
  }
  
  function kmeansInit(data, k){
    const min = Math.min(...data);
    const max = Math.max(...data);
    const centroids = [];
    for(let i = 0; i < k; i++){
      centroids.push(min + (max - min) * (i + 0.5) / k);
    }
    return centroids;
  }
  
  function assignClusters(data, centroids){
    return data.map(x => {
      let minDist = Infinity;
      let cluster = 0;
      centroids.forEach((c, i) => {
        const dist = Math.abs(x - c);
        if(dist < minDist){
          minDist = dist;
          cluster = i;
        }
      });
      return cluster;
    });
  }
  
  function calculateBIC(data, labels, k){
    const n = data.length;
    if(k === 1){
      const mean = data.reduce((a,b) => a+b, 0) / n;
      const variance = data.reduce((sum, x) => sum + (x - mean)**2, 0) / n;
      const logLikelihood = -n * 0.5 * Math.log(2 * Math.PI * variance) - n / 2;
      return -2 * logLikelihood + k * Math.log(n);
    }
    
    const clusters = {};
    labels.forEach((label, i) => {
      if(!clusters[label]) clusters[label] = [];
      clusters[label].push(data[i]);
    });
    
    let logLikelihood = 0;
    Object.values(clusters).forEach(cluster => {
      if(cluster.length === 0) return;
      const mean = cluster.reduce((a,b) => a+b, 0) / cluster.length;
      const variance = cluster.reduce((sum, x) => sum + (x - mean)**2, 0) / cluster.length || 0.001;
      logLikelihood -= cluster.length * 0.5 * Math.log(2 * Math.PI * variance);
      logLikelihood -= cluster.reduce((sum, x) => sum + (x - mean)**2, 0) / (2 * variance);
    });
    
    return -2 * logLikelihood + k * Math.log(n);
  }
  
  // Executa clustering
  const optimalK = findOptimalK(x, maxComponents);
  const centroids = kmeansInit(x, optimalK);
  
  // Atribui clusters usando distância
  const sorted = [...items].sort((a,b) => b.nota - a.nota);
  const sortedX = sorted.map(item => item.nota);
  const labels = assignClusters(sortedX, centroids);
  
  // Mapeia labels sequencialmente (0-based para 1-based)
  const uniqueLabels = [...new Set(labels)].sort((a,b) => {
    const meanA = sortedX.filter((_, i) => labels[i] === a).reduce((s,x) => s+x, 0) / labels.filter(l => l === a).length;
    const meanB = sortedX.filter((_, i) => labels[i] === b).reduce((s,x) => s+x, 0) / labels.filter(l => l === b).length;
    return meanB - meanA; // maior média = melhor cluster
  });
  
  const labelMap = {};
  uniqueLabels.forEach((oldLabel, i) => {
    labelMap[oldLabel] = i + 1;
  });
  
  return sorted.map((item, i) => ({
    ...item,
    cluster: labelMap[labels[i]]
  }));
}

function smartCluster(items){
  return gmmCluster(items, 8);
}

// -------- Nomes dos clusters --------
function getClusterName(clusterId, totalClusters){
  const names = ['Ouro', 'Prata', 'Bronze', 'Ferro', 'Barro', 'Lama', 'Nem Olhe', 'Olhe Menos'];
  // Validação: clusterId deve ser um número válido maior que 0
  if(!clusterId || isNaN(clusterId) || clusterId < 1) return 'N/A';
  if(clusterId <= names.length && clusterId > 0) return names[clusterId - 1];
  return `Cluster ${clusterId}`;
}

// -------- PÓDIO por cluster --------
function renderPodiumClusters(items, decimals){
  const host = document.getElementById('podium');
  if(!host) return;

  // Aplica clustering inteligente
  const clustered = smartCluster(items);
  
  // Agrupa por cluster
  const clusters = new Map();
  for(const item of clustered){
    const cid = item.cluster;
    if(!clusters.has(cid)) clusters.set(cid, { maxNota: -Infinity, items: [] });
    const c = clusters.get(cid);
    c.items.push(item);
    if(item.nota > c.maxNota) c.maxNota = item.nota;
  }
  
  // Ordena clusters pela melhor nota
  const ordered = [...clusters.entries()].sort((a,b)=> b[1].maxNota - a[1].maxNota);
  const totalClusters = ordered.length;
  // Mostra apenas os 3 primeiros clusters no pódio
  const displayClusters = ordered.slice(0,3);

  const medals = ['🥇','🥈','🥉','🏅','🏅','🏅','🏅','🏅'];
  const classes = ['medal-1','medal-2','medal-3','medal-4','medal-5','medal-6','medal-7','medal-8'];

  const cards = displayClusters.map(([cid, group], i)=>{
    // ordena soluções internas por nota desc (maiores em cima)
    group.items.sort((a,b)=> b.nota - a.nota);
    // lista de links (nome + coord) - mostra todos os itens do cluster
    const topItems = group.items;
    const links = topItems.map(it=>{
      const label = `${it.nome} (${it.coordStr || ''})`;
      const coord = it.coordStr || '';
      const href  = `detalhe.html?sol=${encodeURIComponent(it.nome)}&coord=${encodeURIComponent(coord)}`;
      return `<a class="podium-link" href="${href}">${label}</a>`;
    }).join('');
    const best = group.items[0];
    const scoreLine = best ? `<div class="podium-score">melhor nota: ${best.nota.toFixed(decimals)} • margem de erro: ${best.margemErro.toFixed(decimals)}</div>` : '';
    const clusterName = getClusterName(cid, totalClusters);
    return `
      <div class="podium-card">
        <div class="podium-medal ${classes[i]}">${medals[i]} ${clusterName}</div>
        ${links}
        ${scoreLine}
      </div>`;
  }).join('');

  host.innerHTML = cards || '<em>Sem dados.</em>';
}

// -------- Tabela (ranking completo) --------
function renderTable(items, decimals, priorities){
  const host = document.getElementById('table');
  if(!items?.length){ host.innerHTML = '<em>Nenhum resultado.</em>'; return; }
  
  // Aplica clustering e ordena por nota
  const clustered = smartCluster(items);
  const sorted = clustered.sort((a,b) => b.nota - a.nota);
  
  const head = `<thead><tr><th>#</th><th>Cluster</th><th>Nome</th><th class="num">Nota</th><th class="num">Margem de Erro</th></tr></thead>`;
  const body = sorted.map((r,i)=>{
    const coord = r.coordStr || '';
    const href = `detalhe.html?sol=${encodeURIComponent(r.nome)}&coord=${encodeURIComponent(coord)}`;
    const clusterName = getClusterName(r.cluster, Math.max(...clustered.map(x => x.cluster)));
    return `<tr>
      <td>${i+1}</td>
      <td><span class="cluster-badge cluster-${r.cluster}">${clusterName}</span></td>
      <td><a href="${href}">${r.nome} ${r.coordStr?`(${r.coordStr})`:''}</a></td>
      <td class="num">${r.nota.toFixed(decimals)}</td>
      <td class="num">${r.margemErro.toFixed(decimals)}</td>
    </tr>`;
  }).join('');
  host.innerHTML = `<table class="table">${head}<tbody>${body}</tbody></table>`;
  
  // Renderiza gráfico de clusters
  renderClusterPlot(clustered, decimals, priorities);
}

// -------- Gráfico de clusters 1D --------
function renderClusterPlot(items, decimals, priorities){
  const host = document.getElementById('clusterPlot');
  if(!host || !items?.length) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 380;
  canvas.style.width = '100%';
  canvas.style.maxWidth = '1000px';
  canvas.style.height = 'auto';
  canvas.style.background = '#0e0e0e';
  canvas.style.border = '1px solid #222';
  canvas.style.borderRadius = '12px';
  canvas.style.marginTop = '16px';
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 90, right: 40, bottom: 55, left: 70 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  
  // Extrai dados
  // Ordena por nota (maior para menor) para classificação
  const sorted = [...items].sort((a,b) => b.nota - a.nota);
  const y = sorted.map(item => item.nota); // Nota no eixo Y
  const x = sorted.map((item, idx) => idx + 1); // Classificação (1º, 2º, 3º...) no eixo X
  const clusters = sorted.map(item => item.cluster);
  
  // Escala fixa de 0 a 10
  const minY = 0;
  const maxY = 10;
  const rangeY = 10;
  const maxX = sorted.length;
  
  // Cores para clusters: Ouro, Prata, Bronze, Ferro, Barro, Lama, Nem Olhe, Olhe Menos
  const colors = [
    '#ffd700', '#c0c0c0', '#cd7f32', '#708090', 
    '#8b4513', '#654321', '#2F4F2F', '#1c1c1c'
  ];
  // Lama (índice 5): marrom escuro #654321
  // Nem Olhe (índice 6): verde escuro #2F4F2F
  
  // Limpa canvas
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, width, height);
  
  // Título (duas linhas acima do gráfico)
  ctx.fillStyle = '#cfcfcf';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Nota x Classificação', width / 2, 22);
  
  // Subtítulo com prioridades
  if(priorities){
    const rPct = (priorities.r * 100).toFixed(1);
    const gPct = (priorities.g * 100).toFixed(1);
    const bPct = (priorities.b * 100).toFixed(1);
    ctx.fillStyle = '#b8b8b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`com prioridades em: ${rPct}% Custo, ${gPct}% Qualidade e ${bPct}% Prazo`, width / 2, 42);
  }
  
  // Função para obter marcador baseado no cluster (define antes de usar)
  const maxCluster = Math.max(...clusters);
  function drawMarker(ctx, x, y, clusterId, color){
    const name = getClusterName(clusterId, maxCluster);
    
    if(name === 'Ferro' || name === 'Barro'){
      // Quadrado
      ctx.fillStyle = color;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x - 5, y - 5, 10, 10);
    } else if(name === 'Lama' || name === 'Nem Olhe' || name === 'Olhe Menos'){
      // X
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
    } else {
      // Círculo (Ouro, Prata, Bronze)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  
  // Legenda (desenha antes do grid para criar espaçamento)
  const uniqueClusters = [...new Set(clusters)].sort((a,b) => a - b); // Ordem crescente (1,2,3...)
  ctx.globalAlpha = 1;
  
  // Título da legenda
  ctx.fillStyle = '#cfcfcf';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Legenda:', padding.left, 60);
  
  ctx.font = '11px system-ui, sans-serif';
  let legendX = padding.left;
  let legendY = 75; // Espaço após título da legenda
  let maxLegendY = legendY; // Rastreia altura máxima da legenda
  
  uniqueClusters.forEach(clusterId => {
    const color = clusterId <= colors.length ? colors[clusterId - 1] : '#888';
    const name = getClusterName(clusterId, maxCluster);
    
    // Desenha marcador na legenda
    drawMarker(ctx, legendX + 5, legendY, clusterId, color);
    
    ctx.fillStyle = '#eaeaea';
    ctx.fillText(name, legendX + 14, legendY + 4);
    legendX += 85;
    if(legendX > width - 100){
      legendX = padding.left;
      legendY += 20;
    }
    maxLegendY = Math.max(maxLegendY, legendY + 12); // Altura da linha de legenda
  });
  
  // Ajusta padding.top para deixar espaço entre legenda e gráfico
  const legendHeight = maxLegendY - 60; // Altura da legenda desde o título
  const spaceAfterLegend = 15; // Espaço extra após legenda
  const adjustedPaddingTop = maxLegendY + spaceAfterLegend;
  const adjustedPlotHeight = height - adjustedPaddingTop - padding.bottom;
  
  // Grid horizontal (para Nota) - escala fixa 0 a 10
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  for(let i = 0; i <= 10; i++){
    const value = i;
    const yPos = adjustedPaddingTop + adjustedPlotHeight - ((value / 10) * adjustedPlotHeight);
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(padding.left + plotWidth, yPos);
    ctx.stroke();
  }
  
  // Grid vertical (para Classificação)
  const numTicks = Math.min(20, maxX);
  for(let i = 0; i <= numTicks; i++){
    const xPos = padding.left + (plotWidth * i / numTicks);
    ctx.beginPath();
    ctx.moveTo(xPos, adjustedPaddingTop);
    ctx.lineTo(xPos, adjustedPaddingTop + adjustedPlotHeight);
    ctx.stroke();
  }
  
  // Eixo Y (Nota) - lado esquerdo (escala fixa 0 a 10)
  ctx.fillStyle = '#b8b8b8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for(let i = 0; i <= 10; i++){
    const value = i;
    const yPos = adjustedPaddingTop + adjustedPlotHeight - ((value / 10) * adjustedPlotHeight);
    ctx.fillText(value.toFixed(decimals), padding.left - 12, yPos + 5);
  }
  
  // Label eixo Y (maior fonte)
  ctx.fillStyle = '#eaeaea';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.save();
  ctx.translate(18, (adjustedPaddingTop + adjustedPlotHeight / 2));
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Nota', 0, 0);
  ctx.restore();
  
  // Eixo X (Classificação) - parte inferior
  ctx.fillStyle = '#b8b8b8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const tickStep = Math.max(1, Math.floor(maxX / 20));
  for(let i = 0; i <= maxX; i += tickStep){
    const xPos = padding.left + ((i / maxX) * plotWidth);
    ctx.fillText(i.toString(), xPos, height - 20);
  }
  
  // Label eixo X (maior fonte, mais abaixo)
  ctx.fillStyle = '#eaeaea';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Classificação', width / 2, height - 8);
  
  // Plota pontos
  
  sorted.forEach((item, i) => {
    const clusterId = item.cluster;
    const xValue = i + 1; // Classificação (1, 2, 3...)
    const yValue = item.nota; // Nota
    const xPos = padding.left + ((xValue / maxX) * plotWidth);
    const yPos = adjustedPaddingTop + adjustedPlotHeight - ((yValue / 10) * adjustedPlotHeight);
    
    // Cor do cluster
    const color = clusterId <= colors.length ? colors[clusterId - 1] : '#888';
    
    // Desenha barras de erro verticais (baseadas em margemErro)
    const error = item.margemErro || 0;
    if(error > 0){
      const errorHeight = (error / 10) * adjustedPlotHeight;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      // Linha vertical principal
      ctx.beginPath();
      ctx.moveTo(xPos, yPos - errorHeight);
      ctx.lineTo(xPos, yPos + errorHeight);
      ctx.stroke();
      // Marcadores nas extremidades
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xPos - 3, yPos - errorHeight);
      ctx.lineTo(xPos + 3, yPos - errorHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xPos - 3, yPos + errorHeight);
      ctx.lineTo(xPos + 3, yPos + errorHeight);
      ctx.stroke();
    }
    
    // Desenha marcador baseado no tipo de cluster
    ctx.globalAlpha = 0.9;
    drawMarker(ctx, xPos, yPos, clusterId, color);
  });
  
  // Limpa host e adiciona canvas
  host.innerHTML = '';
  host.appendChild(canvas);
}

// -------- Árvore --------
// Estrutura da árvore conforme figura fornecida
const TREE_STRUCTURE = {
  root: { label: 'seu problema', color: '#000' },
  branches: {
    'I': { 
      label: 'Soluções prontas',
      children: {
        '1': { label: '1', solutions: ['I.1', 'I.2', 'I.3'] }
      }
    },
    'II': { 
      label: 'IA por API',
      children: {
        '1': { 
          label: 'sem anonimização',
          solutions: ['II.1.a', 'II.1.b']
        },
        '2': { 
          label: 'com anonimização',
          solutions: ['II.2.a', 'II.2.b']  // II.2.a = MVP apres 1 (no JSON), mas CSV tem II.2
        }
      }
    },
    'III': { 
      label: 'IA própria',
      children: {
        '1': { 
          label: 'sem engenharia reversa',
          solutions: ['III.1a', 'III.1.b']  // III.1a no CSV = III.1.a no JSON (será normalizado)
        },
        '2': { 
          label: 'com engenharia reversa',
          solutions: ['III.2.a', 'III.2.b', 'III.2.c']
        }
      }
    }
  }
};

function buildTree(items){
  // Cria um mapa coordStr -> item para busca rápida
  // Inclui tanto coordStr normalizado quanto coordOriginal para buscar variações
  const itemMap = new Map();
  for(const it of items){
    if(it.coordStr){
      // Adiciona com coordStr normalizado
      itemMap.set(it.coordStr, it);
      
      // Também adiciona coordOriginal se existir e for diferente
      if(it.coordOriginal && it.coordOriginal !== it.coordStr){
        itemMap.set(it.coordOriginal, it);
      }
      
      // Mapeamentos específicos para variações comuns
      // II.2 no CSV pode ser II.2.a no JSON
      if(it.coordStr === 'II.2' || it.coordOriginal === 'II.2'){
        itemMap.set('II.2.a', it);
        itemMap.set('II.2', it); // Mantém também
      }
      // III.1a no CSV = III.1.a no JSON (já normalizado)
      if(it.coordOriginal === 'III.1a'){
        itemMap.set('III.1a', it); // Formato do CSV
      }
    }
  }
  return itemMap;
}

function renderTree(itemMap, decimals){
  const host = document.getElementById('tree');
  if(!host){ return; }
  if(!itemMap || itemMap.size === 0){ 
    host.innerHTML='<em>Nenhuma solução mapeada.</em>'; 
    return; 
  }

  // Limpa o host
  host.innerHTML = '';

  // Converte TREE_STRUCTURE para formato D3
  function buildD3Tree(structure, itemMap, trunkKey = null, depth = 0){
    const romans = ["I","II","III","IV","V"];
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    
    function branchLabelFor(depth, idx){
      if(depth === 1) return romans[idx] || (idx+1).toString();
      if(depth === 2) return (idx+1).toString();
      if(depth >= 3) return letters[idx] || "?";
      return "";
    }

    function convertNode(trunkKey, branchKey, branch, itemMap, currentDepth){
      const result = {
        name: branch.label,
        depth: currentDepth,
        tag: trunkKey && branchKey ? branchLabelFor(currentDepth, branchKey === '1' ? 0 : branchKey === '2' ? 1 : parseInt(branchKey) - 1) : ''
      };

      if(branch.solutions && branch.solutions.length > 0){
        // Nós terminais
        result.children = branch.solutions.map((coordStr, solIndex) => {
          // Tenta buscar primeiro pela coordenada exata, depois variações
          let item = itemMap.get(coordStr);
          
          // Se não encontrou, tenta variações (II.2 -> II.2.a, III.1a -> III.1.a)
          if(!item){
            const variations = [
              coordStr + '.a',
              coordStr.replace(/(\d+)([a-z])/i, '$1.$2'), // III.1a -> III.1.a
              coordStr.replace(/\.(\d+)$/, '.$1.a'), // II.2 -> II.2.a
            ];
            
            for(const variation of variations){
              item = itemMap.get(variation);
              if(item){
                coordStr = variation; // Atualiza coordStr para a variação encontrada
                break;
              }
            }
          }
          
          const letter = letters[solIndex] || '';
          
          return {
            name: item ? item.nome : coordStr,
            nota: item ? item.nota.toFixed(decimals) : 'N/A',
            coordStr: coordStr, // Usa a coordenada correta (pode ser variação)
            depth: currentDepth + 1,
            tag: letter,
            isLeaf: true
          };
        });
      }

      return result;
    }

    const root = {
      name: structure.root.label,
      depth: 0,
      children: []
    };

    const trunkOrder = ['I', 'II', 'III'];
    trunkOrder.forEach((trunkKey, trunkIdx) => {
      const trunk = structure.branches[trunkKey];
      if(!trunk) return;

      const trunkNode = {
        name: trunk.label,
        depth: 1,
        tag: romans[trunkIdx],
        children: []
      };

      const branchKeys = Object.keys(trunk.children).sort((a,b) => parseInt(a) - parseInt(b));
      branchKeys.forEach((branchKey, branchIdx) => {
        const branch = trunk.children[branchKey];
        const branchNode = convertNode(trunkKey, branchKey, branch, itemMap, 2);
        trunkNode.children.push(branchNode);
      });

      root.children.push(trunkNode);
    });

    return root;
  }

  const treeData = buildD3Tree(TREE_STRUCTURE, itemMap);

  // Configuração do D3
  const margin = { top: 20, right: 250, bottom: 20, left: 220 };
  const width = 1200 - margin.right - margin.left;
  const height = 700 - margin.top - margin.bottom;

  const svg = d3.select(host).append('svg')
    .attr('width', width + margin.right + margin.left)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tree = d3.layout.tree().size([height, width]);
  const diagonal = d3.svg.diagonal().projection(d => [d.y, d.x]);

  let i = 0;
  const duration = 250;

  // Inicializa árvore colapsada
  function collapse(d){
    if(d.children){
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }
  treeData.x0 = height / 2;
  treeData.y0 = 0;
  treeData.children && treeData.children.forEach(collapse);

  function update(source){
    const nodes = tree.nodes(treeData).reverse();
    const links = tree.links(nodes);

    nodes.forEach(d => { d.y = d.depth * 220; });

    // === NODES ===
    const node = svg.selectAll('g.node')
      .data(nodes, d => d.id || (d.id = ++i));

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', () => `translate(${source.y0},${source.x0})`)
      .on('click', function(d){
        if(d3.event && d3.event.target && d3.select(d3.event.target).classed('leaf-link')) return;
        toggle(d);
        update(d);
      });

    nodeEnter.append('circle')
      .attr('r', 1e-6)
      .style('fill', d => d._children ? '#cfe2ff' : '#fff')
      .style('stroke', '#333')
      .style('stroke-width', '1.5px');

    // Texto principal (azul se for folha)
    const textEnter = nodeEnter.append('text')
      .attr('class', d => d.isLeaf ? 'leaf-link' : 'internal')
      .attr('x', d => d.children || d._children ? -12 : 12)
      .attr('dy', '.35em')
      .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
      .text(d => {
        if(d.isLeaf && d.nota){
          return `${d.name} (${d.nota})`;
        }
        return d.name;
      })
      .on('click', function(d){
        if(d.isLeaf && d.coordStr){
          if(d3.event) {
            d3.event.preventDefault();
            d3.event.stopPropagation();
          }
          console.log('🌳 Árvore: clicou em', d.name, d.coordStr);
          showSolutionModal(d.name, d.coordStr);
        }
      });

    // Tag (I, II, 1, 2, a, b, c)
    nodeEnter.append('text')
      .attr('class', 'tag')
      .attr('x', d => (d.children || d._children ? -12 : 12) + (d.isLeaf ? 8 : 8))
      .attr('dy', '.35em')
      .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
      .text(d => d.tag ? ` ${d.tag}` : '');

    // Update
    const nodeUpdate = node.transition().duration(duration)
      .attr('transform', d => `translate(${d.y},${d.x})`);

    nodeUpdate.select('circle')
      .attr('r', 6)
      .style('fill', d => d._children ? '#cfe2ff' : '#fff');

    nodeUpdate.select('text').style('fill-opacity', 1);

    // Exit
    const nodeExit = node.exit().transition().duration(duration)
      .attr('transform', () => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select('circle').attr('r', 1e-6);
    nodeExit.selectAll('text').style('fill-opacity', 1e-6);

    // === LINKS ===
    const link = svg.selectAll('path.link')
      .data(links, d => d.target.id);

    link.enter().insert('path', 'g')
      .attr('class', 'link')
      .attr('d', () => {
        const o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });

    link.transition().duration(duration).attr('d', diagonal);

    link.exit().transition().duration(duration)
      .attr('d', () => {
        const o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

    // Labels nos links (I, II, 1, 2, etc.)
    const linkLabels = svg.selectAll('text.link-label')
      .data(links, d => d.target.id);

    const linkLabelsEnter = linkLabels.enter().append('text')
      .attr('class', 'link-label')
      .attr('text-anchor', 'middle');

    function midX(d){ return (d.source.y + d.target.y) / 2; }
    function midY(d){ return (d.source.x + d.target.x) / 2; }

    linkLabelsEnter
      .attr('x', d => midX(d))
      .attr('y', d => midY(d) - 6)
      .text(d => {
        const kids = d.source.children || [];
        const idx = Math.max(0, kids.indexOf(d.target));
        const romans = ["I","II","III"];
        const letters = "abcdefghijklmnopqrstuvwxyz".split("");
        if(d.target.depth === 1) return romans[idx] || (idx+1).toString();
        if(d.target.depth === 2) return (idx+1).toString();
        if(d.target.depth >= 3) return letters[idx] || "?";
        return "";
      });

    linkLabels.transition().duration(duration)
      .attr('x', d => midX(d))
      .attr('y', d => midY(d) - 6);

    linkLabels.exit().remove();

    nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
  }

  function toggle(d){
    if(d.children){
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
  }

  update(treeData);
}

// -------- toggle helpers --------
function show(el){ el.style.display='block'; }
function hide(el){ el.style.display='none'; }
function toggle(el){ el.style.display = (el.style.display==='none' || !el.style.display) ? 'block' : 'none'; }

// -------- Modal de informações da solução --------
function findSolutionById(coordStr){
  if(!solutionDescriptions || !solutionDescriptions.itens || !coordStr) return null;
  
  const normalizedCoord = coordStr.trim();
  
  // 1. Busca exata primeiro
  let solution = solutionDescriptions.itens.find(item => item.id === normalizedCoord);
  if(solution) return solution;
  
  // 2. Busca case-insensitive
  solution = solutionDescriptions.itens.find(item => 
    item.id.toLowerCase() === normalizedCoord.toLowerCase()
  );
  if(solution) return solution;
  
  // 3. Tenta variações comuns do formato
  // "II.2" → tenta "II.2.a", "II.2.b", "II.2.c"
  // "III.1a" → tenta "III.1.a", "III.1.b"
  const variations = [
    normalizedCoord, // original
    normalizedCoord.toLowerCase(), // lowercase
    normalizedCoord.toUpperCase(), // uppercase
  ];
  
  // Se termina com número, tenta adicionar .a, .b, .c (ex: "II.2" → "II.2.a")
  if(/^[IVXLCDM]+\.\d+$/i.test(normalizedCoord)){
    variations.push(
      `${normalizedCoord}.a`, 
      `${normalizedCoord}.b`, 
      `${normalizedCoord}.c`,
      `${normalizedCoord}.d` // caso tenha mais variantes
    );
  }
  
  // Se tem formato "II.2.b" mas não existe, tenta "II.2.a" (variante mais próxima)
  if(/^([IVXLCDM]+)\.(\d+)\.([b-z])$/i.test(normalizedCoord)){
    const match = normalizedCoord.match(/^([IVXLCDM]+)\.(\d+)\.([b-z])$/i);
    if(match){
      // Tenta a variante anterior (ex: II.2.b → II.2.a)
      const prevLetter = String.fromCharCode(match[3].charCodeAt(0) - 1);
      variations.push(`${match[1]}.${match[2]}.${prevLetter}`);
      variations.push(`${match[1]}.${match[2]}.a`); // Sempre tenta .a como fallback
    }
  }
  
  // Também tenta sem o último número se tiver mais de um ponto
  // "II.2.1" → tenta "II.2.a" também
  if(/^([IVXLCDM]+)\.(\d+)\.\d+$/i.test(normalizedCoord)){
    const match = normalizedCoord.match(/^([IVXLCDM]+)\.(\d+)\.\d+$/i);
    if(match){
      variations.push(`${match[1]}.${match[2]}.a`, `${match[1]}.${match[2]}.b`, `${match[1]}.${match[2]}.c`);
    }
  }
  
  // Se tem formato "III.1a" (sem ponto antes da letra), tenta "III.1.a"
  if(/^([IVXLCDM]+)\.(\d+)([a-z])$/i.test(normalizedCoord)){
    const match = normalizedCoord.match(/^([IVXLCDM]+)\.(\d+)([a-z])$/i);
    if(match){
      variations.push(`${match[1]}.${match[2]}.${match[3]}`);
      variations.push(`${match[1]}.${match[2]}.${match[3].toLowerCase()}`);
    }
  }
  
  // Se tem formato "III.1.b", tenta "III.1b" também
  if(/^([IVXLCDM]+)\.(\d+)\.([a-z])$/i.test(normalizedCoord)){
    const match = normalizedCoord.match(/^([IVXLCDM]+)\.(\d+)\.([a-z])$/i);
    if(match){
      variations.push(`${match[1]}.${match[2]}${match[3]}`);
    }
  }
  
  // Tenta todas as variações
  for(const variant of variations){
    solution = solutionDescriptions.itens.find(item => item.id === variant);
    if(solution) return solution;
    
    // Case-insensitive também
    solution = solutionDescriptions.itens.find(item => 
      item.id.toLowerCase() === variant.toLowerCase()
    );
    if(solution) return solution;
  }
  
  // 4. Último recurso: usar parseCoord e tentar montar o formato
  const coord = parseCoord(normalizedCoord);
  if(coord){
    const idFormats = [
      `${coord.pri}.${coord.sec}${coord.ter ? '.' + coord.ter : ''}`,
      `${coord.pri}.${coord.sec}${coord.ter || '.a'}`,
    ];
    for(const idFormat of idFormats){
      solution = solutionDescriptions.itens.find(item => item.id === idFormat);
      if(solution) return solution;
    }
  }
  
  return null;
}

// Função legada para compatibilidade (mantida caso algum link ainda use nome)
function findSolutionByName(nome){
  if(!solutionDescriptions || !solutionDescriptions.itens || !nome) return null;
  
  const normalizedNome = nome.trim();
  
  // 1. Busca exata por nome_curto (prioridade) ou nome (fallback)
  let solution = solutionDescriptions.itens.find(item => 
    (item.nome_curto && item.nome_curto === normalizedNome) || 
    (item.nome && item.nome === normalizedNome)
  );
  if(solution) return solution;
  
  // 2. Busca case-insensitive
  solution = solutionDescriptions.itens.find(item => 
    (item.nome_curto && item.nome_curto.toLowerCase() === normalizedNome.toLowerCase()) || 
    (item.nome && item.nome.toLowerCase() === normalizedNome.toLowerCase())
  );
  if(solution) return solution;
  
  // 3. Busca parcial (contém)
  solution = solutionDescriptions.itens.find(item => 
    (item.nome_curto && item.nome_curto.toLowerCase().includes(normalizedNome.toLowerCase())) || 
    (item.nome && item.nome.toLowerCase().includes(normalizedNome.toLowerCase()))
  );
  if(solution) return solution;
  
  return null;
}

function formatCurrency(value){
  if(!value) return 'N/A';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function showSolutionModal(solutionName, coordStr){
  console.log(`🔍 Buscando solução: nome="${solutionName}", coord="${coordStr}"`);
  
  // Prioriza busca por coordenada/ID
  let solution = null;
  if(coordStr){
    solution = findSolutionById(coordStr);
    if(solution){
      console.log(`✅ Solução encontrada por ID: "${solution.id}" - "${solution.nome_curto || solution.nome || 'N/A'}"`);
    }
  }
  
  // Fallback: busca por nome se não encontrou por ID
  if(!solution){
    solution = findSolutionByName(solutionName);
    if(solution){
      console.log(`✅ Solução encontrada por nome: "${solution.nome_curto || solution.nome || 'N/A'}"`);
    }
  }
  
  // Se ainda não encontrou e tem coordenada, tenta encontrar variante mais próxima
  if(!solution && coordStr){
    // Tenta encontrar variante da mesma linha (ex: II.2.b → II.2.a)
    const coordMatch = coordStr.match(/^([IVXLCDM]+)\.(\d+)(?:\.([a-z]))?$/i);
    if(coordMatch){
      const [, linha, num, letra] = coordMatch;
      // Tenta .a, .b, .c da mesma linha.num
      for(const variant of ['a', 'b', 'c', 'd']){
        const variantId = `${linha}.${num}.${variant}`;
        solution = solutionDescriptions.itens.find(item => item.id === variantId);
        if(solution){
          console.log(`✅ Solução encontrada por variante próxima: "${solution.id}" - "${solution.nome_curto || solution.nome || 'N/A'}"`);
          break;
        }
      }
    }
  }
  
  if(!solution){
    console.warn(`❌ Solução não encontrada`);
    console.log('   Nome:', solutionName);
    console.log('   Coordenada:', coordStr);
    console.log('💡 Soluções disponíveis:', solutionDescriptions?.itens?.map(i => `${i.id}: ${i.nome_curto || i.nome || 'N/A'}`) || []);
    alert(`Informações sobre "${solutionName}" (${coordStr || 'sem coordenada'}) não encontradas.\n\nVerifique o console (F12) para ver soluções disponíveis.`);
    return;
  }

  const modal = document.getElementById('solutionModal');
  const content = document.getElementById('solutionModalContent');
  
  // Obtém mapeamento de sinais e políticas UI
  const mapeamento = solutionDescriptions?.mapeamento_sinais?.[solution.id] || {};
  const uiPoliticas = solutionDescriptions?.ui_politicas || {};
  const ocultarCustos = uiPoliticas.modo_cliente_oculta_custos === true;
  const sigmaPct = solutionDescriptions?.premissas_gerais?.sigma_prazo_pct || {};
  const linhaTronco = solution.linha || solution.tronco || '';
  // Busca sigma do tronco (formato: tronco_I, tronco_II, tronco_III)
  const sigmaKey = linhaTronco ? `tronco_${linhaTronco}` : '';
  const sigmaValue = sigmaPct[sigmaKey] || 0;
  const sigmaTronco = (sigmaValue * 100).toFixed(0);
  
  // Determina textos dos selos
  const capturaEmoji = mapeamento.captura || solution.sinal_dados || '';
  const processamentoEmoji = mapeamento.processamento || solution.sinal_dados || '';
  const capturaTexto = capturaEmoji === '🔵' ? 'Externa 24/7' : capturaEmoji === '🟢' ? 'Interna (limitada)' : '';
  const processamentoTexto = processamentoEmoji === '🔵' ? 'Fornecedor' : processamentoEmoji === '🟢' ? 'SEG (DMZ/on-prem)' : '';
  
  // Monta o HTML do modal seguindo o layout sugerido
  const html = `
    <!-- Header -->
    <div class="solution-header">
      <h2>${solution.nome_curto || solution.nome || 'Solução'}</h2>
      <div class="solution-id">${solution.id} • Linha ${linhaTronco}</div>
    </div>

    <!-- Selos Duplos: Captura e Processamento -->
    <div class="solution-badges-double">
      <div class="badge-item">
        <span class="badge-label">Captura:</span>
        <span class="badge-value">${capturaEmoji} ${capturaTexto}</span>
      </div>
      <div class="badge-item">
        <span class="badge-label">Processamento:</span>
        <span class="badge-value">${processamentoEmoji} ${processamentoTexto}</span>
      </div>
    </div>

    <!-- Governança Resumida (cards pequenos) -->
    ${solution.processamento_dados ? `
    <div class="governance-cards">
      <div class="gov-card-small">
        <strong>Processamento:</strong> ${solution.processamento_dados.onde || ''}
      </div>
      ${solution.processamento_dados.contratos && solution.processamento_dados.contratos.length > 0 ? `
      <div class="gov-card-small">
        <strong>Contratos:</strong> ${solution.processamento_dados.contratos.map(c => {
          if(c === 'NDA') return '📄 NDA';
          if(c === 'DPA') return '🔒 DPA';
          if(c === 'SLA') return '⚡ SLA';
          return c;
        }).join(', ')}
      </div>
      ` : ''}
      ${solution.processamento_dados.dados_dormem ? `
      <div class="gov-card-small">
        <strong>Dados em repouso:</strong> ${solution.processamento_dados.dados_dormem}
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- Descrição Simplificada -->
    ${solution.descricao_para_leigos ? `
    <div class="solution-section solution-highlight">
      <h3>📋 Descrição</h3>
      <p>${solution.descricao_para_leigos}</p>
    </div>
    ` : ''}

    <!-- Escopo (2 colunas) + Saídas Esperadas -->
    <div class="solution-section">
      ${solution.escopo && solution.escopo.length > 0 ? `
      <h3>🎯 Escopo</h3>
      <div class="escopo-two-columns">
        ${solution.escopo.map(item => `<div class="escopo-item">• ${item}</div>`).join('')}
      </div>
      ` : ''}
      ${solution.saidas_esperadas && solution.saidas_esperadas.length > 0 ? `
      <div style="margin-top: 12px;">
        <strong>📤 Saídas Esperadas:</strong>
        <ul class="solution-list" style="margin-top: 6px;">
          ${solution.saidas_esperadas.slice(0, 3).map(saida => `<li>${saida}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- Preço (somente cliente) -->
    <div class="solution-section">
      <h3>💰 Preço</h3>
      ${solution.preco_cliente ? `
      <div class="prazos-grid">
        ${solution.preco_cliente.capex_brl ? `
        <div class="prazo-item">
          <strong>Implantação (CAPEX):</strong> ${formatCurrency(solution.preco_cliente.capex_brl)}
        </div>
        ` : ''}
        ${solution.preco_cliente.opex_mensal_brl ? `
        <div class="prazo-item">
          <strong>Manutenção Mensal (OPEX):</strong> ${formatCurrency(solution.preco_cliente.opex_mensal_brl)}
        </div>
        ` : ''}
        ${solution.preco_cliente.preco_cliente_ano1_brl ? `
        <div class="prazo-item prazo-total">
          <strong>Total (Ano 1):</strong> <span class="highlight">${formatCurrency(solution.preco_cliente.preco_cliente_ano1_brl)}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}
      ${!ocultarCustos && solution.custo_ano1_brl ? `
      <div style="margin-top: 12px; opacity: 0.7; font-size: 0.9em; color: var(--muted);">
        <span>Custo interno: ${formatCurrency(solution.custo_ano1_brl)}</span>
      </div>
      ` : ''}
    </div>

    <!-- Prazos -->
    ${solution.prazos_dias ? `
    <div class="solution-section">
      <h3>⏱️ Prazos</h3>
      <div class="prazos-grid">
        ${solution.prazos_dias.implantacao !== undefined ? `
        <div class="prazo-item">
          <strong>Implantação:</strong> ${solution.prazos_dias.implantacao} dias
        </div>
        ` : ''}
        ${solution.prazos_dias.testes_UAT !== undefined ? `
        <div class="prazo-item">
          <strong>Testes UAT:</strong> ${solution.prazos_dias.testes_UAT} dias
        </div>
        ` : ''}
        ${solution.prazos_dias.total !== undefined ? `
        <div class="prazo-item prazo-total">
          <strong>Total:</strong> <span class="highlight">${solution.prazos_dias.total} dias</span>
        </div>
        ` : ''}
        ${solution.prazos_dias.sigma !== undefined && uiPoliticas.mostra_sigma !== false ? `
        <div class="prazo-item" title="σ do tronco ${linhaTronco}: ${sigmaTronco}%">
          <strong>σ (Incerteza):</strong> ${solution.prazos_dias.sigma} dias
          <span class="sigma-tooltip" title="Incerteza do tronco ${linhaTronco}: ${sigmaTronco}%">ℹ️</span>
        </div>
        ` : ''}
      </div>
    </div>
    ` : solution.prazo_estimado_liberacao_dias ? `
    <div class="solution-section">
      <h3>⏱️ Prazo Estimado</h3>
      <p>${solution.prazo_estimado_liberacao_dias} dias</p>
    </div>
    ` : ''}

    <!-- Layout com Indicadores e Riscos Chave na lateral -->
    <div class="solution-layout-main-sidebar">
      <div class="solution-main-content">
        ${solution.retorno_estimado ? `
        <div class="solution-section">
          <h3>💡 Retorno Estimado</h3>
          <p>${solution.retorno_estimado}</p>
        </div>
        ` : ''}

        ${solution.viabilidade_preliminar ? `
        <div class="solution-section">
          <h3>📊 Viabilidade Preliminar</h3>
          <div class="viability-grid">
            ${solution.viabilidade_preliminar.tecnica ? `
            <div class="viability-item">
              <strong>Técnica:</strong> ${solution.viabilidade_preliminar.tecnica}
            </div>
            ` : ''}
            ${solution.viabilidade_preliminar.economica ? `
            <div class="viability-item">
              <strong>Econômica:</strong> ${solution.viabilidade_preliminar.economica}
            </div>
            ` : ''}
            ${solution.viabilidade_preliminar.organizacional ? `
            <div class="viability-item">
              <strong>Organizacional:</strong> ${solution.viabilidade_preliminar.organizacional}
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        ${solution.dependencias && solution.dependencias.length > 0 ? `
        <div class="solution-section">
          <h3>🔗 Dependências</h3>
          <ul class="solution-list">
            ${solution.dependencias.map(dep => `<li>${dep}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${solution.maturidade ? `
        <div class="solution-section">
          <h3>🏗️ Maturidade</h3>
          <p>${solution.maturidade}</p>
        </div>
        ` : ''}
      </div>

      <div class="solution-sidebar">
        ${solution.indicadores && solution.indicadores.length > 0 ? `
        <div class="solution-card-compact">
          <h4>📈 Indicadores</h4>
          <ul class="solution-list-compact">
            ${solution.indicadores.slice(0, 5).map(ind => `<li>${ind}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${solution.riscos_chave && solution.riscos_chave.length > 0 ? `
        <div class="solution-card-compact solution-warning">
          <h4>⚠️ Riscos Chave</h4>
          <ul class="solution-list-compact">
            ${solution.riscos_chave.slice(0, 3).map(risco => `<li>${risco}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Glossário e Legenda (Accordions) -->
    ${solutionDescriptions?.explicacoes_para_leigos || solutionDescriptions?.legendas || solutionDescriptions?.legenda_dupla_governanca ? `
    <div class="accordion-section">
      ${solutionDescriptions?.explicacoes_para_leigos && Object.keys(solutionDescriptions.explicacoes_para_leigos).length > 0 ? `
      <details class="accordion-item">
        <summary class="accordion-header">📚 Glossário</summary>
        <div class="accordion-content">
          ${Object.entries(solutionDescriptions.explicacoes_para_leigos).map(([key, value]) => `
            <div class="glossary-item">
              <strong>${key.replace(/_/g, ' ')}:</strong> ${value}
            </div>
          `).join('')}
        </div>
      </details>
      ` : ''}

      ${(solutionDescriptions?.definicoes?.legendas || solutionDescriptions?.legenda_dupla_governanca) ? `
      <details class="accordion-item">
        <summary class="accordion-header">🏷️ Legenda</summary>
        <div class="accordion-content">
          ${solutionDescriptions?.definicoes?.legendas ? `
          <div style="margin-bottom: 12px;">
            ${Object.entries(solutionDescriptions.definicoes.legendas).map(([emoji, texto]) => `
              <div class="legend-item">
                <span class="legend-emoji">${emoji}</span>
                <span class="legend-text">${texto}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
          ${solutionDescriptions?.legenda_dupla_governanca ? `
          <div>
            <strong>Governança:</strong>
            <div class="legend-item">
              <strong>Captura:</strong> ${solutionDescriptions.legenda_dupla_governanca.captura || ''}
            </div>
            <div class="legend-item">
              <strong>Processamento:</strong> ${solutionDescriptions.legenda_dupla_governanca.processamento || ''}
            </div>
          </div>
          ` : ''}
        </div>
      </details>
      ` : ''}
    </div>
    ` : ''}
  `;

  content.innerHTML = html;
  modal.showModal();
  
  // Track solution view
  if (typeof trackEvent === 'function') {
    trackEvent('solution_viewed', {
      solution_id: solution.id,
      solution_name: solution.nome || solution.nome_curto,
      linha: solution.linha || solution.tronco
    });
  }
}

function setupSolutionLinks(){
  console.log('🔧 Configurando event listeners para links de solução...');
  
  // Intercepta todos os cliques em links de solução
  document.addEventListener('click', (e) => {
    // Verifica se é um link
    const link = e.target.closest('a');
    if(!link) return;
    
    const href = link.getAttribute('href');
    if(!href) return;
    
    console.log('🔗 Link detectado:', href);
    
    // Verifica se é um link de detalhe.html ou link de solução
    if(href.includes('detalhe.html?sol=') || href.includes('?sol=')){
      e.preventDefault();
      e.stopPropagation();
      
      // Extrai parâmetros da URL
      let urlParams;
      try {
        if(href.includes('?')){
          const queryString = href.split('?')[1].split('#')[0];
          urlParams = new URLSearchParams(queryString);
        } else {
          console.warn('⚠️ Link sem query string:', href);
          return;
        }
      } catch(err) {
        console.error('❌ Erro ao parsear URL:', err, href);
        return;
      }
      
      const solutionName = decodeURIComponent(urlParams.get('sol') || '');
      const coordStr = decodeURIComponent(urlParams.get('coord') || '');
      
      console.log('🔗 Link clicado:', { solutionName, coordStr, href });
      
      if(solutionName || coordStr){
        showSolutionModal(solutionName, coordStr);
      } else {
        console.warn('⚠️ Link sem parâmetros válidos:', href);
      }
    }
  }, true); // Usa capture phase para garantir que seja executado primeiro
  
  console.log('✅ Event listeners configurados');
}

// -------- Dados globais para relatório --------
let currentRankingData = null;
let currentPriorities = null;

// -------- Função para gerar relatório --------
async function generateReport() {
  try {
    if (!currentRankingData || !currentPriorities) {
      alert('Erro: Dados do ranking não disponíveis.');
      return;
    }

    // Garante que o gráfico esteja renderizado
    const clusterPlotHost = document.getElementById('clusterPlot');
    if (!clusterPlotHost?.querySelector('canvas')) {
      // Renderiza o gráfico se não estiver renderizado
      renderClusterPlot(currentRankingData.items, currentRankingData.decimals, currentPriorities);
    }
    
    // Obtém o canvas do gráfico
    const canvas = clusterPlotHost?.querySelector('canvas');
    let graphImage = null;
    
    if (canvas) {
      graphImage = canvas.toDataURL('image/png');
    } else {
      console.warn('Gráfico não disponível para captura');
    }

    // Prepara dados do ranking ordenado
    const sortedItems = [...currentRankingData.items].sort((a, b) => b.nota - a.nota);
    const clusterIds = sortedItems.map(x => x.cluster).filter(c => c != null && !isNaN(c) && c > 0);
    const maxCluster = clusterIds.length > 0 ? Math.max(...clusterIds) : 8;
    const rankingTable = sortedItems.map((item, index) => {
      // Garante que cluster existe e é válido
      const clusterId = item.cluster != null && !isNaN(item.cluster) && item.cluster > 0 ? item.cluster : null;
      const clusterName = clusterId ? getClusterName(clusterId, maxCluster) : 'N/A';
      return {
        position: index + 1,
        categoria: clusterName || 'N/A', // Mudado de 'cluster' para 'categoria'
        name: item.nome,
        coord: item.coordStr || '',
        nota: item.nota.toFixed(currentRankingData.decimals),
        margemErro: item.margemErro.toFixed(currentRankingData.decimals)
      };
    });
    
    // Prepara dados do podium (Ouro, Prata, Bronze)
    // Os items já devem ter cluster (foi aplicado quando salvou em currentRankingData)
    // Mas vamos garantir aplicando novamente se necessário
    let clustered = currentRankingData.items;
    // Verifica se os items têm cluster
    if(!currentRankingData.items[0]?.cluster) {
      clustered = smartCluster(currentRankingData.items);
    }
    
    const clusters = new Map();
    for(const item of clustered){
      const cid = item.cluster;
      if(cid != null && !isNaN(cid) && cid > 0) {
        if(!clusters.has(cid)) clusters.set(cid, { maxNota: -Infinity, items: [] });
        const c = clusters.get(cid);
        c.items.push(item);
        if(item.nota > c.maxNota) c.maxNota = item.nota;
      }
    }
    const ordered = [...clusters.entries()].sort((a,b)=> b[1].maxNota - a[1].maxNota);
    const podiumClusters = ordered.slice(0, 3); // Top 3: Ouro, Prata, Bronze
    
    const podiumData = podiumClusters.map(([cid, group], index) => {
      group.items.sort((a,b)=> b.nota - a.nota);
      const clusterName = cid ? getClusterName(cid, ordered.length) : 'N/A';
      return {
        categoria: clusterName,
        items: group.items.map(item => {
          // Busca informações completas da solução
          let solutionInfo = null;
          if(item.coordStr) {
            solutionInfo = findSolutionById(item.coordStr);
          }
          if(!solutionInfo && item.nome) {
            solutionInfo = findSolutionByName(item.nome);
          }
          
          return {
            nome: item.nome,
            coord: item.coordStr || '',
            nota: item.nota.toFixed(currentRankingData.decimals),
            margemErro: item.margemErro.toFixed(currentRankingData.decimals),
            solutionData: solutionInfo || null
          };
        })
      };
    });

    // Calcula percentuais
    const rPct = (currentPriorities.r * 100).toFixed(1);
    const gPct = (currentPriorities.g * 100).toFixed(1);
    const bPct = (currentPriorities.b * 100).toFixed(1);

    // Envia dados para o backend
    const response = await fetch('/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ranking: rankingTable,
        podium: podiumData,
        priorities: {
          custo: rPct,
          qualidade: gPct,
          prazo: bPct
        },
        graphImage: graphImage,
        sessionId: typeof trackingSession !== 'undefined' ? trackingSession.sessionId : null
      })
    });

    if (!response.ok) {
      // Tenta ler a mensagem de erro do backend
      let errorMessage = 'Erro ao gerar relatório';
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir ler JSON, usa o status
        errorMessage = `Erro ${response.status}: ${response.statusText || 'Erro ao conectar com o backend'}`;
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    a.download = `Tribussula_report_${dateStr}_${timeStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    // Track event
    if (typeof trackEvent === 'function') {
      trackEvent('report_generated', {
        priorities: {
          custo: rPct,
          qualidade: gPct,
          prazo: bPct
        },
        total_solutions: rankingTable.length
      });
    }

    alert('Relatório gerado com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    alert('Erro ao gerar relatório: ' + error.message);
    
    if (typeof trackEvent === 'function') {
      trackEvent('report_generation_error', { error: error.message });
    }
  }
}

// -------- Bootstrap --------
(async () => {
  try {
    console.log('🚀 Iniciando aplicação...');
    console.log('📸 Carregando imagem:', IMG_SRC);
    
    const canvas = document.getElementById('tri');
    if (!canvas) {
      throw new Error('Canvas com id "tri" não encontrado!');
    }
    console.log('✅ Canvas encontrado');
    console.log('   Dimensões:', canvas.width, 'x', canvas.height);
    console.log('   Estilo display:', window.getComputedStyle(canvas).display);
    console.log('   Visível:', canvas.offsetWidth > 0 && canvas.offsetHeight > 0);
    
    // Verifica se o contexto 2D está disponível
    const testCtx = canvas.getContext('2d');
    if (!testCtx) {
      throw new Error('Contexto 2D do canvas não está disponível!');
    }
    console.log('✅ Contexto 2D do canvas OK');
    
    const entrada = await initEntrada({ imgSrc: IMG_SRC, vertexToChannel: ['B','R','G'] });
    console.log('✅ Triângulo inicializado');
    
    // Verifica se o canvas está visível após inicialização
    setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      console.log('📐 Canvas após inicialização:');
      console.log('   Posição:', rect.x, rect.y);
      console.log('   Tamanho:', rect.width, 'x', rect.height);
      console.log('   Visível:', rect.width > 0 && rect.height > 0);
    }, 100);
    
    const CSVS = await loadCSVs();
    console.log('✅ CSVs carregados');
    
    await loadSolutionDescriptions();
    console.log('✅ Descrições de soluções carregadas');
    
    setupSolutionLinks();
    console.log('✅ Links configurados');
    
    // Teste: verifica se há links na página após um delay
    setTimeout(() => {
      const links = document.querySelectorAll('a[href*="?sol="]');
      console.log(`🔍 Links encontrados na página: ${links.length}`);
      if(links.length > 0) {
        console.log('📋 Primeiros links:', Array.from(links).slice(0, 3).map(l => l.href));
      }
    }, 2000);

    // Configura fechamento do modal
    const modal = document.getElementById('solutionModal');
    const closeBtn = document.getElementById('closeModal');
    if(closeBtn){
      closeBtn.addEventListener('click', () => modal.close());
    }
    // Fecha modal ao clicar no backdrop
    modal.addEventListener('click', (e) => {
      if(e.target === modal) modal.close();
    });

  // Botões de navegação
  const btnRanking = document.getElementById('btnRanking');
  const btnTree = document.getElementById('btnTree');
  const rankingSection = document.getElementById('rankingSection');
  const treeSection = document.getElementById('treeSection');
  const btnPerspective = document.getElementById('btnPerspective');
  const perspectiveSection = document.getElementById('perspectiveSection');

  entrada.onConfirm(({r,g,b})=>{
    try{
      // Track confirmation event
      if (typeof trackEvent === 'function') {
        trackEvent('priorities_confirmed', {
          r: r.toFixed(4),
          g: g.toFixed(4),
          b: b.toFixed(4),
          r_percent: (r * 100).toFixed(2),
          g_percent: (g * 100).toFixed(2),
          b_percent: (b * 100).toFixed(2)
        });
      }
      
      // ranking
      const rankingResult = computeRanking(CSVS.z, {r,g,b});
      const rows = rankingResult.items;
      const numDecimals = rankingResult.decimals;
      rows.sort((a,b)=> b.Zranking - a.Zranking);

      // enriquece com nomes/coords
      const items = enrichWithNames(rows, CSVS.n);
      
      // Aplica clustering aos itens para garantir que tenham cluster atribuído
      const clusteredItems = smartCluster(items);

      // PÓDIO por cluster (tronco primário)
      renderPodiumClusters(clusteredItems, numDecimals);

      // Ranking completo (mantém oculto até clicar)
      renderTable(clusteredItems, numDecimals, {r,g,b});

      // Salva dados para geração de relatório (com cluster já atribuído)
      currentRankingData = {
        items: clusteredItems,
        decimals: numDecimals
      };
      currentPriorities = {r, g, b};

      // Árvore (mantém oculta até clicar)
      const tree = buildTree(items);
      renderTree(tree, numDecimals);

      // Track results calculated
      if (typeof trackEvent === 'function') {
        trackEvent('results_calculated', {
          top_solution: items[0]?.code || 'N/A',
          total_solutions: items.length
        });
      }

      // listeners (uma vez só)
      if(!btnRanking.dataset.bound){
        btnRanking.addEventListener('click', ()=> {
          toggle(rankingSection);
          if (typeof trackEvent === 'function') {
            trackEvent('view_full_ranking');
          }
        });
        btnRanking.dataset.bound = '1';
      }
      if(!btnTree.dataset.bound){
        btnTree.addEventListener('click', ()=> {
          toggle(treeSection);
          if (typeof trackEvent === 'function') {
            trackEvent('view_tree');
          }
        });
        btnTree.dataset.bound = '1';
      }

      // Botão Perspectiva (mostra/oculta seção de imagens)
      if(btnPerspective && !btnPerspective.dataset.bound){
        btnPerspective.addEventListener('click', ()=>{
          toggle(perspectiveSection);
          if (typeof trackEvent === 'function') {
            trackEvent('view_perspective');
          }
        });
        btnPerspective.dataset.bound = '1';
      }

      // Botão gerar relatório
      const btnGenerateReport = document.getElementById('btnGenerateReport');
      const reportConfirmDlg = document.getElementById('reportConfirmDlg');
      const reportConfirmOk = document.getElementById('reportConfirmOk');
      const reportConfirmCancel = document.getElementById('reportConfirmCancel');
      
      if(btnGenerateReport && !btnGenerateReport.dataset.bound){
        btnGenerateReport.addEventListener('click', () => {
          if(!currentRankingData || !currentPriorities){
            alert('Por favor, confirme as prioridades primeiro para gerar o relatório.');
            return;
          }
          reportConfirmDlg.showModal();
        });
        
        reportConfirmCancel.addEventListener('click', () => {
          reportConfirmDlg.close();
        });
        
        reportConfirmOk.addEventListener('click', async () => {
          reportConfirmDlg.close();
          await generateReport();
        });
        
        btnGenerateReport.dataset.bound = '1';
      }

      console.log('(r,g,b) puros ->', r.toFixed(6), g.toFixed(6), b.toFixed(6));
    }catch(err){
      console.error(err); alert(err.message || 'Erro ao processar CSV.');
      if (typeof trackEvent === 'function') {
        trackEvent('calculation_error', { error: err.message });
      }
    }
  });
  } catch(err) {
    console.error('Erro ao inicializar aplicação:', err);
    console.error('Stack trace:', err.stack);
  }
})();

