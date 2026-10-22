/* Read-only ingredient checks; never deduct stock or infer density. */
(function(root){
'use strict';
const units={g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],tsp:['ml',5],tbsp:['ml',15],stock:['stock',1]};
function parseIngredient(text){let s=String(text||'').trim().replace(/½/g,' 1/2').replace(/¼/g,' 1/4').replace(/¾/g,' 3/4').replace(/⅓/g,' 1/3').replace(/⅔/g,' 2/3').trim();const m=s.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(kg|g|ml|litres?|liters?|l|tbsp|tsp)\b\s*(.*)$/i);if(!m)return {name:String(text||''),amount:null,unit:'stock'};const number=m[1].split(/\s+/).reduce((sum,n)=>sum+(n.includes('/')?Number(n.split('/')[0])/Number(n.split('/')[1]):Number(n)),0);const unit=/^lit/.test(m[2].toLowerCase())?'l':m[2].toLowerCase();return {name:m[3],amount:Number.isFinite(number)&&number>0?number*units[unit][1]:null,unit:units[unit][0]};}
function normalName(value){return String(value||'').toLowerCase().replace(/\b(warm|cold|hot)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function suggestion(text,items){const name=normalName(parseIngredient(text).name);const found=items.filter(i=>normalName(i.name)===name);return found.length===1?found[0].id:'';}
function stockMeasure(item,unit){
 if(unit==='stock')return 1;
 const itemUnit=String(item.unit||'').trim().toLowerCase();const aliases={gram:'g',grams:'g',kilogram:'kg',kilograms:'kg',litre:'l',litres:'l',liter:'l',liters:'l',millilitre:'ml',millilitres:'ml'};const base=units[aliases[itemUnit]||itemUnit];
 if(base&&base[0]===unit)return base[1];
 if(item.packUnit===unit&&Number.isFinite(Number(item.packSize))&&Number(item.packSize)>0)return Number(item.packSize);
 if(unit==='ml'&&Number.isFinite(Number(item.litresPerUnit))&&Number(item.litresPerUnit)>0)return Number(item.litresPerUnit)*1000;
 return null;
}
function check(recipe,items,{today=new Date()}={}){
 const remaining=new Map();const rows=(recipe.ingredients||[]).map((ingredient,index)=>{
  const link=recipe.pantryLinks?.[index];if(!link||link.ingredient!==ingredient||!link.itemId)return {ingredient,status:'unlinked',message:'Not linked to pantry stock'};
  const item=items.find(i=>i.id===link.itemId);if(!item)return {ingredient,status:'missing',message:'Linked item was removed from your pantry'};
  const row={ingredient,itemId:item.id,itemName:item.name,location:item.location||'',needed:Number(link.amount),unit:link.unit};
  if(item.current===null||item.current===undefined||item.current===''||!Number.isFinite(Number(item.current)))return {...row,status:'unknown',message:'Stock has not been counted'};
  if(!(Number(item.current)>0))return {...row,status:'missing',available:0,message:'Out of stock'};
  const requested=units[link.unit],perPack=requested?stockMeasure(item,requested[0]):null;
  if(!(Number(link.amount)>0)||!Number.isFinite(Number(link.amount))||!requested||perPack===null)return {...row,status:'unknown',message:'Check quantity or add a compatible pack weight / volume in Pantry'};
  const neededPacks=Number(link.amount)*requested[1]/perPack;
  const stock=remaining.has(item.id)?remaining.get(item.id):Math.max(0,Number(item.current));const enough=stock+1e-9>=neededPacks;
  remaining.set(item.id,Math.max(0,stock-neededPacks));
  const expired=/^\d{4}-\d{2}-\d{2}$/.test(item.expiry||'')&&item.expiry<[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  return {...row,available:stock*perPack/requested[1],shortfall:Math.max(0,(neededPacks-stock)*perPack/requested[1]),status:expired?'review':enough?'available':'short',message:expired?'Past the recorded date — check the pack':enough?'Enough recorded stock':'Not enough recorded stock'};
 });return {rows,ready:rows.length>0&&rows.every(r=>r.status==='available'),available:rows.filter(r=>r.status==='available').length};
}
function validateLinks(recipe,links,items){return recipe.ingredients.map((ingredient,index)=>{const link=links[index];if(!link?.itemId)return null;if(!items.some(i=>i.id===link.itemId))throw Error('Choose a current pantry item.');const amount=link.amount===null||link.amount===''?null:Number(link.amount);if(amount!==null&&(!Number.isFinite(amount)||amount<=0))throw Error('Ingredient amounts must be positive, or blank if unknown.');if(!units[link.unit])throw Error('Choose a supported ingredient unit.');return {ingredient,itemId:link.itemId,amount,unit:link.unit};});}
const api={parseIngredient,suggestion,stockMeasure,check,validateLinks};if(typeof module!=='undefined')module.exports=api;else root.RecipeStock=api;
})(typeof window==='undefined'?globalThis:window);
