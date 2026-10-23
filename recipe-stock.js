/* Read-only ingredient checks; never deduct stock or infer density. */
(function(root){
'use strict';
const Batches=typeof module!=='undefined'?require('./stock-batches.js'):root.StockBatches;
const units={g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],tsp:['ml',5],tbsp:['ml',15],stock:['stock',1]};
function parseIngredient(text){let s=String(text||'').trim().replace(/½/g,' 1/2').replace(/¼/g,' 1/4').replace(/¾/g,' 3/4').replace(/⅓/g,' 1/3').replace(/⅔/g,' 2/3').trim();const m=s.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(kg|g|ml|litres?|liters?|l|tbsp|tsp)\b\s*(.*)$/i);if(!m)return {name:String(text||''),amount:null,unit:'stock'};const number=m[1].split(/\s+/).reduce((sum,n)=>sum+(n.includes('/')?Number(n.split('/')[0])/Number(n.split('/')[1]):Number(n)),0);const unit=/^lit/.test(m[2].toLowerCase())?'l':m[2].toLowerCase();return {name:m[3],amount:Number.isFinite(number)&&number>0?number*units[unit][1]:null,unit:units[unit][0]};}
function normalName(value){return String(value||'').toLowerCase().replace(/\b(warm|cold|hot)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function suggestion(text,items){const name=normalName(parseIngredient(text).name);const found=items.filter(i=>normalName(i.name)===name);return found.length===1?found[0].id:'';}
function stockMeasure(item,unit){
 if(unit==='stock')return 1;
 const itemUnit=String(item.unit||'').trim().toLowerCase();const aliases={gram:'g',grams:'g',kilogram:'kg',kilograms:'kg',litre:'l',litres:'l',liter:'l',liters:'l',millilitre:'ml',millilitres:'ml'};const base=units[aliases[itemUnit]||itemUnit];
 if(base)return base[0]===unit?base[1]:null;
 if(item.packUnit===unit&&Number.isFinite(Number(item.packSize))&&Number(item.packSize)>0)return Number(item.packSize);
 if(unit==='ml'&&Number.isFinite(Number(item.litresPerUnit))&&Number(item.litresPerUnit)>0)return Number(item.litresPerUnit)*1000;
 return null;
}
function convertAmount(amount,from,to){const a=units[from],b=units[to];return a&&b&&a[0]===b[0]&&Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount)*a[1]/b[1]:null;}
function reconcileLinks(old,ingredients){
 const previous=old?.ingredients||[],used=new Set();
 return ingredients.map(ingredient=>{
  const parsed=parseIngredient(ingredient),key=normalName(parsed.name);
  let index=previous.findIndex((text,n)=>!used.has(n)&&String(text).trim()===ingredient.trim());
  if(index<0){const matches=previous.map((text,n)=>({n,p:parseIngredient(text)})).filter(({n,p})=>!used.has(n)&&normalName(p.name)===key);if(matches.length===1)index=matches[0].n;}
  if(index<0)return null;used.add(index);const link=old.pantryLinks?.[index];if(!link?.itemId||link.ingredient!==previous[index])return null;
  const before=parseIngredient(previous[index]),sameQuantity=before.amount===parsed.amount&&before.unit===parsed.unit;
  return {...link,ingredient,...(!sameQuantity?{amount:null,needsQuantityReview:true}:{})};
 });
}
function recipeLinks(recipe){const links=recipe?.pantryLinks||[];return reconcileLinks({ingredients:links.map(link=>link?.ingredient||''),pantryLinks:links},recipe?.ingredients||[]);}
function itemDimension(item){const raw=String(item.unit||'').trim().toLowerCase();if(/^(g|grams?|kg|kilograms?)$/.test(raw))return 'g';if(/^(ml|millilitres?|l|litres?|liters?)$/.test(raw))return 'ml';if(Number(item.packSize)>0&&['g','ml'].includes(item.packUnit))return item.packUnit;if(Number(item.litresPerUnit)>0)return 'ml';return null;}
function check(recipe,items,{today=new Date()}={}){
 const remaining=new Map(),links=recipeLinks(recipe);const rows=(recipe.ingredients||[]).map((ingredient,index)=>{
  const link=links[index];if(!link||link.ingredient!==ingredient||!link.itemId)return {ingredient,linked:false,reason:'unlinked',status:'unlinked',message:'Choose a pantry item'};
  const item=items.find(i=>i.id===link.itemId);if(!item)return {ingredient,linked:false,reason:'removed',status:'missing',message:'Previously linked item was removed from your pantry'};
  const row={ingredient,linked:true,itemId:item.id,itemName:item.name,location:item.location||'',needed:Number(link.amount),unit:link.unit,stockUnit:item.unit||'unit'};
  if(link.needsQuantityReview)return {...row,reason:'recipe_changed',status:'unknown',message:'Recipe amount changed — confirm the quantity; your item link is kept'};
  const requested=units[link.unit];
  if(!(Number(link.amount)>0)||!Number.isFinite(Number(link.amount))||!requested)return {...row,reason:'requirement',status:'unknown',message:'Enter the amount needed for this recipe'};
  if(item.current===null||item.current===undefined||item.current===''||!Number.isFinite(Number(item.current)))return {...row,reason:'count',status:'unknown',message:'Count not recorded — enter how much you have'};
  if(!(Number(item.current)>0))return {...row,reason:'empty',status:'missing',available:0,message:'Out of stock'};
  const perPack=stockMeasure(item,requested[0]);
  if(perPack===null){const dimension=itemDimension(item),mismatch=dimension&&dimension!==requested[0];return {...row,reason:mismatch?'units':'size',status:'unknown',message:mismatch?'Recipe uses '+(requested[0]==='ml'?'volume':'weight')+'; pantry stock uses '+(dimension==='g'?'weight':'volume')+' — confirm an equivalent amount':'Pack size missing — add its labelled weight or volume'};}
  const neededPacks=Number(link.amount)*requested[1]/perPack;
  const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const all=Batches.read(item),eligible=all.filter(r=>!r.expiry||r.expiry>=date).reduce((sum,r)=>sum+r.quantity,0),expiredQuantity=all.filter(r=>r.expiry&&r.expiry<date).reduce((sum,r)=>sum+r.quantity,0);
  const stock=remaining.has(item.id)?remaining.get(item.id):eligible;const enough=stock+1e-9>=neededPacks;
  remaining.set(item.id,Math.max(0,stock-neededPacks));
  const needsDateReview=!enough&&expiredQuantity>0;
  return {...row,available:stock*perPack/requested[1],shortfall:enough?0:Math.max(0,(neededPacks-stock)*perPack/requested[1]),reason:needsDateReview?'expiry':enough?'enough':'short',status:needsDateReview?'review':enough?'available':'short',message:needsDateReview?'Past the recorded date — review batches':enough?'Enough recorded stock':'Not enough recorded stock'};
 });return {rows,linked:rows.filter(r=>r.linked).length,ready:rows.length>0&&rows.every(r=>r.status==='available'),available:rows.filter(r=>r.status==='available').length};
}

function validateLinks(recipe,links,items){return recipe.ingredients.map((ingredient,index)=>{const link=links[index];if(!link?.itemId)return null;if(!items.some(i=>i.id===link.itemId))throw Error('Choose a current pantry item.');const amount=link.amount===null||link.amount===''?null:Number(link.amount);if(amount!==null&&(!Number.isFinite(amount)||amount<=0))throw Error('Ingredient amounts must be positive, or blank if unknown.');if(!units[link.unit])throw Error('Choose a supported ingredient unit.');return {ingredient,itemId:link.itemId,amount,unit:link.unit};});}
const api={parseIngredient,suggestion,stockMeasure,itemDimension,convertAmount,reconcileLinks,recipeLinks,check,validateLinks};if(typeof module!=='undefined')module.exports=api;else root.RecipeStock=api;
})(typeof window==='undefined'?globalThis:window);
