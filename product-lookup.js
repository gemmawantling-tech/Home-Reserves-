/* Provider boundary: camera frames never leave the device. */
(function(root){
'use strict';
// Accept one unambiguous metric amount; never turn missing weight into zero.
function metricAmount(text){
 const value=String(text||'').trim();
 if(/(?:\d\s*[x×]|[x×]\s*\d|cooked|prepared|drained|diluted)/i.test(value))return null;
 const matches=[...value.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|g|grams?|ml|millilitres?|cl|l|litres?)\b/gi)];
 if(matches.length!==1)return null;
 const m=matches[0];if(/^\d+,\d{3}$/.test(m[1]))return null;const n=Number(m[1].replace(',','.')),u=m[2].toLowerCase();
 if(!(n>0))return null;
 return {value:n*(u==='kg'||u.startsWith('kilogram')||u==='l'||u.startsWith('litre')?1000:u==='cl'?10:1),unit:/^(?:ml|millilitre|cl|l|litre)/.test(u)?'ml':'g'};
}
function packAmount(text){const simple=metricAmount(text);if(simple)return simple;const m=String(text||'').trim().match(/^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\s*$/i);if(!m||Number(m[1])<1||Number(m[1])>1000)return null;const inner=metricAmount(m[2]+' '+m[3]);return inner?{value:inner.value*Number(m[1]),unit:inner.unit}:null;}
function calculatePortions(pack,unit,serving,servingUnit){return Number(pack)>0&&Number(serving)>0&&unit===servingUnit?Number(pack)/Number(serving):null;}
function normalise(p,b){
 const rawUnit=String(p.product_quantity_unit||'').toLowerCase();
 const pack=packAmount(Number(p.product_quantity)>0&&rawUnit?p.product_quantity+' '+rawUnit:p.quantity);
 const serving=metricAmount(p.serving_size);
 const reported=Number(p.servings_per_package)>0?Number(p.servings_per_package):null;
 const calculated=pack&&serving?calculatePortions(pack.value,pack.unit,serving.value,serving.unit):null;
 return {barcode:b,name:p.product_name_en||p.product_name||'',brand:p.brands||'',image:/^https:\/\//.test(p.image_front_small_url||'')?p.image_front_small_url:'',packLabel:p.quantity||'',packSize:pack?.value??null,packUnit:pack?.unit||'g',ingredients:p.ingredients_text_en||p.ingredients_text||'',dietary:(p.labels_tags||[]).join(', '),allergens:(p.allergens_tags||[]).join(', '),nutrition:p.nutriments||{},servingSize:p.serving_size||'',servingWeight:serving?.value??null,servingUnit:serving?.unit||pack?.unit||'g',portionsPerPack:reported??calculated,portionSource:reported?'reported':calculated?'calculated':'',portionType:'ingredient',source:'Open Food Facts',sourceUrl:'https://world.openfoodfacts.org/product/'+b};
}
// Only registered, licensed providers are used. No scraping or secret API keys in this PWA.
const providers=[];
function registerProvider(provider){if(!provider||typeof provider.lookup!=='function'||!provider.name||!provider.licence)throw Error('A provider needs a lookup function, name and licence.');providers.push(provider);}
function barcodeVariants(code){const b=String(code);return [...new Set([b,...(/^0\d{12}$/.test(b)?[b.slice(1)]:[]),...(/^\d{12}$/.test(b)?['0'+b]:[])])];}
async function lookup(b,{fetcher=fetch,signal}={}){
 const fields='product_name,product_name_en,brands,image_front_small_url,quantity,product_quantity,product_quantity_unit,ingredients_text,ingredients_text_en,labels_tags,allergens_tags,nutriments,serving_size,servings_per_package';
 for(const code of barcodeVariants(b)){
 const response=await fetcher('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?user_agent=HomeReserves%2F3.0%20(https%3A%2F%2Fgemmawantling-tech.github.io%2FHome-Reserves-%2F)&fields='+fields,{signal,headers:{'Accept':'application/json'}});
 if(response.status===404)continue;
 if(!response.ok)throw Error(response.status===429?'Product lookup is busy. Try again later or enter details manually.':'Barcode read, but product lookup could not connect. Enter details manually or retry.');
 const data=await response.json();if(data.status===1&&data.product)return normalise(data.product,b);
 }
 for(const provider of providers){const p=await provider.lookup(b,{fetcher,signal});if(p)return {...p,barcode:b,source:provider.name,sourceLicence:provider.licence};}
 return null;
}

const api={lookup,registerProvider,barcodeVariants,normalise,metricAmount,packAmount,calculatePortions};if(typeof module!=='undefined')module.exports=api;else root.ProductLookup=api;
})(typeof window==='undefined'?globalThis:window);
