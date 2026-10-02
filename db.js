// Camada mínima sobre IndexedDB. Todas as lojas já existem para as próximas etapas.
const LOJAS=['kv','tarefas','habitos','eventos','baralhos','cartoes','revisoes','transacoes','midias','notas','sessoes'];
let _db;
const abrir=()=>_db??=new Promise((ok,err)=>{
  const r=indexedDB.open('orbita',2);
  r.onupgradeneeded=()=>LOJAS.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})});
  r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
});
const tx=async(s,modo,f)=>{const d=await abrir();return new Promise((ok,err)=>{
  const t=d.transaction(s,modo),q=f(t.objectStore(s));
  t.oncomplete=()=>ok(q?.result);t.onerror=()=>err(t.error);});};
export const all=s=>tx(s,'readonly',o=>o.getAll());
export const put=(s,v)=>tx(s,'readwrite',o=>o.put(v));
export const del=(s,id)=>tx(s,'readwrite',o=>o.delete(id));
export const getKV=async(k,pad)=>(await tx('kv','readonly',o=>o.get(k)))?.v??pad;
export const setKV=(k,v)=>put('kv',{id:k,v});
export const uid=()=>crypto.randomUUID();
export async function exportAll(){const o={};for(const s of LOJAS)o[s]=await all(s);return o}
export async function importAll(o){for(const s of LOJAS)for(const v of o[s]||[])await put(s,v)}
