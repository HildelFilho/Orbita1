// Timers: o tempo é calculado por timestamp (Date.now), nunca contando "ticks", então segue correto em segundo plano.
import {all,put,getKV,setKV,uid} from './db.js';
import {ganhar} from './app.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dia=(o=0)=>new Date(Date.now()-o*864e5).toLocaleDateString('sv');
let T=[],fc={auto:true,tela:true,notif:true,vibra:true,som:'sino'},rr,tf=null,lock=null,ctxA=null,rod=false;const ambV={},amb={};
const ctx=()=>ctxA??=new (window.AudioContext||window.webkitAudioContext)();
const gen=({trab,desc=0,rounds=1,longa=0,un='min'})=>{const m=un==='seg'?1:60,foco=un==='min'?1:0,a=[];
  for(let k=1;k<=rounds;k++){a.push({n:foco?'Foco':'Trabalho',s:trab*m,foco});if(k<rounds&&desc)a.push({n:'Pausa',s:desc*m});else if(k===rounds&&longa)a.push({n:'Pausa longa',s:longa*m})}return a};
const resp=(v,r)=>{const L=['Inspire','Segure','Expire','Segure'],a=[];for(let k=0;k<r;k++)v.forEach((s,i)=>a.push({n:L[i],s}));return a};
const PRE=[['Pomodoro 25/5',{trab:25,desc:5,rounds:4,longa:15}],['52/17',{trab:52,desc:17,rounds:2}],['90 min (ultradiano)',{trab:90,desc:20,rounds:2}],['50/10',{trab:50,desc:10,rounds:2}],['HIIT 40/20 ×8',{trab:40,desc:20,rounds:8,un:'seg'}],['Tabata 20/10 ×8',{trab:20,desc:10,rounds:8,un:'seg'}]];
const decorrido=t=>t.acum+(t.ini?Date.now()-t.ini:0);
const fmt=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(s%60).padStart(2,'0')};
const txt=t=>{const f=t.fases[t.i];if(!f)return '00:00';return f.s?fmt(Math.ceil((f.s*1000-decorrido(t))/1000)):fmt(decorrido(t)/1000)};
const salvar=()=>setKV('timers',T),pintar=async()=>{await rr();att()};

/* Som, vibração, notificação */
function som(tipo){const c=ctx(),nt={sino:[880,1320],bip:[1000,1000,1000],suave:[523,659,784]}[tipo]||[880];
  nt.forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.22;o.frequency.value=f;o.type=tipo==='bip'?'square':'sine';
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.25)})}
async function aviso(msg){
  try{som(fc.som)}catch{}if(fc.vibra)navigator.vibrate?.([200,100,200]);
  if(fc.notif&&window.Notification?.permission==='granted'){const r=await navigator.serviceWorker?.ready;r?.showNotification?r.showNotification('Órbita',{body:msg,tag:'orbita-timer'}):new Notification('Órbita',{body:msg})}
}
/* Sons ambiente gerados com Web Audio (sem arquivos) */
const AMB={branco:'Ruído branco',marrom:'Ruído marrom',chuva:'Chuva',vento:'Vento / floresta'};
function ambiente(n,v){const c=ctx();c.resume?.();
  if(!amb[n]){amb[n]=c.createGain();const b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=b.getChannelData(0);let u=0;
    for(let i=0;i<d.length;i++){const w=Math.random()*2-1;if(n==='marrom'||n==='vento'){u=(u+.02*w)/1.02;d[i]=u*3.5}else d[i]=w}
    const s=c.createBufferSource();s.buffer=b;s.loop=true;let o=s;const f=(t,hz)=>{const x=c.createBiquadFilter();x.type=t;x.frequency.value=hz;o=o.connect(x)};
    if(n==='chuva'){f('highpass',800);f('lowpass',7000)}if(n==='vento')f('lowpass',500);
    o.connect(amb[n]).connect(c.destination);s.start()}
  amb[n].gain.value=v/100*(n==='branco'?.25:1);
}
/* Wake Lock, título e atualização da tela */
async function wl(){const at=T.some(t=>t.ini);
  if(at&&fc.tela&&!lock){try{lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>lock=null)}catch{}}
  else if((!at||!fc.tela)&&lock){lock.release();lock=null}}
function att(){
  for(const t of T){const f=t.fases[t.i]||{};document.querySelectorAll(`[data-t="${t.id}"]`).forEach(e=>e.textContent=txt(t));
    document.querySelectorAll(`[data-b="${t.id}"]`).forEach(e=>e.style.width=(f.s?Math.min(100,decorrido(t)/f.s/10):0)+'%')}
  const r=T.filter(t=>t.ini);if(r.length)document.title=`${txt(r[0])} · ${r[0].nome}`;else if(/^\d/.test(document.title))document.title='Foco · Órbita';
}
/* Motor */
async function logar(t,f,sec){if(!f.foco||sec<60)return;await put('sessoes',{id:uid(),t:Date.now(),dia:dia(),dur:Math.round(sec),mat:t.mat,nome:t.nome});await ganhar(Math.max(1,Math.round(sec/150)))}
async function avancar(t){ // consome as fases terminadas, inclusive se a aba ficou dormindo
  let el=decorrido(t),msg='';
  while(t.fases[t.i]?.s&&el>=t.fases[t.i].s*1000){const f=t.fases[t.i];el-=f.s*1000;await logar(t,f,f.s);msg=`${f.n} concluído(a).`;t.i++;
    if(t.i>=t.fases.length){t.fim=true;t.ini=null;t.acum=0;msg=`${t.nome}: tudo concluído! 🎉`;break}
    if(!t.auto){t.ini=null;t.acum=0;msg+=` Próxima: ${t.fases[t.i].n}.`;break}}
  if(!t.fim&&t.ini){t.acum=el;t.ini=Date.now()}
  if(msg)aviso(msg);
}
async function tick(){
  if(rod)return;rod=true;
  try{let m=false;
    for(const t of T){if(!t.ini)continue;const f=t.fases[t.i];
      if(f.s&&decorrido(t)>=f.s*1000){await avancar(t);m=true}
      else if(t.alertas&&f.s)for(const a of t.alertas)if(!t.av?.[a]&&f.s*1000-decorrido(t)<=a*1000){(t.av??={})[a]=1;aviso(`Faltam ${a/60} min`)}}
    if(m){await salvar();await pintar()}att();wl()}finally{rod=false}
}
async function iniciar(nome,fases,extra={}){
  window.Notification?.requestPermission?.();try{ctx().resume()}catch{}
  T.push({id:uid(),nome,fases,i:0,ini:Date.now(),acum:0,auto:fc.auto,mat:document.getElementById('f-mat')?.value.trim()||'',...extra});
  await salvar();wl();await pintar();
}
async function acao(a,d){
  const t=T.find(x=>x.id===d.id),n=id=>+document.getElementById(id)?.value||0,ag=Date.now();
  if(a==='preset')return iniciar(PRE[d.i][0],gen(PRE[d.i][1]));
  if(a==='saved'){const p=(await getKV('presets',[]))[d.i];return iniciar(p.nome,gen(p.p))}
  if(a==='cron')return iniciar('Cronômetro',[{n:'Cronômetro',s:0,foco:1}]);
  if(a==='flow')return iniciar('Flowtime',[{n:'Foco livre',s:0,foco:1}],{flow:1});
  if(a==='r478')return iniciar('Respiração 4-7-8',resp([4,7,8],4));
  if(a==='caixa')return iniciar('Respiração caixa',resp([4,4,4,4],4));
  if(a==='regr'||a==='prova'){const m=n('f-min');if(m<=1)return alert('Informe os minutos.');
    return iniciar(a==='prova'?'Simulado':'Contagem regressiva',[{n:a==='prova'?'Prova':'Contagem',s:m*60,foco:a==='prova'?1:0}],a==='prova'?{alertas:[600,300].filter(x=>x<m*60)}:{})}
  if(a==='custom'||a==='salvarp'){const p={trab:n('f-trab'),desc:n('f-desc'),rounds:Math.max(1,n('f-rounds')),longa:n('f-longa'),un:document.getElementById('f-un').value},nome=document.getElementById('f-nome').value.trim()||'Personalizado';
    if(p.trab<=0)return alert('Informe o tempo de trabalho.');
    if(a==='custom')return iniciar(nome,gen(p));await setKV('presets',[...await getKV('presets',[]),{nome,p}])}
  else if(a==='delp'){const l=await getKV('presets',[]);l.splice(+d.i,1);await setKV('presets',l)}
  else if(a==='pausar'){t.acum=decorrido(t);t.ini=null}
  else if(a==='retomar'){t.ini=ag;window.Notification?.requestPermission?.()}
  else if(a==='pular'){const f=t.fases[t.i];await logar(t,f,decorrido(t)/1000);t.i++;t.acum=0;t.av={};if(t.i>=t.fases.length){t.fim=true;t.ini=null}else if(t.ini)t.ini=ag;}
  else if(a==='parar'){const f=t.fases[t.i],sec=decorrido(t)/1000;await logar(t,f,sec);
    if(t.flow&&sec>=60){t.fases=[{n:'Pausa',s:Math.round(sec/5)}];t.i=0;t.acum=0;t.ini=ag;t.flow=0}else T=T.filter(x=>x!==t)}
  else if(a==='reiniciar'){Object.assign(t,{i:0,acum:0,ini:null,fim:false,av:{}})}
  else if(a==='tela'){tf=d.id;await pintar();document.getElementById('tf')?.requestFullscreen?.().catch(()=>{});return}
  else if(a==='sair'){tf=null;document.fullscreenElement&&document.exitFullscreen();}
  await salvar();wl();await pintar();
}
/* Telas */
const cartao=t=>{const f=t.fases[t.i]||{},r=!!t.ini,B=(a,l,c='')=>`<button class="${c}" data-f="${a}" data-id="${t.id}">${l}</button>`;
  return `<section class="card" aria-label="${esc(t.nome)}"><div class="fila"><strong>${esc(t.nome)}</strong><span class="mu">${t.fim?'Concluído':esc(f.n)} · fase ${Math.min(t.i+1,t.fases.length)}/${t.fases.length}${t.mat?' · '+esc(t.mat):''}</span></div>
  <div class="tempo" data-t="${t.id}" role="timer">${txt(t)}</div><div class="bar"><i data-b="${t.id}"></i></div>
  <div class="fila">${t.fim?B('reiniciar','Reiniciar'):r?B('pausar','Pausar'):B('retomar',t.acum||t.i?'Retomar':'Iniciar','pri')}${t.fim?'':B('pular','Pular')}${B('tela','Tela cheia')}${B('parar',t.fases[0].s?'Encerrar':'Parar e salvar')}</div></section>`};
async function estat(){
  const s=await all('sessoes'),d7=[...Array(7)].map((_,i)=>s.filter(x=>x.dia===dia(6-i)).reduce((a,x)=>a+x.dur,0)/60),mx=Math.max(1,...d7),mat={};
  s.forEach(x=>{const k=x.mat||'Sem matéria';mat[k]=(mat[k]||0)+x.dur/60});
  return `<p>Hoje: <b>${Math.round(d7[6])} min</b> · Total: <b>${(s.reduce((a,x)=>a+x.dur,0)/3600).toFixed(1).replace('.',',')} h</b> · ${s.length} sessões</p>
  <div class="barras" role="img" aria-label="Minutos de foco nos últimos 7 dias">${d7.map(n=>`<i style="height:${n/mx*100}%" title="${Math.round(n)} min"></i>`).join('')}</div><p class="mu">últimos 7 dias</p>
  ${Object.entries(mat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<div class="it"><span>${esc(k)}</span><b>${Math.round(v)} min</b></div>`).join('')}`;
}
export async function focoView(){
  const sv=await getKV('presets',[]),B=(a,l,i='')=>`<button data-f="${a}" data-i="${i}">${l}</button>`,I=(id,l,v)=>`<label>${l}<input id="${id}" inputmode="numeric" value="${v}"></label>`;
  const ck=(k,l)=>`<label class="it"><input type="checkbox" data-f="cfg" data-k="${k}" ${fc[k]?'checked':''}><span>${l}</span></label>`,at=T.find(t=>t.id===tf);
  return `<h1>Foco</h1>${at?`<div class="tela-foco" id="tf"><p>${esc(at.nome)} · ${esc(at.fases[at.i]?.n||'')}</p><div class="tempo gigante" data-t="${at.id}">${txt(at)}</div><div class="bar"><i data-b="${at.id}"></i></div>
   <div class="fila">${at.ini?`<button data-f="pausar" data-id="${at.id}">Pausar</button>`:`<button class="pri" data-f="retomar" data-id="${at.id}">Iniciar</button>`}<button data-f="sair">Sair</button></div></div>`:''}
  <div class="grid">${T.map(cartao).join('')||'<section class="card"><h2>Timers ativos</h2><p class="vazio">Nenhum timer. Escolha um abaixo.</p></section>'}
  <section class="card form"><h2>Iniciar</h2><label>Matéria ou tarefa (opcional)<input id="f-mat" placeholder="Ex.: Anatomia"></label>
   <div class="fila">${PRE.map((p,i)=>B('preset',p[0],i)).join('')}${B('flow','Flowtime')}${B('cron','Cronômetro')}${B('r478','Respiração 4-7-8')}${B('caixa','Respiração caixa')}</div>
   ${sv.length?`<div class="fila">${sv.map((p,i)=>`<span><button data-f="saved" data-i="${i}">${esc(p.nome)}</button><button class="x" data-f="delp" data-i="${i}" aria-label="Excluir preset">×</button></span>`).join('')}</div>`:''}
   <div class="fila">${I('f-min','Minutos',30)}${B('regr','Regressiva')}${B('prova','Simulado (avisa aos 10 e 5 min)')}</div></section>
  <section class="card form"><h2>Personalizado</h2><label>Nome<input id="f-nome" placeholder="Meu timer"></label>
   <div class="fila">${I('f-trab','Trabalho',25)}${I('f-desc','Descanso',5)}${I('f-rounds','Rounds',4)}${I('f-longa','Pausa longa',0)}<label>Unidade<select id="f-un"><option value="min">minutos</option><option value="seg">segundos</option></select></label></div>
   <div class="fila">${B('custom','Iniciar')}${B('salvarp','Salvar como preset')}</div></section>
  <section class="card"><h2>Sons ambiente</h2>${Object.entries(AMB).map(([k,l])=>`<label class="it"><span>${l}</span><input type="range" min="0" max="100" value="${ambV[k]||0}" data-f="amb" data-n="${k}" aria-label="${l}"></label>`).join('')}</section>
  <section class="card"><h2>Estatísticas de foco</h2>${await estat()}</section>
  <section class="card form"><h2>Ajustes</h2>${ck('auto','Iniciar a próxima fase automaticamente')}${ck('tela','Manter a tela acesa')}${ck('notif','Notificações')}${ck('vibra','Vibração')}
   <label>Alarme<select data-f="cfg" data-k="som">${[['sino','Sino'],['bip','Bipe'],['suave','Suave']].map(([v,l])=>`<option value="${v}" ${fc.som===v?'selected':''}>${l}</option>`).join('')}</select></label></section></div>`;
}
export async function initFoco(render){
  rr=render;T=await getKV('timers',[]);fc={...fc,...await getKV('fcfg',{})};const v=document.getElementById('view');
  v.addEventListener('click',e=>{const b=e.target.closest('button[data-f]');if(b)acao(b.dataset.f,b.dataset)});
  v.addEventListener('input',e=>{const d=e.target.dataset;if(d.f==='amb'){ambV[d.n]=+e.target.value;ambiente(d.n,+e.target.value)}});
  v.addEventListener('change',e=>{const d=e.target.dataset;if(d.f==='cfg'){fc[d.k]=d.k==='som'?e.target.value:e.target.checked;setKV('fcfg',fc);if(d.k==='som')som(fc.som);wl()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();wl()}});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&tf){tf=null;rr()}});
  setInterval(tick,250);tick();
}
