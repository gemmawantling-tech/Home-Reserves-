/* Local recovery history. Snapshots never leave this browser. */
(function(root){
'use strict';
const DB='home_reserves_recovery_v1',STORE='snapshots';let opening,queue=Promise.resolve(),timer,pending;
const status={last:'',count:0,error:'',ready:false};
function open(){if(!opening)opening=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Recovery storage unavailable.'));}).catch(e=>{opening=null;throw e;});return opening;}
async function all(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function changed(){root.dispatchEvent?.(new Event('reserves-backups-updated'));}
function enqueue(task){const next=queue.then(task);queue=next.catch(()=>{});return next;}
function capture(data,{safety=false,now=new Date()}={}){const copy=JSON.parse(JSON.stringify(data));return enqueue(async()=>{try{
 const rows=await all(),date=now.toISOString(),day=date.slice(0,10),text=JSON.stringify(copy),latest=rows.filter(r=>r.kind==='recent').sort((a,b)=>b.at.localeCompare(a.at))[0];
 const daily=rows.find(r=>r.id==='daily-'+day);if(!safety&&latest&&JSON.stringify(latest.data)===text&&daily&&JSON.stringify(daily.data)===text){status.last=daily.at;status.count=rows.length;status.error='';status.ready=true;changed();return true;}
 const additions=[{id:'daily-'+day,kind:'daily',at:date,data:copy}];
 if(safety)additions.push({id:'safety-'+date+'-'+Math.random().toString(36).slice(2),kind:'safety',at:date,data:copy});
 if(!latest||JSON.stringify(latest.data)!==text)additions.push({id:'recent-'+date+'-'+Math.random().toString(36).slice(2),kind:'recent',at:date,data:copy});
 const merged=new Map(rows.map(r=>[r.id,r]));for(const r of additions)merged.set(r.id,r);
 const keep=new Set();for(const [kind,limit] of [['daily',14],['recent',10],['safety',3]])for(const r of [...merged.values()].filter(r=>r.kind===kind).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,limit))keep.add(r.id);
 const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);for(const r of additions)store.put(r);for(const r of merged.values())if(!keep.has(r.id))store.delete(r.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Recovery save interrupted.'));});
 status.last=date;status.count=keep.size;status.error='';status.ready=true;changed();return true;
 }catch(e){status.error='Automatic recovery copy could not be saved. Download a backup now.';status.ready=true;changed();throw e;}});}
function schedule(data){pending=JSON.parse(JSON.stringify(data));clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),500);}
function flush(){clearTimeout(timer);const data=pending;pending=null;return data?capture(data):queue;}
function fallback(){try{return JSON.parse(localStorage.getItem('home_reserves_safety_copy_v1'));}catch{return null;}}
async function safety(data){try{return await capture(data,{safety:true});}catch{try{localStorage.setItem('home_reserves_safety_copy_v1',JSON.stringify({at:new Date().toISOString(),data}));return true;}catch{throw Error('Could not protect your current records. Download a backup before importing or restoring.');}}}
async function list(){await flush().catch(()=>{});let rows;try{rows=await all();}catch(e){if(!fallback())throw e;rows=[];}const extra=fallback();if(extra)rows.push({id:'fallback',kind:'safety fallback',at:extra.at,data:extra.data});return rows.sort((a,b)=>b.at.localeCompare(a.at)).map(r=>({id:r.id,kind:r.kind,at:r.at,items:r.data.items?.length||0,recipes:r.data.cookbook?.length||0}));}
async function read(id){await flush().catch(()=>{});if(id==='fallback'){const row=fallback();if(row?.data)return JSON.parse(JSON.stringify(row.data));}await queue;const rows=await all(),row=rows.find(r=>r.id===id);if(!row)throw Error('That recovery copy is no longer available. Reopen the list.');return JSON.parse(JSON.stringify(row.data));}

const api={capture,safety,schedule,flush,list,read,status};if(typeof module!=='undefined')module.exports=api;else root.BackupStore=api;
})(typeof window==='undefined'?globalThis:window);
