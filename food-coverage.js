/* Energy accounting counts each stock batch once, independently of recipes. */
(function(root){
'use strict';
const Lookup=typeof module!=='undefined'?require('./product-lookup.js'):root.ProductLookup;
const Core=typeof module!=='undefined'?require('./inventory-core.js'):root.InventoryCore;
const B=typeof module!=='undefined'?require('./stock-batches.js'):root.StockBatches;
function expiry(value){try{return Core.parseExpiry(value);}catch{return '';}}
const value=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
function measure(i){
 const raw=String(i.unit||'').trim().toLowerCase(),units={g:[1,'g'],gram:[1,'g'],grams:[1,'g'],kg:[1000,'g'],kilogram:[1000,'g'],kilograms:[1000,'g'],ml:[1,'ml'],millilitre:[1,'ml'],millilitres:[1,'ml'],l:[1000,'ml'],litre:[1000,'ml'],litres:[1000,'ml']};
 if(units[raw])return {size:units[raw][0],unit:units[raw][1],loose:true};
 return Number(i.packSize)>0&&['g','ml'].includes(i.packUnit)?{size:Number(i.packSize),unit:i.packUnit,loose:false}:null;
}
function labelEnergy(n,suffix){let kcal=value(n['energy-kcal_'+suffix]);if(kcal!==null)return kcal;let kj=value(n['energy-kj_'+suffix]);if(kj!==null)return kj/4.184;
 const raw=value(n['energy_'+suffix]),unit=String(n.energy_unit||'').toLowerCase();return raw!==null&&['kj','kcal'].includes(unit)?raw/(unit==='kj'?4.184:1):null;
}
function perUnit(i){
 const explicit=value(i.kcalPerUnit);if(explicit!==null)return explicit;
 const n=i.nutrition||{},m=measure(i);if(!m)return null;
 const per100=labelEnergy(n,'100g');if(per100!==null)return per100*m.size/100;
 const serving=labelEnergy(n,'serving'),labelServing=Lookup.metricAmount(i.servingSize);
 return serving!==null&&labelServing&&labelServing.unit===m.unit?serving*m.size/labelServing.value:null;
}
function eligible(i,data){const c=(data.categories||[]).find(c=>c.id===i.category),name=String(c?.name||'').toLowerCase();return c?.type!=='water'&&!/alcohol|\b(beer|wine|cider|spirits)\b/.test(name+' '+i.category)&&!(Number(i.nutrition?.alcohol_100g)>0)&&(c?.type==='food'||c?.id==='drinks'||/\b(drinks?|beverages?|tea|coffee|juice)\b/.test(name));}
function assess(data,today=new Date().toISOString().slice(0,10)){
 const energy=analyse(data,today),groups=new Map(),uncountedItems=[];
 for(const c of data.categories||[])if(c.type==='food')groups.set(c.id,{id:c.id,name:c.name,types:0,packs:0,grams:0,ml:0,missingWeight:0,below:0});let packs=0,grams=0,ml=0,missingWeight=0,undatedTypes=0;const weightReview=[];
 for(const i of data.items||[]){if(!eligible(i,data))continue;
 if(value(i.current)===null){uncountedItems.push(i);continue;}const q=Number(i.current);if(!(q>0))continue;
 const c=(data.categories||[]).find(c=>c.id===i.category),id=c?.id||'',g=groups.get(id)||{id,name:c?.name||'Food',types:0,packs:0,grams:0,ml:0,missingWeight:0,below:0};
 const m=measure(i);if(B.read(i).some(b=>!expiry(b.expiry)))undatedTypes++;g.types++;if(!m?.loose){packs+=q;g.packs+=q;}if(m){const mass=q*m.size;if(m.unit==='g'){grams+=mass;g.grams+=mass;}else{ml+=mass;g.ml+=mass;}}else{missingWeight++;g.missingWeight++;if(perUnit(i)!==null)weightReview.push({id:i.id,name:i.name,quantity:q,unit:i.unit||'units'});}
 if(value(i.optimum)!==null&&Number(i.optimum)>q)g.below++;
 groups.set(id,g);
 }
 const missing=energy.missing.map(r=>{const i=(data.items||[]).find(i=>i.id===r.id),m=measure(i);return {...r,packSize:m?.size||null,packUnit:m?.unit||'',unit:i.unit||'units',mass:m?r.quantity*m.size:null};}).sort((a,b)=>(b.mass!==null)-(a.mass!==null)||(b.mass||0)-(a.mass||0)||b.quantity-a.quantity);
 return {...energy,packs,grams,ml,missingWeight,weightReview,undatedTypes,uncountedItems,stockTypes:energy.rows.length,groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'en-GB')),missing};
}

function analyse(data,today=new Date().toISOString().slice(0,10)){
 const rows=[];let total=0,expired=0,undated=0,uncounted=0;
 for(const i of data.items||[]){
 if(!eligible(i,data))continue;
 if(i.current===null||i.current===undefined||i.current===''){uncounted++;continue;}
 if(!(Number(i.current)>0))continue;
 const batches=B.read(i).map(b=>({...b,expiry:expiry(b.expiry)})),usable=batches.filter(b=>!b.expiry||b.expiry>=today).reduce((s,b)=>s+b.quantity,0),old=Math.max(0,Math.round((Number(i.current)-usable)*1e8)/1e8);
 expired+=old;undated+=batches.filter(b=>!b.expiry).reduce((s,b)=>s+b.quantity,0);
 const each=perUnit(i),kcal=each===null?null:each*usable;
 if(kcal!==null)total+=kcal;
 rows.push({id:i.id,name:i.name,quantity:usable,expired:old,kcal,perUnit:each});
 }
 const daily=value(data.settings?.householdKcal)>0?Number(data.settings.householdKcal):(Number(data.settings?.people)||4)*2000;
 return {rows,total,daily,days:total/daily,missing:rows.filter(r=>r.quantity>0&&r.kcal===null),uncounted,known:rows.filter(r=>r.quantity>0&&r.kcal!==null).length,expired,undated};
}
const api={perUnit,analyse,measure,assess,eligible};if(typeof module!=='undefined')module.exports=api;else root.FoodCoverage=api;
})(typeof window==='undefined'?globalThis:window);
