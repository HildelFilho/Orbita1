// Módulo de Estudo: baralhos, cartões (normal/reverso/cloze), mídia, revisão com FSRS-5, CSV e estatísticas
import {all,put,del,getKV,setKV,uid} from './db.js';
import {PADRAO,novoCartao,agendar,prever,R,DIA,MIN} from './fsrs.js';
import {ganhar} from './app.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let modo='lista',ses=null,edit=null,cfg=PADRAO,rr,campo='f';
const fmt=h=>h.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>').replace(/\[midia:([\w-]+)\]/g,'<span data-m="$1"></span>');
const md=s=>fmt(esc(s));
function face(c,verso){
  if(c.tipo==='cloze')return fmt(esc(c.f).replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs,(m,n,a,d)=>+n===c.ord?(verso?`<mark>${a}</mark>`:`<mark>[${d||'…'}]</mark>`):a))+(verso&&c.extra?`<hr>${md(c.extra)}`:'');
  return md(c.f)+(verso?`<hr>${md(c.v)}${c.extra?`<p class="mu">${md(c.extra)}</p>`:''}`:'');
}
const pintar=async()=>{await rr();await midias()};
async function midias(){ // troca marcadores [midia:id] por <img>/<audio>/<video> usando os Blobs do IndexedDB
  const ms=document.querySelectorAll('[data-m]');if(!ms.length)return;const todas=await all('midias');
  ms.forEach(s=>{const m=todas.find(x=>x.id===s.dataset.m);if(!m)return;const t=m.blob.type,e=document.createElement(t.startsWith('image')?'img':t.startsWith('video')?'video':'audio');
    e.src=URL.createObjectURL(m.blob);if(e.tagName==='IMG')e.alt='';else e.controls=true;s.replaceWith(e)});
}
async function salvarMidia(file){ // imagens são redimensionadas (máx. 1280 px) e comprimidas
  let blob=file;
  if(file.type.startsWith('image/')&&file.type!=='image/gif'){const b=await createImageBitmap(file),k=Math.min(1,1280/Math.max(b.width,b.height)),c=document.createElement('canvas');
    c.width=b.width*k;c.height=b.height*k;c.getContext('2d').drawImage(b,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82))}
  const id=uid();await put('midias',{id,blob,nome:file.name||'colado'});return id;
}
function inserir(txt){const t=document.getElementById('ed-'+campo);if(!t)return;const a=t.selectionStart;t.value=t.value.slice(0,a)+txt+t.value.slice(t.selectionEnd);t.focus()}
async function criar(o){
  const base={...novoCartao(),nota:uid(),baralho:o.baralho||'Geral',tags:o.tags||[],extra:o.extra||''},cs=[];
  if(o.tipo==='cloze')for(const n of new Set([...o.f.matchAll(/\{\{c(\d+)::/g)].map(m=>+m[1])))cs.push({...base,id:uid(),tipo:'cloze',f:o.f,v:'',ord:n});
  else{cs.push({...base,id:uid(),tipo:'normal',f:o.f,v:o.v});if(o.rev)cs.push({...base,id:uid(),tipo:'normal',f:o.v,v:o.f,rev:true})}
  for(const c of cs)await put('cartoes',c);return cs.length;
}
/* Fila de estudo: aprendizado vencido → revisões do dia → novos (respeitando limites) → aprendizado a vencer (≤20 min) */
async function proximo(b){
  const ag=Date.now(),ini=new Date().setHours(0,0,0,0),fim=new Date().setHours(23,59,59,999);
  const cs=(await all('cartoes')).filter(c=>(!b||c.baralho===b||c.baralho.startsWith(b+'::'))&&!c.susp);
  const log=(await all('revisoes')).filter(l=>l.t>=ini),nv=log.filter(l=>l.e0===0).length,rv=log.filter(l=>l.e0===2).length;
  const ap=cs.filter(c=>c.estado===1||c.estado===3).sort((a,b)=>a.due-b.due),re=cs.filter(c=>c.estado===2&&c.due<=fim).sort((a,b)=>a.due-b.due),no=cs.filter(c=>c.estado===0);
  const cont={n:Math.max(0,Math.min(no.length,cfg.novosDia-nv)),a:ap.length,r:Math.max(0,Math.min(re.length,cfg.revDia-rv))};
  const c=ap.find(c=>c.due<=ag)||(cont.r&&re[0])||(cont.n&&no[0])||ap.find(c=>c.due<=ag+20*MIN)||null;
  return {c,cont};
}
async function prox(){const {c,cont}=await proximo(ses.b);Object.assign(ses,{atual:c,cont,mostrar:false,ini:Date.now(),prev:c?prever(c,Date.now(),cfg):null});await pintar()}
async function responder(g){
  const c=ses.atual,ag=Date.now(),lid=uid();
  await put('cartoes',agendar(c,g,ag,cfg));
  await put('revisoes',{id:lid,cartao:c.id,nota:g,t:ag,e0:c.estado,S:c.S,D:c.D,r:c.last?R((ag-c.last)/DIA,c.S):null,dur:ag-ses.ini}); // log completo p/ otimizador
  ses.desf.push({antes:c,lid});await ganhar(1);await prox();
}
async function desfazer(){const u=ses?.desf.pop();if(!u)return;await put('cartoes',u.antes);await del('revisoes',u.lid);await ganhar(-1);await prox()}

/* Telas */
const reviewView=()=>{
  const c=ses.atual,k=ses.cont;
  const topo=`<div class="fila"><button data-e="sair">← Sair</button><span class="mu">Novos ${k.n} · Aprendendo ${k.a} · Revisão ${k.r}</span></div>`;
  if(!c)return `${topo}<div class="card"><h2>Tudo em dia 🎉</h2><p class="mu">Nenhum cartão a revisar agora.</p></div>`;
  const B=[['1','De novo'],['2','Difícil'],['3','Bom'],['4','Fácil']];
  return `${topo}<div class="card face">${face(c,ses.mostrar)}</div>
   ${ses.mostrar?`<div class="btns">${B.map(([g,t])=>`<button data-e="nota" data-g="${g}"><b>${t}</b><small>${ses.prev[g]}</small></button>`).join('')}</div>`
   :'<div class="btns"><button class="pri" data-e="mostrar">Mostrar resposta (espaço)</button></div>'}
   <div class="fila"><button data-e="desfazer">Desfazer (Z)</button><button data-e="editar">Editar (E)</button><button data-e="flag">${c.flag?'★':'☆'} Marcar</button><button data-e="susp">Suspender</button><button data-e="voz" aria-label="Ler em voz alta">🔊</button></div>`;
};
async function editorView(){
  const e=edit||{},decks=[...new Set((await all('cartoes')).map(c=>c.baralho))];
  return `<h1>${edit?'Editar cartão':'Novo cartão'}</h1><div class="card form">
  <label>Baralho<input id="ed-b" list="dl" value="${esc(e.baralho||ses?.b||'')}" placeholder="Ex.: Anatomia::Ossos"><datalist id="dl">${decks.map(d=>`<option value="${esc(d)}">`).join('')}</datalist></label>
  <label>Tipo<select id="ed-tipo"><option value="normal">Normal</option><option value="cloze" ${e.tipo==='cloze'?'selected':''}>Cloze (lacunas)</option></select></label>
  <label>Frente / texto cloze<textarea id="ed-f" rows="4">${esc(e.f)}</textarea></label>
  <label>Verso<textarea id="ed-v" rows="3">${esc(e.v)}</textarea></label>
  <label>Notas extras<textarea id="ed-x" rows="2">${esc(e.extra)}</textarea></label>
  <label>Tags<input id="ed-t" value="${esc((e.tags||[]).join(' '))}"></label>
  ${edit?'':'<label class="it"><input type="checkbox" id="ed-rev"><span>Criar também o cartão invertido</span></label>'}
  <div class="fila"><button data-e="cloze">Transformar seleção em cloze (Ctrl+Shift+C)</button><button data-e="abrir" data-alvo="#arq">📎 Imagem/áudio/vídeo</button><input type="file" id="arq" data-e="arq" accept="image/*,audio/*,video/*" multiple hidden></div>
  <p class="mu">Dica: cole imagens com Ctrl+V. Use **negrito** e *itálico*.</p>
  <div class="fila"><button class="pri" data-e="salvar">Salvar</button><button data-e="cancelar">Cancelar</button></div></div>`;
}
async function listaView(){
  cfg={...PADRAO,...await getKV('fsrs',{})};
  const cs=await all('cartoes'),log=await all('revisoes'),ag=Date.now(),ini=new Date().setHours(0,0,0,0),fim=new Date().setHours(23,59,59,999);
  const decks=[...new Set(cs.map(c=>c.baralho))].sort(),dentro=(c,b)=>c.baralho===b||c.baralho.startsWith(b+'::');
  const linhas=decks.map(b=>{const x=cs.filter(c=>dentro(c,b)&&!c.susp),n=x.filter(c=>c.estado===0).length,a=x.filter(c=>c.estado===1||c.estado===3).length,r=x.filter(c=>c.estado===2&&c.due<=fim).length;
    return `<div class="it"><span style="padding-left:${(b.split('::').length-1)*16}px">${esc(b.split('::').pop())}</span><small class="mu">${n} · ${a} · ${r}</small><button data-e="estudar" data-b="${esc(b)}">Estudar</button></div>`}).join('');
  const est=[0,1,2,3].map(e=>cs.filter(c=>c.estado===e).length),prev=Array(14).fill(0);
  cs.filter(c=>c.estado===2&&!c.susp).forEach(c=>{prev[Math.min(13,Math.max(0,Math.floor((c.due-ini)/DIA)))]++});
  const rv=log.filter(l=>l.e0===2),ret=rv.length?Math.round(rv.filter(l=>l.nota>1).length/rv.length*100)+'%':'—',mx=Math.max(1,...prev);
  return `<h1>Estudo</h1><div class="grid">
  <section class="card"><h2>Baralhos</h2>${linhas||'<p class="vazio">Crie seu primeiro cartão ou importe um CSV.</p>'}<p class="mu">novos · aprendendo · revisão</p>
   <div class="fila"><button class="pri" data-e="novo">Novo cartão</button><button data-e="estudar" data-b="">Estudar tudo</button></div></section>
  <section class="card"><h2>Estatísticas</h2><p>Novos ${est[0]} · Aprendendo ${est[1]} · Revisão ${est[2]} · Reaprendendo ${est[3]}</p>
   <p>Retenção real: <b>${ret}</b> (meta ${Math.round(cfg.ret*100)}%) · ${log.length} revisões</p><p class="mu">Previsão dos próximos 14 dias</p>
   <div class="barras" role="img" aria-label="Previsão de revisões">${prev.map(n=>`<i style="height:${n/mx*100}%" title="${n}"></i>`).join('')}</div></section>
  <section class="card"><h2>Importar e exportar</h2><div class="fila"><button data-e="abrir" data-alvo="#csvf">Importar CSV/TSV</button><input type="file" id="csvf" data-e="csv" accept=".csv,.tsv,.txt" hidden><button data-e="modelo">Baixar CSV modelo</button><button data-e="exportar">Exportar CSV</button></div>
   <p class="mu">Colunas: Frente, Verso, Tags, Baralho, Tipo (normal/cloze), Extra. O delimitador é detectado sozinho.</p></section>
  <section class="card form"><h2>Algoritmo (FSRS-5)</h2>
   <label>Retenção desejada (%)<input id="c-ret" value="${Math.round(cfg.ret*100)}" inputmode="numeric"></label>
   <label>Novos por dia<input id="c-nov" value="${cfg.novosDia}" inputmode="numeric"></label><label>Revisões por dia<input id="c-rev" value="${cfg.revDia}" inputmode="numeric"></label>
   <label>Passos de aprendizado (min)<input id="c-ps" value="${cfg.passos.join(' ')}"></label><label>Passos de reaprendizado (min)<input id="c-rp" value="${cfg.repassos.join(' ')}"></label>
   <label class="it"><input type="checkbox" id="c-fz" ${cfg.fuzz?'checked':''}><span>Fuzz nos intervalos</span></label>
   <label>Parâmetros w0–w18<textarea id="c-w" rows="4">${cfg.w.join(', ')}</textarea></label><button data-e="cfg">Salvar</button></section></div>`;
}
export async function estudoView(){return modo==='rev'&&ses?reviewView():modo==='editor'?editorView():listaView()}

/* CSV */
function csv(txt){
  txt=txt.replace(/^\uFEFF/,'');const d=['\t',';',','].map(x=>[x,txt.split('\n')[0].split(x).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const L=[];let r=[],c='',q=false;
  for(let i=0;i<txt.length;i++){const h=txt[i];
    if(q){if(h==='"'){if(txt[i+1]==='"'){c+='"';i++}else q=false}else c+=h}
    else if(h==='"')q=true;else if(h===d){r.push(c);c=''}
    else if(h==='\n'||h==='\r'){if(h==='\r'&&txt[i+1]==='\n')i++;r.push(c);c='';L.push(r);r=[]}else c+=h}
  if(c||r.length){r.push(c);L.push(r)}return L.filter(x=>x.some(y=>y.trim()));
}
const cel=s=>/[",;\n\t]/.test(s)?`"${String(s).replace(/"/g,'""')}"`:s;
async function importar(txt){
  const L=csv(txt),h=L[0].map(x=>x.trim().toLowerCase()),tem=h.some(x=>['frente','front'].includes(x)),idx=n=>tem?h.findIndex(x=>n.includes(x)):-1;
  const col=tem?{f:idx(['frente','front']),v:idx(['verso','back']),t:idx(['tags']),b:idx(['baralho','deck']),tp:idx(['tipo','type']),x:idx(['extra'])}:{f:0,v:1,t:2,b:3,tp:-1,x:-1};
  const vistos=new Set((await all('cartoes')).map(c=>c.baralho+'|'+c.f));let ok=0,dup=0,err=0;
  for(const r of tem?L.slice(1):L){const f=(r[col.f]||'').trim(),g=i=>i>=0?(r[i]||'').trim():'';
    if(!f){err++;continue}const b=g(col.b)||'Importados';if(vistos.has(b+'|'+f)){dup++;continue}vistos.add(b+'|'+f);
    ok+=await criar({f,v:g(col.v),extra:g(col.x),tags:g(col.t).split(/[ ,]+/).filter(Boolean),baralho:b,tipo:/\{\{c\d+::/.test(f)||g(col.tp)==='cloze'?'cloze':'normal'})}
  alert(`Importação concluída: ${ok} cartões criados, ${dup} duplicados ignorados, ${err} linhas com erro.`);
}
const baixar=(nome,txt)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+txt],{type:'text/csv'}));a.download=nome;a.click()};

/* Ações */
async function acao(a,d){
  const g=id=>document.getElementById('ed-'+id);
  if(a==='estudar'){ses={b:d.b||'',desf:[]};modo='rev';return prox()}
  if(a==='sair'){modo='lista';ses=null}
  else if(a==='mostrar'){ses.mostrar=true}
  else if(a==='nota')return responder(+d.g);
  else if(a==='desfazer')return desfazer();
  else if(a==='novo'){edit=null;modo='editor'}
  else if(a==='editar'){if(!ses?.atual)return;edit=ses.atual;modo='editor'}
  else if(a==='cancelar'){edit=null;modo=ses?'rev':'lista'}
  else if(a==='flag'||a==='susp'){const c=ses.atual;await put('cartoes',{...c,[a==='flag'?'flag':'susp']:!c[a==='flag'?'flag':'susp']});if(a==='susp')return prox();ses.atual.flag=!c.flag}
  else if(a==='voz'){const c=ses.atual,u=new SpeechSynthesisUtterance((ses.mostrar?c.v||c.f:c.f).replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g,'$1').replace(/\[midia:[\w-]+\]/g,''));u.lang='pt-BR';speechSynthesis.cancel();speechSynthesis.speak(u);return}
  else if(a==='abrir'){document.querySelector(d.alvo).click();return}
  else if(a==='cloze'){const t=g('f'),s=t.value.slice(t.selectionStart,t.selectionEnd);if(!s)return alert('Selecione um trecho do texto.');
    const n=Math.max(0,...[...t.value.matchAll(/\{\{c(\d+)::/g)].map(m=>+m[1]))+1,p=t.selectionStart;t.value=t.value.slice(0,p)+`{{c${n}::${s}}}`+t.value.slice(t.selectionEnd);g('tipo').value='cloze';return}
  else if(a==='salvar'){
    const f=g('f').value.trim();if(!f)return alert('Preencha a frente do cartão.');
    const o={f,v:g('v').value.trim(),extra:g('x').value.trim(),tags:g('t').value.split(/[ ,]+/).filter(Boolean),baralho:g('b').value.trim()||'Geral',tipo:g('tipo').value,rev:g('rev')?.checked};
    if(o.tipo==='cloze'&&!/\{\{c\d+::/.test(f))return alert('Cloze precisa de pelo menos uma lacuna, como {{c1::resposta}}.');
    if(edit){for(const c of (await all('cartoes')).filter(c=>c.nota===edit.nota&&(c.tipo==='cloze'||c.id===edit.id)))await put('cartoes',{...c,f:o.f,v:o.v,extra:o.extra,tags:o.tags,baralho:o.baralho});
      if(ses)ses.atual=(await all('cartoes')).find(c=>c.id===edit.id)}
    else await criar(o);
    edit=null;modo=ses?'rev':'lista'}
  else if(a==='cfg'){const v=id=>document.getElementById(id).value,num=s=>s.split(/[ ,]+/).filter(Boolean).map(Number).filter(x=>x>0),w=v('c-w').split(/[ ,;]+/).filter(Boolean).map(Number);
    if(w.length!==19||w.some(isNaN))return alert('Informe exatamente 19 parâmetros numéricos (w0 a w18).');
    cfg={w,ret:Math.min(.99,Math.max(.7,+v('c-ret')/100||.9)),novosDia:+v('c-nov')||20,revDia:+v('c-rev')||200,passos:num(v('c-ps')),repassos:num(v('c-rp')),maxIvl:36500,fuzz:document.getElementById('c-fz').checked};await setKV('fsrs',cfg)}
  else if(a==='modelo')return baixar('modelo-flashcards.csv','Frente,Verso,Tags,Baralho,Tipo,Extra\n"Capital do Brasil?","Brasília","geografia","Geografia","normal",""\n"A {{c1::mitocôndria}} produz {{c2::ATP::molécula de energia}}","","biologia","Biologia::Celular","cloze","Organela energética"\n');
  else if(a==='exportar'){const cs=(await all('cartoes')).filter(c=>!c.rev&&(c.tipo!=='cloze'||c.ord===1||!c.ord));
    return baixar('flashcards.csv',['Frente,Verso,Tags,Baralho,Tipo,Extra',...cs.map(c=>[c.f,c.v,c.tags.join(' '),c.baralho,c.tipo,c.extra].map(cel).join(','))].join('\n'))}
  await pintar();
}
function tecla(e){
  if(modo==='editor'&&e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();return acao('cloze',{})}
  if(modo!=='rev'||!ses?.atual||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(!ses.mostrar&&(e.key===' '||e.key==='Enter')){e.preventDefault();ses.mostrar=true;pintar()}
  else if(ses.mostrar&&['1','2','3','4'].includes(e.key))responder(+e.key);
  else if(e.key==='z')desfazer();else if(e.key==='e')acao('editar',{});
}
export function initEstudo(render){
  rr=render;const v=document.getElementById('view');
  v.addEventListener('click',e=>{const b=e.target.closest('[data-e]');if(b&&b.tagName==='BUTTON')acao(b.dataset.e,b.dataset)});
  v.addEventListener('change',async e=>{const t=e.target;
    if(t.dataset.e==='arq'){for(const f of t.files)inserir(`[midia:${await salvarMidia(f)}]`);t.value=''}
    else if(t.dataset.e==='csv'){try{await importar(await t.files[0].text())}catch{alert('Não foi possível ler o arquivo. Confira se é um CSV em UTF-8.')}t.value='';await rr()}});
  v.addEventListener('paste',async e=>{const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/'));if(f){e.preventDefault();inserir(`[midia:${await salvarMidia(f)}]`)}});
  v.addEventListener('focusin',e=>{if(e.target.id?.startsWith('ed-'))campo=e.target.id.slice(3)});
  addEventListener('keydown',tecla);
}
