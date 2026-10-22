(function(root){
'use strict';
const rounded=n=>Math.round(n*1e8)/1e8;
function ordered(rows){return rows.slice().sort((a,b)=>(a.expiry||'9999-99-99').localeCompare(b.expiry||'9999-99-99'));}
function normalise(rows){const merged=new Map();for(const row of rows){const q=Number(row.quantity);if(!Number.isFinite(q)||q<0)throw Error('Batch quantities must be zero or above.');if(q>0){const expiry=String(row.expiry||'');merged.set(expiry,rounded((merged.get(expiry)||0)+q));}}return ordered([...merged].map(([expiry,quantity])=>({quantity,expiry})));}
function consume(rows,quantity){let left=quantity;return ordered(rows).map(row=>{const used=Math.min(left,row.quantity);left=rounded(left-used);return {...row,quantity:rounded(row.quantity-used)};}).filter(row=>row.quantity>0);}
function read(item){const count=Number(item.current);if(item.current===null||item.current===undefined||item.current===''||!Number.isFinite(count)||count<=0)return [];if(!Array.isArray(item.batches))return [{quantity:count,expiry:item.expiry||''}];let rows=normalise(item.batches),sum=rows.reduce((s,r)=>s+r.quantity,0);if(sum>count+1e-8)rows=consume(rows,sum-count);if(sum<count-1e-8)rows=normalise([...rows,{quantity:count-sum,expiry:''}]);return rows;}
function write(item,rows){const batches=normalise(rows);return {...item,batches,current:rounded(batches.reduce((s,r)=>s+r.quantity,0)),expiry:batches.find(r=>r.expiry)?.expiry||''};}
function change(item,quantity,mode,expiry=''){
 if(!Number.isFinite(quantity)||quantity<0)throw Error('Enter a quantity of zero or above.');
 let rows=read(item);const current=rows.reduce((s,r)=>s+r.quantity,0);
 if(mode==='edit'){if(rows.length<=1)rows=rows.map(r=>({...r,expiry}));return write(item,rows);}
 if(mode==='add')rows.push({quantity,expiry});
 else if(mode==='use'){if(quantity>current+1e-8)throw Error('You cannot use more stock than you have.');rows=consume(rows,quantity);}
 else if(mode==='set'){if(quantity<current)rows=consume(rows,current-quantity);else if(quantity>current)rows.push({quantity:quantity-current,expiry});}
 else throw Error('Choose a valid batch action.');
 return write(item,rows);
}
function reconcile(old,item){if(item.current===null)return {...item,batches:[]};if(!old)return write(item,[{quantity:Number(item.current)||0,expiry:item.expiry||''}]);const rows=read(old);if(rows.length===0)return write(item,[{quantity:Number(item.current)||0,expiry:item.expiry||''}]);if(rows.length<=1&&item.expiry!==old.expiry)return write(item,[{quantity:Number(item.current)||0,expiry:item.expiry||''}]);return {...item,...change({...old,...item,current:old.current,batches:rows},Number(item.current)||0,'set',''),id:item.id};}
function freshQuantity(item,today=new Date()){const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');return read(item).filter(r=>r.expiry&&r.expiry>=date).reduce((sum,r)=>sum+r.quantity,0);}
const api={read,write,change,reconcile,freshQuantity};if(typeof module!=='undefined')module.exports=api;else root.StockBatches=api;
})(typeof window==='undefined'?globalThis:window);
