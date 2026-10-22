/* Pure inventory operations shared by scanner and tests. */
(function(root){
'use strict';
function barcode(value){const b=String(value).trim();if(!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(b))throw Error('Enter a valid EAN-8, EAN-13, UPC or GTIN barcode.');let sum=0;for(let i=b.length-2,n=0;i>=0;i--,n++)sum+=Number(b[i])*(n%2?1:3);if((10-sum%10)%10!==Number(b.at(-1)))throw Error('Barcode check digit is invalid. Check the numbers and try again.');return b.length===12?'0'+b:b.length===14&&b[0]==='0'?b.slice(1):b;}
function adjust(current,quantity,mode){if(!Number.isFinite(quantity)||quantity<0||!Number.isInteger(quantity))throw Error('Enter a whole number of packs, zero or above.');if(!['add','use','set','edit'].includes(mode))throw Error('Choose a stock action.');const next=mode==='edit'?Number(current||0):mode==='set'?quantity:Number(current||0)+(mode==='use'?-quantity:quantity);if(next<0)throw Error('You cannot use more stock than you have.');return next;}
function apply(data,entries){const next=JSON.parse(JSON.stringify(data));next.catalogue=next.catalogue||{};next.scanTransactions=next.scanTransactions||[];for(const entry of entries){if(next.scanTransactions.includes(entry.token))continue;const p=entry.product,b=barcode(p.barcode);let item=next.items.find(i=>i.barcode===b);const current=adjust(item?.current,entry.quantity,entry.mode);if(item){const expiry=entry.mode==='add'&&item.expiry?[item.expiry,p.expiry].filter(Boolean).sort()[0]:p.expiry;Object.assign(item,p,{id:item.id,current,expiry});}else{item={...p,id:'barcode-'+b,current,optimum:p.optimum??null};next.items.push(item);}next.catalogue[b]={...p};next.scanTransactions.push(entry.token);}return next;}
function totals(items){return items.reduce((t,i)=>{const q=Math.max(0,Number(i.current)||0),p=q*(Number(i.portionsPerPack)||0);t.quantity+=q;t[i.portionType==='meal'?'meals':i.portionType==='side'?'sides':'ingredients']+=p;if(i.packUnit==='g')t.grams+=q*(Number(i.packSize)||0);if(i.packUnit==='ml')t.ml+=q*(Number(i.packSize)||0);return t;},{quantity:0,meals:0,sides:0,ingredients:0,grams:0,ml:0});}
const EXTRA_CATEGORIES=[{id:'drinks',name:'Drinks',type:'other'},{id:'snacks',name:'Snacks',type:'food'},{id:'treats',name:'Treats',type:'food'},{id:'alcohol',name:'Alcohol',type:'other'}];
function migrateCategories(data){if(data.categoryUpdate>=1)return data;for(const category of EXTRA_CATEGORIES){if(!data.categories.some(c=>c.id===category.id||String(c.name).trim().toLowerCase()===category.name.toLowerCase()))data.categories.push({...category});}data.categoryUpdate=1;return data;}
function parseExpiry(value){
 const text=String(value||'').trim();if(!text)return '';
 let y,m,d,match;
 if((match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text))){[,y,m,d]=match;}
 else if((match=/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text))){[,d,m,y]=match;}
 else if((match=/^(\d{2})(\d{2})(\d{4})$/.exec(text))){[,d,m,y]=match;}
 else throw Error('Enter a date as DD/MM/YYYY, for example 25/12/2027, or leave it blank.');
 const date=new Date(Number(y),Number(m)-1,Number(d),12);
 if(Number(y)<1000||date.getFullYear()!==Number(y)||date.getMonth()!==Number(m)-1||date.getDate()!==Number(d))throw Error('That date does not exist. Check the day, month and year.');
 return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function expiryDays(value,today=new Date()){
 let iso;try{iso=parseExpiry(value);}catch{return null;}if(!iso)return null;
 const [y,m,d]=iso.split('-').map(Number);
 return Math.round((Date.UTC(y,m-1,d)-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000);
}
function expiryItems(items,range='30',today=new Date()){
 return items.filter(i=>{if(!(Number(i.current)>0))return false;const days=expiryDays(i.expiry,today);return range==='undated'?days===null:days!==null&&(range==='all'||(range==='expired'?days<0:days<=Number(range)));}).sort((a,b)=>String(a.expiry||'').localeCompare(String(b.expiry||''))||String(a.name).localeCompare(String(b.name)));
}
class ScanGate{constructor(){this.locked=false;}accept(){if(this.locked)return false;this.locked=true;return true;}reset(){this.locked=false;}}
const api={barcode,adjust,apply,totals,ScanGate,migrateCategories,EXTRA_CATEGORIES,parseExpiry,expiryDays,expiryItems};if(typeof module!=='undefined')module.exports=api;else root.InventoryCore=api;
})(typeof window==='undefined'?globalThis:window);
