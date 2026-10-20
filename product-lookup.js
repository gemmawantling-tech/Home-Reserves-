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
function calculatePortions(pack,unit,serving,servingUnit){return Number(pack)>0&&Number(serving)>0&&unit===servingUnit?Number(pack)/Number(serving):null;}
function normalise(p,b){
 const rawUnit=String(p.product_quantity_unit||'').toLowerCase();
 const pack=metricAmount(Number(p.product_quantity)>0&&rawUnit?p.product_quantity+' '+rawUnit:p.quantity);
 const serving=metricAmount(p.serving_size);
 const reported=Number(p.servings_per_package)>0?Number(p.servings_per_package):null;
 const calculated=pack&&serving?calculatePortions(pack.value,pack.unit,serving.value,serving.unit):null;
 return {barcode:b,name:p.product_name_en||p.product_name||'',brand:p.brands||'',image:/^https:\/\//.test(p.image_front_small_url||'')?p.image_front_small_url:'',packLabel:p.quantity||'',packSize:pack?.value??null,packUnit:pack?.unit||'g',ingredients:p.ingredients_text_en||p.ingredients_text||'',dietary:(p.labels_tags||[]).join(', '),allergens:(p.allergens_tags||[]).join(', '),nutrition:p.nutriments||{},servingSize:p.serving_size||'',servingWeight:serving?.value??null,servingUnit:serving?.unit||pack?.unit||'g',portionsPerPack:reported??calculated,portionSource:reported?'reported':calculated?'calculated':'',portionType:'ingredient',source:'Open Food Facts',sourceUrl:'https://world.openfoodfacts.org/product/'+b};
}
async function lookup(b,{fetcher=fetch,signal}={}){const fields='product_name,product_name_en,brands,image_front_small_url,quantity,product_quantity,product_quantity_unit,ingredients_text,ingredients_text_en,labels_tags,allergens_tags,nutriments,serving_size,servings_per_package';const response=await fetcher('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(b)+'.json?user_agent=HomeReserves%2F2.0%20(https%3A%2F%2Fgemmawantling-tech.github.io%2FHome-Reserves-%2F)&fields='+fields,{signal,headers:{'Accept':'application/json'}});if(!response.ok)throw Error(response.status===429?'Product lookup is busy. Try again later or enter details manually.':'Product lookup failed. Check your connection or enter details manually.');const data=await response.json();return data.status===1&&data.product?normalise(data.product,b):null;}
const api={lookup,normalise,metricAmount,calculatePortions};if(typeof module!=='undefined')module.exports=api;else root.ProductLookup=api;
})(typeof window==='undefined'?globalThis:window);
