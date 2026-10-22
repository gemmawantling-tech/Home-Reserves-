const CACHE_NAME='home-reserves-v15-nested-food';
const LOCAL_FILES=['./','./index.html','./app.css','./app.js','./food-groups-ui.js','./food-coverage.js','./food-coverage-ui.js','./gap-review.js','./gap-review-ui.js','./stock-batches.js','./stock-batches-ui.js','./cooking-ideas-ui.js','./recipe-book.js','./recipe-book-ui.js','./recipe-stock.js','./recipe-stock-ui.js','./first-aid-kit.js','./first-aid-kit-ui.js','./inventory-core.js','./product-lookup.js','./barcode-scanner.js','./scanning.js','./vendor/zxing.min.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(LOCAL_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('home-reserves-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
