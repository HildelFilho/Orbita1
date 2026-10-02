// Service worker: app shell em stale-while-revalidate. Mude V a cada versão para renovar o cache.
const V='orbita-v3',A=['./','index.html','css/app.css','js/app.js','js/db.js','js/estudo.js','js/foco.js','js/fsrs.js','icons/icon.svg','manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.open(V).then(async c=>{
    const m=await c.match(e.request,{ignoreSearch:true});
    const n=fetch(e.request).then(r=>{if(r.ok&&new URL(e.request.url).origin===location.origin)c.put(e.request,r.clone());return r}).catch(()=>m||c.match('index.html'));
    return m||n;
  }));
});
