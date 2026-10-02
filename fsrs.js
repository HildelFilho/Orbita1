// FSRS-5 (módulo puro, sem DOM). Estados: 0 Novo, 1 Aprendendo, 2 Revisão, 3 Reaprendendo. Notas: 1 De novo, 2 Difícil, 3 Bom, 4 Fácil.
// Parâmetros padrão do FSRS-5 (open-spaced-repetition / ts-fsrs). Confira em tests.html.
export const PADRAO={w:[0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,1.54575,0.1192,1.01925,1.9395,0.11,0.29605,2.2698,0.2315,2.9898,0.51655,0.6621],
 ret:0.9,passos:[1,10],repassos:[10],maxIvl:36500,fuzz:false,novosDia:20,revDia:200};
export const DECAY=-0.5,FACTOR=19/81,DIA=864e5,MIN=6e4;
const lim=(x,a,b)=>Math.min(Math.max(x,a),b);
export const R=(t,S)=>(1+FACTOR*t/S)**DECAY;                                   // retrievability
export const intervalo=(S,ret,max)=>lim(Math.round(S/FACTOR*(ret**(1/DECAY)-1)),1,max);
export const S0=(w,g)=>Math.max(w[g-1],0.1);
export const D0=(w,g)=>lim(w[4]-Math.exp(w[5]*(g-1))+1,1,10);
const Dn=(w,D,g)=>{const d=D-w[6]*(g-3)*(10-D)/9;return lim(w[7]*(w[4]-Math.exp(w[5]*3)+1)+(1-w[7])*d,1,10)}; // delta + mean reversion
const Sok=(w,D,S,r,g)=>S*(1+Math.exp(w[8])*(11-D)*S**-w[9]*(Math.exp(w[10]*(1-r))-1)*(g===2?w[15]:1)*(g===4?w[16]:1));
const Sfail=(w,D,S,r)=>Math.min(w[11]*D**-w[12]*((S+1)**w[13]-1)*Math.exp(w[14]*(1-r)),S/Math.exp(w[17]*w[18]));
const Scurto=(w,S,g)=>{let f=Math.exp(w[17]*(g-3+w[18]));if(g>=3)f=Math.max(f,1);return S*f}; // mesmo dia
const fz=(i,cf)=>{if(!cf.fuzz||i<3)return i;const d=Math.max(1,Math.round(i*.05));return i+Math.floor(Math.random()*(2*d+1))-d};
export const novoCartao=()=>({estado:0,due:Date.now(),S:0,D:0,last:null,reps:0,lapses:0,passo:0});

// Intervalos (dias) de Difícil/Bom/Fácil em revisão, garantindo Difícil < Bom < Fácil
function ivRev(c,t,cf){
  const w=cf.w,r=R(t,c.S),S={},I={};
  for(const g of [2,3,4])S[g]=Sok(w,c.D,c.S,r,g);
  I[2]=intervalo(S[2],cf.ret,cf.maxIvl);I[3]=Math.max(intervalo(S[3],cf.ret,cf.maxIvl),I[2]+1);I[4]=Math.max(intervalo(S[4],cf.ret,cf.maxIvl),I[3]+1);
  for(const g of [2,3,4])I[g]=Math.min(I[g],cf.maxIvl);
  return {S,I};
}
export function agendar(c,g,agora=Date.now(),cf=PADRAO){
  const w=cf.w,n={...c,reps:c.reps+1,last:agora},t=c.last?(agora-c.last)/DIA:0;
  const L=c.estado<=1?1:3,ps=L===1?cf.passos:cf.repassos,min=m=>agora+m*MIN;
  const grad=S=>{n.S=S;n.estado=2;n.passo=0;n.due=agora+fz(intervalo(S,cf.ret,cf.maxIvl),cf)*DIA};
  if(c.estado===2&&t>=1){                                   // revisão em dias diferentes
    n.D=Dn(w,c.D,g);
    if(g===1){n.S=Sfail(w,c.D,c.S,R(t,c.S));n.lapses++;
      if(cf.repassos.length){n.estado=3;n.passo=0;n.due=min(cf.repassos[0])}else grad(n.S)}
    else{const v=ivRev(c,t,cf);n.S=v.S[g];n.estado=2;n.due=agora+fz(v.I[g],cf)*DIA}
    return n;
  }
  if(c.estado===0){n.S=S0(w,g);n.D=D0(w,g)}                   // primeira vez
  else{n.S=Scurto(w,c.S,g);n.D=Dn(w,c.D,g)}                   // aprendizado/reaprendizado/mesmo dia
  if(g===1){if(c.estado>=2)n.lapses++;if(ps.length){n.estado=L;n.passo=0;n.due=min(ps[0])}else grad(n.S)}
  else if(c.estado===2||!ps.length||g===4)grad(n.S);
  else if(g===2){const p=c.estado===0?0:c.passo;n.estado=L;n.passo=p;
    n.due=min(p===0&&ps.length===1?ps[0]*1.5:p===0?(ps[0]+ps[1])/2:ps[p])}
  else{const p=(c.estado===0?0:c.passo)+1;if(p<ps.length){n.estado=L;n.passo=p;n.due=min(ps[p])}else grad(n.S)}
  return n;
}
export function texto(ms){
  if(ms<MIN)return '<1m';if(ms<36e5)return Math.round(ms/MIN)+'m';if(ms<DIA)return Math.round(ms/36e5)+'h';
  const d=ms/DIA;return d<30?Math.round(d)+'d':d<365?(d/30).toFixed(1).replace('.0','')+' mês':(d/365).toFixed(1).replace('.0','')+' a';
}
export const prever=(c,agora=Date.now(),cf=PADRAO)=>Object.fromEntries([1,2,3,4].map(g=>[g,texto(agendar(c,g,agora,cf).due-agora)]));
