/* Energy accounting counts each stock batch once, independently of recipes. */
(function(root){
'use strict';
const B=typeof module!=='undefined'?require('./stock-batches.js'):root.StockBatches;
const value=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
function perUnit(i){
 const explicit=value(i.kcalPerUnit);if(explicit!==null)return explicit;
 const n=i.nutrition||{};let kcal=value(n['energy-kcal_100g']);
 if(kcal===null){const kj=value(n['energy-kj_100g']);if(kj!==null)kcal=kj/4.184;}
 if(kcal===null)return null;
 const units={g:1,gram:1,grams:1,kg:1000,kilograms:1000,ml:1,millilitre:1,millilitres:1,l:1000,litre:1000,litres:1000};
 const raw=String(i.unit||'').trim().toLowerCase();
 const size=units[raw]??(Number(i.packSize)>0&&['g','ml'].includes(i.packUnit)?Number(i.packSize):null);
 return size===null?null:kcal*size/100;
}
function analyse(data,today=new Date().toISOString().slice(0,10)){
 const rows=[];let total=0,expired=0,undated=0,uncounted=0;
 for(const i of data.items||[]){
 const c=(data.categories||[]).find(c=>c.id===i.category),name=String(c?.name||'').toLowerCase();
 if(c?.type==='water'||/alcohol/.test(name+' '+i.category)||Number(i.nutrition?.alcohol_100g)>0||!(c?.type==='food'||/^drinks$/.test(name)))continue;
 if(i.current===null||i.current===undefined||i.current===''){uncounted++;continue;}
 if(!(Number(i.current)>0))continue;
 const batches=B.read(i),usable=batches.filter(b=>!b.expiry||b.expiry>=today).reduce((s,b)=>s+b.quantity,0),old=Number(i.current)-usable;
 expired+=old;undated+=batches.filter(b=>!b.expiry).reduce((s,b)=>s+b.quantity,0);
 const each=perUnit(i),kcal=each===null?null:each*usable;
 if(kcal!==null)total+=kcal;
 rows.push({id:i.id,name:i.name,quantity:usable,expired:old,kcal,perUnit:each});
 }
 const daily=value(data.settings?.householdKcal)>0?Number(data.settings.householdKcal):(Number(data.settings?.people)||4)*2000;
 return {rows,total,daily,days:total/daily,missing:rows.filter(r=>r.quantity>0&&r.kcal===null),uncounted,known:rows.filter(r=>r.quantity>0&&r.kcal!==null).length,expired,undated};
}
const api={perUnit,analyse};if(typeof module!=='undefined')module.exports=api;else root.FoodCoverage=api;
})(typeof window==='undefined'?globalThis:window);
