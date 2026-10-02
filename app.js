import {estudoView,initEstudo} from './estudo.js';
import {focoView,initFoco} from './foco.js';
import {all,put,del,getKV,setKV,uid,exportAll,importAll} from './db.js';
const $=s=>document.querySelector(s), hoje=()=>new Date().toLocaleDateString('sv');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const ROTAS=[['hoje','Hoje','☀️'],['estudo','Estudo','📚'],['foco','Foco','⏱️'],['financas','Finanças','💰'],['mais','Mais','⚙️']];
const ETAPA={financas:6};
const TITULOS=['Novato','Aprendiz','Estudioso','Dedicado','Mestre'];
const FRASES=['Constância vence intensidade.','Um cartão por vez também é progresso.','Quem revisa hoje não decora amanhã.','Pausa planejada não é preguiça.','O básico bem-feito move montanhas.','Comece pequeno, comece agora.','Seu eu do futuro agradece.'];
const CORES={violeta:'#4338ca',verde:'#0f9d6b',laranja:'#d9531e',rosa:'#c026d3',azul:'#0369a1',ambar:'#b7791f'};
let cfg={tema:'auto',cor:'violeta',dens:'normal',ordem:['nivel','tarefas','habitos','revisoes','financas','frase']};
let instalar=null;

function aplicar(){
  const d=document.documentElement.dataset;
  d.tema=cfg.tema==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'escuro':'claro'):cfg.tema;
  d.cor=cfg.cor;d.dens=cfg.dens;
}
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',aplicar);
const salvarCfg=()=>{setKV('cfg',cfg);aplicar()};

/* Gamificação básica: XP, nível e ofensiva */
const nivel=xp=>Math.floor(Math.sqrt(xp/50))+1;
export async function ganhar(n){
  await setKV('xp',Math.max(0,await getKV('xp',0)+n));
  if(n>0){const d=await getKV('dias',[]);if(!d.includes(hoje()))await setKV('dias',[...d,hoje()])}
}
function ofensiva(dias){
  const s=new Set(dias),d=new Date();let n=0;
  if(!s.has(d.toLocaleDateString('sv')))d.setDate(d.getDate()-1);
  while(s.has(d.toLocaleDateString('sv'))){n++;d.setDate(d.getDate()-1)}
  return n;
}

/* Dashboard "Hoje" */
const card=(id,t,c)=>`<section class="card" draggable="true" data-w="${id}"><h2>${t}</h2>${c}</section>`;
const vazio=t=>`<p class="vazio">${t}</p>`;
async function hojeView(){
  const [tarefas,habitos,xp,dias,cartoes,trans,sess]=await Promise.all([all('tarefas'),all('habitos'),getKV('xp',0),getKV('dias',[]),all('cartoes'),all('transacoes'),all('sessoes')]);
  const h=hoje(),mes=h.slice(0,7);
  const L=nivel(xp),b=50*(L-1)**2,n=50*L*L,p=Math.round((xp-b)/(n-b)*100);
  const ts=tarefas.filter(t=>!t.feito||t.feitoEm===h);
  const rec=trans.filter(t=>t.data?.startsWith(mes)&&t.tipo==='receita').reduce((a,t)=>a+t.valor,0);
  const des=trans.filter(t=>t.data?.startsWith(mes)&&t.tipo==='despesa').reduce((a,t)=>a+t.valor,0);
  const m=v=>cfg.priv?'R$ ••••':brl(v);
  const W={
    nivel:card('nivel','Sua jornada',`<div class="nivel"><div class="anelw"><div class="anel" style="--p:${p}"></div><b>${L}</b></div>
      <div><strong>${TITULOS[Math.min(L-1,4)]}</strong><div class="mu">${xp} XP · faltam ${n-xp} para o nível ${L+1}</div><div>🔥 ${ofensiva(dias)} dia(s) de ofensiva</div></div></div>`),
    tarefas:card('tarefas','Tarefas do dia',ts.length?ts.map(t=>`<label class="it"><input type="checkbox" data-act="tarefa" data-id="${t.id}" ${t.feito?'checked':''}><span class="${t.feito?'ok':''}">${esc(t.t)}</span><button class="x" data-act="del" data-s="tarefas" data-id="${t.id}" aria-label="Excluir tarefa">×</button></label>`).join(''):vazio('Nada pendente. Toque em + para criar uma tarefa.')),
    habitos:card('habitos','Hábitos de hoje',habitos.length?habitos.map(t=>`<label class="it"><input type="checkbox" data-act="habito" data-id="${t.id}" ${t.log?.[h]?'checked':''}><span>${esc(t.t)}</span><button class="x" data-act="del" data-s="habitos" data-id="${t.id}" aria-label="Excluir hábito">×</button></label>`).join(''):vazio('Nenhum hábito ainda. Toque em + e escolha “Hábito”.')),
    revisoes:card('revisoes','Cartões para revisar',cartoes.length?`<strong>${cartoes.filter(c=>c.due<=Date.now()&&!c.susp).length}</strong> vencendo agora`:vazio('Os flashcards chegam na Etapa 2.')),
    financas:card('financas','Finanças do mês',`<div class="dinheiro"><span class="mu">Receitas<b>${m(rec)}</b></span><span class="mu">Despesas<b>${m(des)}</b></span><span class="mu">Saldo<b>${m(rec-des)}</b></span></div>`),
    foco:card('foco','Foco hoje',`<strong>${Math.round(sess.filter(x=>x.dia===h).reduce((a,x)=>a+x.dur,0)/60)}</strong> min · <a href="#/foco">abrir timers</a>`),
    frase:card('frase','Mensagem do dia',`<p class="frase">${FRASES[new Date().getDate()%FRASES.length]}</p>`)
  };
  return `<h1>${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</h1><div class="grid" id="grid">${[...cfg.ordem,...Object.keys(W).filter(k=>!cfg.ordem.includes(k))].map(k=>W[k]||'').join('')}</div>`;
}

/* Tela "Mais": aparência, instalação, dados */
async function maisView(){
  const est=await navigator.storage?.estimate?.(),pers=await navigator.storage?.persisted?.();
  const bt=(a,v,t,at)=>`<button data-act="${a}" data-v="${v}" aria-pressed="${at===v}">${t}</button>`;
  return `<h1>Mais</h1><div class="grid">
  <section class="card"><h2>Aparência</h2>
   <div class="fila">${[['auto','Automático'],['claro','Claro'],['escuro','Escuro'],['amoled','AMOLED'],['papel','Papel']].map(([v,t])=>bt('tema',v,t,cfg.tema)).join('')}</div>
   <div class="fila">${Object.entries(CORES).map(([k,c])=>`<button class="cor" style="--c:${c}" data-act="cor" data-v="${k}" aria-pressed="${cfg.cor===k}" aria-label="Cor ${k}"></button>`).join('')}</div>
   <div class="fila">${bt('dens','normal','Confortável',cfg.dens)}${bt('dens','compacta','Compacta',cfg.dens)}<button data-act="priv" aria-pressed="${!!cfg.priv}">${cfg.priv?'Valores ocultos':'Ocultar valores'}</button></div></section>
  <section class="card"><h2>Aplicativo</h2>
   <div class="fila">${instalar?'<button class="pri" data-act="instalar">Instalar app</button>':''}<button data-act="persist">Proteger dados no aparelho</button></div>
   <p class="mu">Armazenamento: ${est?`${(est.usage/1048576).toFixed(1)} MB de ${(est.quota/1048576).toFixed(0)} MB`:'indisponível'} · ${pers?'persistente ✓':'não persistente'}</p></section>
  <section class="card"><h2>Dados</h2>
   <div class="fila"><button data-act="export">Exportar backup</button><button data-act="importar">Importar backup</button><input type="file" accept=".json" id="imp" hidden></div>
   <div class="fila"><button data-act="demo">Carregar demonstração</button><button data-act="limpademo">Limpar demonstração</button></div>
   <p class="mu">Seus dados ficam só neste aparelho. Faça backup com frequência.</p></section></div>`;
}
const VIEWS={hoje:hojeView,mais:maisView,estudo:estudoView,foco:focoView};

async function render(){
  const id=location.hash.slice(2)||'hoje',r=ROTAS.find(x=>x[0]===id)||ROTAS[0];
  const nav=ROTAS.map(([k,t,i])=>`<a class="nv" href="#/${k}" ${k===r[0]?'aria-current="page"':''}><span aria-hidden="true">${i}</span>${t}</a>`).join('');
  $('#tabs').innerHTML=nav;$('#side').innerHTML='<b>Órbita</b>'+nav;
  $('#view').innerHTML=VIEWS[r[0]]?await VIEWS[r[0]]():`<h1>${r[1]}</h1><div class="card">${vazio(`Este módulo chega na Etapa ${ETAPA[r[0]]}. Responda “continuar” para seguir.`)}</div>`;
  document.title=`${r[1]} · Órbita`;
}

/* Eventos */
const view=$('#view');
view.addEventListener('change',async e=>{
  const {act,id}=e.target.dataset;
  if(act==='tarefa'){const t=(await all('tarefas')).find(x=>x.id===id);t.feito=e.target.checked;t.feitoEm=t.feito?hoje():null;await put('tarefas',t);await ganhar(t.feito?10:-10)}
  else if(act==='habito'){const t=(await all('habitos')).find(x=>x.id===id);t.log={...t.log};e.target.checked?t.log[hoje()]=1:delete t.log[hoje()];await put('habitos',t);await ganhar(e.target.checked?5:-5)}
  else if(e.target.id==='imp'){try{await importAll(JSON.parse(await e.target.files[0].text()));alert('Backup importado.')}catch{alert('Arquivo inválido. Escolha um backup .json da Órbita.')}}
  else return;
  render();
});
view.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b||b.tagName==='INPUT')return;
  const {act,v,s,id}=b.dataset;
  if(act==='del')await del(s,id);
  else if(act==='tema'||act==='cor'||act==='dens'){cfg[act]=v;salvarCfg()}
  else if(act==='priv'){cfg.priv=!cfg.priv;salvarCfg()}
  else if(act==='importar'){$('#imp').click();return}
  else if(act==='instalar'){instalar.prompt();instalar=null}
  else if(act==='persist'){alert(await navigator.storage?.persist?.()?'Dados protegidos.':'O navegador não concedeu a proteção agora.')}
  else if(act==='export'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(await exportAll())],{type:'application/json'}));a.download=`orbita-backup-${hoje()}.json`;a.click();await setKV('ultimoBackup',hoje())}
  else if(act==='demo'){for(const t of ['Revisar anatomia','Resolver 20 questões'])await put('tarefas',{id:uid(),t,demo:1});for(const t of ['Beber 2 L de água','Ler 20 páginas'])await put('habitos',{id:uid(),t,log:{},demo:1})}
  else if(act==='limpademo'){for(const s of ['tarefas','habitos'])for(const x of await all(s))if(x.demo)await del(s,x.id)}
  render();
});
/* Arrastar e soltar para reorganizar widgets (desktop) */
let arr=null;
view.addEventListener('dragstart',e=>{arr=e.target.closest('[data-w]');arr?.classList.add('arrasta')});
view.addEventListener('dragover',e=>e.preventDefault());
view.addEventListener('dragend',()=>arr?.classList.remove('arrasta'));
view.addEventListener('drop',e=>{
  const alvo=e.target.closest('[data-w]');if(!arr||!alvo||alvo===arr)return;
  cfg.ordem=cfg.ordem.filter(k=>k!==arr.dataset.w);
  cfg.ordem.splice(cfg.ordem.indexOf(alvo.dataset.w),0,arr.dataset.w);salvarCfg();render();
});
/* Botão + */
$('#fab').onclick=()=>$('#dlg').showModal();
$('#dlg').addEventListener('close',async()=>{
  const d=$('#dlg'),f=d.querySelector('form');
  if(d.returnValue==='ok'){const t=f.t.value.trim();if(t){await put(f.tipo.value,f.tipo.value==='habitos'?{id:uid(),t,log:{}}:{id:uid(),t,feito:false});render()}}
  f.reset();d.returnValue='';
});
addEventListener('hashchange',render);
initEstudo(render);
initFoco(render);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();instalar=e;if(location.hash==='#/mais')render()});

(async()=>{
  cfg={...cfg,...await getKV('cfg',{})};aplicar();
  navigator.serviceWorker?.register('sw.js').catch(()=>{});
  render();
})();
