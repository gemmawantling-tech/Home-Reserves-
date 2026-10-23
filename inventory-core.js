/* Pure inventory operations shared by scanner and tests. */
(function(root){
'use strict';
const Batches=typeof module!=='undefined'?require('./stock-batches.js'):root.StockBatches;
function validCheck(b){let sum=0;for(let i=b.length-2,n=0;i>=0;i--,n++)sum+=Number(b[i])*(n%2?1:3);return (10-sum%10)%10===Number(b.at(-1));}
function expandUPCE(value){const b=String(value).trim();if(!/^[01]\d{7}$/.test(b))throw Error('Invalid UPC-E barcode.');const [ns,a,c,d,e,f,last,check]=b;const body=Number(last)<=2?ns+a+c+last+'0000'+d+e+f:last==='3'?ns+a+c+d+'00000'+e+f:last==='4'?ns+a+c+d+e+'00000'+f:ns+a+c+d+e+f+'0000'+last;const upc=body+check;if(!validCheck(upc))throw Error('UPC-E check digit is invalid.');return '0'+upc;}
function barcode(value){const b=String(value).trim();if(!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(b))throw Error('Enter a valid EAN-8, EAN-13, UPC or GTIN barcode.');if(!validCheck(b)){if(b.length===8){try{return expandUPCE(b);}catch{}}throw Error('Barcode check digit is invalid. Check the numbers and try again.');}return b.length===12?'0'+b:b.length===14&&b[0]==='0'?barcode(b.slice(1)):b;}
function sameBarcode(a,b){try{return barcode(a)===barcode(b);}catch{return false;}}

function adjust(current,quantity,mode){if(!Number.isFinite(quantity)||quantity<0||!Number.isInteger(quantity))throw Error('Enter a whole number of packs, zero or above.');if(!['add','use','set','edit'].includes(mode))throw Error('Choose a stock action.');const next=mode==='edit'?Number(current||0):mode==='set'?quantity:Number(current||0)+(mode==='use'?-quantity:quantity);if(next<0)throw Error('You cannot use more stock than you have.');return next;}
function apply(data,entries){const next=JSON.parse(JSON.stringify(data));next.catalogue=next.catalogue||{};next.scanTransactions=next.scanTransactions||[];for(const entry of entries){if(next.scanTransactions.includes(entry.token))continue;const p=entry.product,b=barcode(p.barcode);let item=next.items.find(i=>sameBarcode(i.barcode,b));adjust(item?.current,entry.quantity,entry.mode);const changed=Batches.change(item||{current:0},entry.quantity,entry.mode,p.expiry||'');if(item)Object.assign(item,p,{current:changed.current,batches:changed.batches,expiry:changed.expiry,id:item.id});else{item={...p,...changed,id:'barcode-'+b,optimum:p.optimum??null};next.items.push(item);}next.catalogue[b]={...item};next.scanTransactions.push(entry.token);}return next;}
function totals(items){return items.reduce((t,i)=>{const q=Math.max(0,Number(i.current)||0),p=q*(Number(i.portionsPerPack)||0);t.quantity+=q;t[i.portionType==='meal'?'meals':i.portionType==='side'?'sides':'ingredients']+=p;if(i.packUnit==='g')t.grams+=q*(Number(i.packSize)||0);if(i.packUnit==='ml')t.ml+=q*(Number(i.packSize)||0);return t;},{quantity:0,meals:0,sides:0,ingredients:0,grams:0,ml:0});}
const EXTRA_CATEGORIES=[{id:'drinks',name:'Drinks',type:'other'},{id:'snacks',name:'Snacks',type:'food'},{id:'treats',name:'Treats',type:'food'},{id:'alcohol',name:'Alcohol',type:'other'}];
const FOOD_CATEGORIES=[{id:'cooking-sauces',name:'Cooking sauces',type:'food'},{id:'sauces',name:'Sauces & condiments',type:'food'},{id:'carbohydrates',name:'Carbohydrates',type:'food'},{id:'vegetables',name:'Vegetables',type:'food'},{id:'proteins',name:'Proteins',type:'food'},{id:'legumes',name:'Legumes & pulses',type:'food'},{id:'ready-meals',name:'Ready meals',type:'food'},{id:'fruit',name:'Fruit',type:'food'},{id:'dairy',name:'Dairy & alternatives',type:'food'},{id:'baking',name:'Baking ingredients',type:'food'},{id:'oils',name:'Oils & fats',type:'food'}];
const MAIN_GROUPS=[{id:'food',name:'Food'},{id:'drinks',name:'Drinks'},{id:'health',name:'Health & hygiene'},{id:'power',name:'Power & equipment'},{id:'safety',name:'Safety & travel'},{id:'other',name:'Other supplies'}].sort((a,b)=>a.name.localeCompare(b.name,'en-GB',{sensitivity:'base',numeric:true}));
function categoryGroup(c){
 if(!c)return 'other';
 if(MAIN_GROUPS.some(g=>g.id===c.mainGroup))return c.mainGroup;
 if(c.type==='food')return 'food';
 const name=String(c.name||'').toLowerCase(),id=String(c.id||'');
 if(c.type==='water'||['drinks','alcohol'].includes(id)||/\b(drinks?|beverages?|alcohol|water|tea|coffee)\b/.test(name))return 'drinks';
 if(['firstaid','hygiene'].includes(id)||/first[ -]?aid|hygiene|health|medic|toiletr|sanitat|cleaning|dental|personal care/.test(name))return 'health';
 if(id==='power'||/power|lighting|batteries|fuel|cooking|cookware|camping stove|equipment|tools/.test(name))return 'power';
 if(['safety','car'].includes(id)||/safety|warmth|travel|vehicle|transport|car supplies/.test(name))return 'safety';
 return 'other';
}
function categoryName(c){return c.id==='drinks'&&String(c.name).toLowerCase()==='drinks'?'Other drinks':c.name;}
function generalFood(c){return c?.type==='food'&&String(c.name).trim().toLowerCase()==='food'&&categoryGroup(c)==='food';}
function alphabetical(a,b){return String(a).localeCompare(String(b),'en-GB',{sensitivity:'base',numeric:true});}
function categoryLabel(c){const parent=MAIN_GROUPS.find(g=>g.id===categoryGroup(c));return generalFood(c)?parent.name:parent.name+' / '+categoryName(c);}
function sortedCategories(categories){return categories.slice().sort((a,b)=>alphabetical(categoryLabel(a),categoryLabel(b)));}

function migrateCategories(data){
 const add=rows=>{for(const category of rows){if(!data.categories.some(c=>c.id===category.id||String(c.name).trim().toLowerCase()===category.name.toLowerCase()))data.categories.push({...category});}};
 if(!(data.categoryUpdate>=1)){add(EXTRA_CATEGORIES);data.categoryUpdate=1;}
 if(!(data.foodCategoryUpdate>=1)){add(FOOD_CATEGORIES);data.foodCategoryUpdate=1;}
 if(!(data.foodHierarchyUpdate>=1)){add(FOOD_CATEGORIES.filter(c=>c.id==='cooking-sauces'));data.foodHierarchyUpdate=1;}
 if(!(data.kitCategoryUpdate>=1)){let kit=data.categories.find(c=>c.id==='firstaid'||/^first[ -]?aid$/i.test(c.name));if(!kit)data.categories.push({id:'firstaid',name:'Family first-aid kit',type:'other'});else if(/^first[ -]?aid$/i.test(kit.name))kit.name='Family first-aid kit';data.kitCategoryUpdate=1;}
 if(!(data.mainGroupUpdate>=1)){if(!data.categories.some(c=>c.id==='cooking-equipment'||/cooking equipment|cookware/i.test(c.name)))data.categories.push({id:'cooking-equipment',name:'Cooking equipment',type:'other',mainGroup:'power'});data.mainGroupUpdate=1;}
 return data;
}
// Suggestions are reviewed by the user; category names do not imply complete meals.
function suggestFoodCategory(item,categories){
 const name=String(item.name||'').toLowerCase();
 const rules=[['ready-meals',/\b(ready meal|ready meals|lasagne|lasagna|ravioli|canned chilli|chilli con carne|tinned curry)\b/],['cooking-sauces',/\b(pasta sauce|curry sauce|cooking sauce|stir[ -]?fry sauce|bolognese sauce|tomato sauce|white sauce|cheese sauce|tikka masala sauce|korma sauce)\b/],['sauces',/\b(sauce|sauces|ketchup|mayonnaise|mustard|chutney|pesto|gravy|stock cubes?|vinegar|soy sauce)\b/],['legumes',/\b(beans?|lentils?|chickpeas?|pulses|split peas|hummus)\b/],['baking',/\b(flour|baking powder|baking soda|yeast|icing sugar|caster sugar|cornflour)\b/],['oils',/\b(olive oil|sunflower oil|vegetable oil|rapeseed oil|butter|margarine|ghee)\b/],['dairy',/\b(milk|cheese|yoghurt|yogurt|cream|oat drink|soya drink)\b/],['proteins',/\b(tuna|salmon|sardines|mackerel|chicken|beef|pork|turkey|eggs?|tofu|tempeh|corned beef)\b/],['vegetables',/\b(tomatoes|passata|carrots?|sweetcorn|peas|spinach|broccoli|mushrooms?|green beans)\b/],['fruit',/\b(peaches|pears|pineapple|apples?|raisins|sultanas|apricots|fruit)\b/],['carbohydrates',/\b(rice|pasta|spaghetti|noodles?|couscous|quinoa|oats|porridge|cereal|bread|flatbreads?|potatoes|crackers)\b/]];
 const match=/\bgreen beans\b/.test(name)?rules.find(([id])=>id==='vegetables'):rules.find(([,pattern])=>pattern.test(name));if(!match)return null;
 const template=FOOD_CATEGORIES.find(c=>c.id===match[0]);
 return categories.find(c=>c.type==='food'&&(c.id===template.id||String(c.name).trim().toLowerCase()===template.name.toLowerCase()))?.id||null;
}

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
 const expanded=items.flatMap(i=>Array.isArray(i.batches)?Batches.read(i).map((batch,index)=>({...i,productCurrent:i.current,current:batch.quantity,expiry:batch.expiry,batchEntry:true,batchIndex:index})):i);
 return expanded.filter(i=>{if(!(Number(i.current)>0))return false;const days=expiryDays(i.expiry,today);return range==='undated'?days===null:days!==null&&(range==='all'||(range==='expired'?days<0:days<=Number(range)));}).sort((a,b)=>String(a.expiry||'').localeCompare(String(b.expiry||''))||String(a.name).localeCompare(String(b.name)));
}
class ScanGate{constructor(){this.locked=false;}accept(){if(this.locked)return false;this.locked=true;return true;}reset(){this.locked=false;}}
const api={barcode,expandUPCE,sameBarcode,adjust,apply,totals,ScanGate,MAIN_GROUPS,categoryGroup,categoryLabel,categoryName,generalFood,alphabetical,sortedCategories,migrateCategories,EXTRA_CATEGORIES,FOOD_CATEGORIES,suggestFoodCategory,parseExpiry,expiryDays,expiryItems};if(typeof module!=='undefined')module.exports=api;else root.InventoryCore=api;
})(typeof window==='undefined'?globalThis:window);
