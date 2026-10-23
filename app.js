/* Home Reserves — all data stored locally on this browser; no backend. */
'use strict';
const STORAGE_KEY = 'home_reserves_inventory_v1';
const INITIAL_CATEGORIES = [
  {id:'food',name:'Food',type:'food'},
  {id:'water',name:'Water',type:'water'},
  {id:'power',name:'Power & lighting',type:'other'},
  {id:'firstaid',name:'Family first-aid kit',type:'other'},
  {id:'hygiene',name:'Hygiene',type:'other'},
  {id:'safety',name:'Safety & warmth',type:'other'},
  {id:'car',name:'Car & travel',type:'other'}
];
// Names only: no quantities are presumed to be accurate.
const STARTER_ITEMS = [
  ['food','Pasta','pack'],['food','Dry rice','pack'],['food','Microwave rice','pouch'],
  ['food','Pasta sauce','jar'],['food','Passata','carton'],['food','Chopped tomatoes','tin'],
  ['food','Black beans','tin'],['food','Kidney beans','tin'],['food','Baked beans','tin'],
  ['food','Lentils','pack'],['food','Soup','tin'],['food','Oat milk','carton'],
  ['food','Peanut butter','jar'],['food','Cereal bars','bar'],['food','Oats','pack'],
  ['food','Noodles','pack'],['food','Ready-to-eat meal sachets','pouch'],
  ['food','Roasted peppers','jar'],['food','Sweetcorn','tin'],['food','Peas','tin'],
  ['food','Chilli kidney beans','jar'],['food','Coffee','pack'],
  ['food','Olive oil','bottle'],['food','Soy sauce','bottle'],
  ['water','Bottled water (5 L)','bottle',5],['water','Bottled water (2 L)','bottle',2],
  ['power','Power banks','unit'],['power','Lanterns','unit'],['power','Torches','unit'],
  ['power','Head torch','unit'],['power','Wind-up radio','unit'],
  ['firstaid','First aid kits','kit'],['firstaid','Oral rehydration sachets','sachet'],
  ['firstaid','Eyewash','bottle'],['hygiene','Antibacterial hand gel','bottle'],
  ['hygiene','Wipes','pack'],['safety','Fire blanket','unit'],
  ['safety','Water-mist extinguisher','unit'],['safety','Warm blankets','unit'],
  ['car','Car emergency bag','bag']
];
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = value => Number(value).toLocaleString('en-GB',{maximumFractionDigits:2});
const uid = () => 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const newData = () => ({version:1,categories:JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),items:[],recipes:[],settings:{people:4,waterPerPerson:3}});
let state, activeTab = 'overview', categoryFilter = 'all', statusFilter = 'all', query = '', message = '', locationFilter='all', expiryRange='30';
function validData(d){
  if (!d || !Array.isArray(d.categories) || !Array.isArray(d.items) || !Array.isArray(d.recipes) || (!d.settings || typeof d.settings !== 'object' || Array.isArray(d.settings))) throw Error('Not a valid Home Reserves backup');
  if (d.items.length > 20000 || d.categories.length > 500 || d.recipes.length > 2000) throw Error('Backup too large');
  ProductGroups.validate(d);ShoppingList.validate(d);return RecipeBook.initialise(InventoryCore.migrateCategories(d));
}
let savedInventory=null,startupRecoveryNeeded=false;
try {savedInventory=localStorage.getItem(STORAGE_KEY);state=validData(JSON.parse(savedInventory));}catch{state=validData(newData());if(savedInventory){startupRecoveryNeeded=true;message='Your saved records could not be read. Open Settings → Backups & recovery before adding new items. Existing recovery copies have been kept.';}}
const cat = id => state.categories.find(c => c.id === id);
const itemById = id => state.items.find(i => i.id === id);
const listed = i => i.current !== null && i.current !== undefined && i.current !== '';
const targeted = i => i.optimum !== null && i.optimum !== undefined && i.optimum !== '';
const amount = i => listed(i) && Number.isFinite(Number(i.current)) ? Math.max(0,Number(i.current)) : 0;
const low = i => listed(i) && targeted(i) && amount(i) < Number(i.optimum);
const foodItems = () => state.items.filter(i => cat(i.category)?.type === 'food');
const setting = (name,fallback) => Number(state.settings[name]) > 0 ? Number(state.settings[name]) : fallback;
function daysToExpiry(i){return InventoryCore.expiryDays(i.expiry);}
const expiresSoon = i => amount(i)>0 && daysToExpiry(i) !== null && daysToExpiry(i) <= 30;
const waterLitres = () => state.items.filter(i=>cat(i.category)?.type==='water').reduce((sum,i)=>sum+amount(i)*Math.max(0,Number(i.litresPerUnit)||0),0);
function storeInventory(data,{replaceUnreadable=false}={}){if(startupRecoveryNeeded&&!replaceUnreadable)throw Error('Saved records need recovery. Restore or import a backup before saving changes.');const checks=data.shoppingChecks?ShoppingList.currentChecks(data):null,saved=checks?{...data,shoppingChecks:checks}:data;localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));if(checks)data.shoppingChecks=checks;startupRecoveryNeeded=false;BackupStore.schedule(saved);}
function persist(){
  try{storeInventory(state);message='';}
  catch{message='Could not save to browser storage. Please export a backup.';}
  render();
}
function notify(note){message=note;render();window.scrollTo({top:0,behavior:'smooth'});}
function numberOrNull(value){
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
}
function stockStatus(i){return !listed(i)?'uncounted':low(i)?'low':!targeted(i)?'notarget':'ok';}
function field(name,label,value='',extra=''){
  return '<div class="field"><label for="f_'+name+'">'+label+'</label><input id="f_'+name+'" name="'+name+'" value="'+escapeHTML(value)+'" '+extra+'></div>';
}
function displayDate(value){try{const iso=InventoryCore.parseExpiry(value);return iso?iso.split('-').reverse().join('/'):'';}catch{return String(value||'');}}
function expiryField(value=''){return field('expiry','Use-by / best-before date (optional)',displayDate(value),'type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="DD/MM/YYYY"')+'<p class="hint">Type DD/MM/YYYY or 8 digits (25122027). Leave blank if unknown. Add stock with its own date; use Manage batches to correct existing dates.</p>';}
function dropdown(name,label,options,selected){
  return '<div class="field"><label for="f_'+name+'">'+label+'</label><select id="f_'+name+'" name="'+name+'">'+options.map(([id,text])=>'<option value="'+escapeHTML(id)+'" '+(id===selected?'selected':'')+'>'+escapeHTML(name==='category'&&cat(id)?InventoryCore.categoryLabel(cat(id)):text)+'</option>').join('')+'</select></div>';
}
function formActions(kind,id){
  return '<div class="modal-actions">'+(id?'<button type="button" class="danger" data-action="delete'+kind+'" data-id="'+escapeHTML(id)+'">Delete</button>':'')+'<button type="button" data-action="close">Cancel</button><button type="submit" class="primary">Save</button></div>';
}
function editDialog(markup){$('editorBody').innerHTML=markup;$('editor').showModal();}
function closeDialog(){window.stopScanning?.();$('editor').close();}
function entryDefaults(){
 const queued=typeof stockQueue!=='undefined'?stockQueue.at(-1)?.product:null;
 const saved=queued||state.entryDefaults||{};
 return {category:cat(categoryFilter)?categoryFilter:cat(saved.category)?saved.category:state.categories.find(c=>c.type==='food')?.id||state.categories[0]?.id,location:saved.location??'Pantry'};
}
function portionReviewNote(category,portions){return cat(category)?.type==='food'&&!(Number(portions)>0)?'<p class="hint portion-review">Portions not set. You can save now and review them later; food days use calories, not portion counts.</p>':'';}
function editItem(id){
 const i=id?itemById(id):null;
 if(!state.categories.length){notify('Create a category before adding stock.');showTab('settings');return;}
 const defaults=entryDefaults(),category=i?.category||defaults.category;
 editDialog('<h2>'+(i?'Edit item':'Add item')+'</h2><form id="itemForm" class="quick-entry" data-id="'+escapeHTML(i?.id||'')+'">'+
  field('name','Item name',i?.name||'','required maxlength="120" placeholder="e.g. Lentils"')+
  field('current','Quantity on hand ('+escapeHTML(i?.unit||'packs')+')',i?i.current??'':1,'type="number" min="0" step="any" placeholder="Not counted"')+
  field('portionsPerPack','Portions per pack (optional)',i?.portionsPerPack??'','type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 2"')+
  '<div class="split">'+dropdown('category','Category',InventoryCore.sortedCategories(state.categories).map(c=>[c.id,c.name]),category)+field('location','Storage location',i?i.location||'':defaults.location,'maxlength="90" placeholder="Pantry"')+'</div>'+
  (i&&StockBatches.read(i).length>1?'<input type="hidden" name="expiry" value="'+escapeHTML(i.expiry||'')+'"><p class="hint">Multiple expiry dates: use Manage batches to edit them.</p><button type="button" data-action="manageBatches" data-id="'+escapeHTML(i.id)+'">Manage batches</button>':expiryField(i?.expiry))+portionReviewNote(category,i?.portionsPerPack)+formActions('Item',i?.id).replace('modal-actions','modal-actions entry-actions')+
  '<details class="entry-section" id="itemPortions"><summary>Portions and pack size</summary><div class="split">'+field('packSize','Weight / volume per pack',i?.packSize??'','type="number" min="0" step="any"')+dropdown('packUnit','Pack unit',[['g','grams'],['ml','millilitres']],i?.packUnit||'g')+'</div>'+
  field('unit','Counted in',i?.unit||'packs','required maxlength="32" placeholder="packs / tins / bottles"')+
  '<div>'+dropdown('portionType','These portions are',[['ingredient','Ingredient portions'],['side','Side portions'],['meal','Complete meal portions']],i?.portionType||'ingredient')+'</div>'+
  portionEstimateControl(i||{})+
  (i?.portionSource?'<p class="hint">Portions: '+escapeHTML(i.portionSource)+'. Change the count to replace it with your own value.</p>':'')+
  field('litresPerUnit','Litres per item (for drinking water)',i?.litresPerUnit??'','type="number" min="0" step="any"')+'<p class="hint">Ingredient and side portions are not complete meals. Leave unknown sizes and portions blank.</p></details>'+
  productDetailsFields(i||{})+
  '<details class="entry-section"><summary>Stock targets and notes</summary>'+field('optimum','Your stock target',i?.optimum??'','type="number" min="0" step="any" placeholder="Optional"')+
  '<div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes" rows="2" maxlength="300">'+escapeHTML(i?.notes||'')+'</textarea></div></details>'+
  (i?.barcode?'<details class="entry-section"><summary>Product details and nutrition</summary><p class="hint">Barcode: '+escapeHTML(i.barcode)+'</p><button type="button" data-action="productEdit" data-id="'+escapeHTML(i.id)+'">Edit product details</button></details>':'')+'</form>');
}
function editCategory(id){
  const c=id?cat(id):null;
  editDialog('<h2>'+(c?'Edit category':'New category')+'</h2><form id="categoryForm" data-id="'+escapeHTML(c?.id||'')+'">'+
    field('name','Category name',c?.name||'','required maxlength="90" placeholder="e.g. Pet supplies"')+
    dropdown('type','Category used for',[['other','General supplies'],['food','Recipe ingredients'],['water','Drinking water']],c?.type||'other')+
    dropdown('mainGroup','Show under main group',[['','Automatic grouping'],...InventoryCore.MAIN_GROUPS.map(g=>[g.id,g.name])],c?.mainGroup||'')+
    '<p class="hint">Main groups organise your Pantry. Category use determines food and water calculations. Food categories are available for recipe ingredient links. Water categories contribute to the water estimate.</p>'+formActions('Category',c?.id)+'</form>');
}
function stat(value,label){return '<div class="stat"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>';}
function stats(){
  const counted=state.items.filter(listed).length,below=state.items.filter(low).length,exp=state.items.filter(expiresSoon).length;
  return '<div class="stat-grid">'+stat(fmt(counted)+'<span class="small muted"> / '+fmt(state.items.length)+'</span>','Item types counted')+stat(fmt(below),'Below your target')+stat(fmt(exp),'Expiring or expired')+stat(fmt(state.items.filter(i=>FoodCoverage.eligible(i,state)&&amount(i)>0).length),'Food types in stock')+'</div>';
}
function backupStatus(){return backupPanel();}
function overview(){
  const people=setting('people',4),water=waterLitres(),waterDays=water/(people*setting('waterPerPerson',3));
  const below=state.items.filter(low).sort((a,b)=>a.name.localeCompare(b.name));
  const due=InventoryCore.expiryItems(state.items,30);
  const food=FoodCoverage.assess(state);
  return '<div class="overview-summary" role="group" aria-label="Reserve summary"><button data-action="overviewFood"><strong>'+fmt(food.packs)+'</strong><span>Food packs / units</span></button><button data-action="overviewWater"><strong>'+(water>0?fmt(waterDays):'—')+'</strong><span>Days of water</span></button><button data-tab="expiry"><strong>'+due.length+'</strong><span>Due / overdue · 30 days</span></button><button data-action="reviewGaps"><strong>'+below.length+'</strong><span>Below your target</span></button></div>'+shoppingShortcut()+foodCoverageCard()+
  '<section class="card" id="waterCoverage"><h2>Water coverage</h2><div class="large-number">'+(water>0?fmt(waterDays):'—')+'</div><p class="small muted">Water days · '+fmt(water)+' litres logged</p><p class="hint">Based on '+fmt(people)+' people and '+fmt(setting('waterPerPerson',3))+' litres per person daily for drinking and basic cooking. Does not cover washing.</p></section>'+
  '<section class="card"><div class="section-title"><h2>Expiring products</h2><button class="text-button" data-tab="expiry">View all →</button></div><p class="small">'+due.length+' batches / items due or overdue within 30 days</p>'+due.slice(0,3).map(i=>'<div class="row-line"><strong>'+escapeHTML(i.name)+'</strong><span class="small">'+escapeHTML(displayDate(i.expiry))+'</span></div>').join('')+(!due.length?'<p class="hint">No recorded dates due in the next 30 days.</p>':'')+'</section>'+gapsSummary()+backupReminder()+
  '<section class="card"><div class="section-title"><h2>Below your target</h2><button class="text-button" data-tab="inventory">All stock →</button></div>'+
  (below.length?below.slice(0,7).map(i=>'<div class="row-line"><span>'+escapeHTML(i.name)+'</span><span class="small nowrap">'+fmt(i.current)+' / '+fmt(i.optimum)+' '+escapeHTML(i.unit)+'</span></div>').join(''):'<div class="empty">Nothing currently recorded below its target.</div>')+
  (below.length>7?'<p class="hint">Plus '+(below.length-7)+' more items.</p>':'')+'</section>'+
  stats()+(!state.items.length?'<section class="card"><h2>Start your inventory</h2><p class="small muted">Add the items you already have, or load a starter list and fill in quantities as you do a stock check.</p><div class="actions"><button data-action="starter">Load starter list</button></div></section>':'');
}
function itemCard(i){
  const c=cat(i.category),expiry=daysToExpiry(i),below=i.batchEntry?low({...i,current:i.productCurrent}):low(i),max=targeted(i)?Number(i.optimum):0;
  let badges='<span class="badge">'+escapeHTML(c?.name||'Other')+'</span>';
  if(cat(i.category)?.type==='food'&&!(Number(i.portionsPerPack)>0))badges+='<span class="badge">Portions to review</span>';
  if(!listed(i))badges+='<span class="badge low">Not yet counted</span>';
  else if(below)badges+='<span class="badge low">Below your target</span>';
  else if(!targeted(i))badges+='<span class="badge">No target</span>';
  if(expiry!==null&&expiry<=30)badges+='<span class="badge red">'+(expiry<0?'Expired':expiry===0?'Expires today':'Expires in '+expiry+' days')+'</span>';
  return '<article class="item"><div class="item-header"><div><div class="item-title">'+escapeHTML(i.name)+'</div>'+badges+'</div><button class="text-button" data-action="editItem" data-id="'+escapeHTML(i.id)+'">Edit</button></div>'+
    (!i.batchEntry&&listed(i)&&max>0?'<div class="meter '+(below?'low':'')+'"><span style="width:'+Math.min(100,amount(i)*100/max)+'%"></span></div>':'')+
    ((i.brand||i.flavour||i.purchasePrice!==null&&i.purchasePrice!==undefined)?'<p class="hint variety-meta">'+[i.brand,i.flavour,i.purchasePrice!==null&&i.purchasePrice!==undefined?'£'+fmt(i.purchasePrice)+' per '+i.unit:''].filter(Boolean).map(escapeHTML).join(' · ')+'</p>':'')+
    '<div class="item-bottom"><div class="counts">Current: <strong>'+(listed(i)?fmt(i.current):'—')+'</strong> '+escapeHTML(i.unit)+'<br>Your target: <strong>'+(targeted(i)?fmt(i.optimum):'Not set')+'</strong> '+escapeHTML(i.unit)+
    (i.portionsPerPack?'<br>'+fmt(amount(i)*i.portionsPerPack)+' '+escapeHTML(i.portionType||'ingredient')+' portions'+(['estimated','calculated'].includes(i.portionSource)?' (estimate)':''):'')+(i.location?'<br>📍 '+escapeHTML(i.location):'')+(i.expiry?'<br>Use-by / best-before: '+escapeHTML(displayDate(i.expiry)):'')+(i.notes?'<br>'+escapeHTML(i.notes):'')+'</div>'+
    (i.batchEntry?'<span class="hint">Batch quantity · product total '+fmt(i.productCurrent)+' '+escapeHTML(i.unit)+'</span>':'<div class="stepper"><button type="button" data-action="minus" data-id="'+escapeHTML(i.id)+'" aria-label="Use one '+escapeHTML(i.name)+'" '+(!listed(i)||amount(i)<=0?'disabled':'')+'>−</button><strong>'+(listed(i)?fmt(i.current):'—')+'</strong><button type="button" data-action="plus" data-id="'+escapeHTML(i.id)+'" aria-label="Add one '+escapeHTML(i.name)+'">+</button></div>')+'</div>'+batchSummary(i)+'</article>';
}
const pantrySectionState=new Map();
let showEmptyCategories=false;
function pantryViewKey(id){return JSON.stringify([categoryFilter,statusFilter,locationFilter,query,id]);}
function pantryGroups(items){
 const groups=new Map();
 for(const c of state.categories)groups.set(c.id,{id:c.id,name:c.name,type:c.type,mainGroup:InventoryCore.categoryGroup(c),items:[]});
 for(const item of items){const id=item.category||'';if(!groups.has(id))groups.set(id,{id,name:'Uncategorised',items:[]});groups.get(id).items.push(item);}
 const filtering=categoryFilter!=='all'||statusFilter!=='all'||locationFilter!=='all'||query.trim()!=='';
 const kitId=familyKitCategoryId(),kitRows=familyKitPantryRows();
 const isOpen=id=>pantrySectionState.get(pantryViewKey(id))||false;
 const draw=g=>{
  const kit=g.id===kitId?kitRows:[],below=g.items.filter(low).length+kit.filter(r=>low({...r,optimum:r.target})).length,expiring=g.items.filter(expiresSoon).length+kit.filter(expiresSoon).length;
  const title=InventoryCore.categoryName(g);
  return '<details class="pantry-group pantry-accordion" data-accordion="sub:'+escapeHTML(g.mainGroup||'other')+'" name="sub:'+escapeHTML(g.mainGroup||'other')+'" data-category="'+escapeHTML(g.id)+'" data-view="'+escapeHTML(pantryViewKey(g.id))+'" '+(isOpen(g.id)?'open':'')+'><summary><span class="group-title">'+escapeHTML(title)+'</span><span class="group-count">'+(g.items.length?g.items.length+' item type'+(g.items.length===1?'':'s'):'')+(kit.length?(g.items.length?' · ':'')+kit.length+' checklist entries':'')+(!g.items.length&&!kit.length?'Empty':'')+'</span>'+(below?'<span class="badge low">'+below+' below your target</span>':'')+(expiring?'<span class="badge red">'+expiring+' due / overdue</span>':'')+'</summary><div class="items-grid">'+productGroupContent(g.items,g.id)+(!g.items.length&&!kit.length?'<p class="hint">No items in this group yet.</p>':'')+'</div>'+(kit.length?familyKitPantryContent(kit):'')+'</details>';
 };
 return InventoryCore.MAIN_GROUPS.map(parent=>{
  const members=[...groups.values()].filter(g=>(g.mainGroup||'other')===parent.id&&((showEmptyCategories&&!filtering)||g.items.length||(g.id===kitId&&kitRows.length))),direct=members.filter(InventoryCore.generalFood).flatMap(g=>g.items),children=members.filter(g=>!InventoryCore.generalFood(g)).sort((a,b)=>InventoryCore.alphabetical(InventoryCore.categoryName(a),InventoryCore.categoryName(b)));
  if(!members.length)return '';
  const shown=members.flatMap(g=>g.items),kit=children.some(g=>g.id===kitId)?kitRows:[],rootId='__'+parent.id+'-root',below=shown.filter(low).length+kit.filter(r=>low({...r,optimum:r.target})).length,expiring=shown.filter(expiresSoon).length+kit.filter(expiresSoon).length;
  return '<details data-accordion="main" name="pantry-main" class="pantry-group pantry-accordion group-parent '+(parent.id==='food'?'food-parent':'')+'" data-category="'+rootId+'" data-view="'+escapeHTML(pantryViewKey(rootId))+'" '+(isOpen(rootId)?'open':'')+'><summary><span class="group-title">'+escapeHTML(parent.name)+'</span><span class="group-count">'+shown.length+' item types · '+children.length+' subcategories'+(kit.length?' · '+kit.length+' checklist entries':'')+'</span>'+(below?'<span class="badge low">'+below+' below your target</span>':'')+(expiring?'<span class="badge red">'+expiring+' due / overdue</span>':'')+'</summary><div class="food-subcategories">'+children.map(draw).join('')+'</div>'+(direct.length?'<div class="items-grid food-direct">'+productGroupContent(direct,'general-food')+'</div>':'')+'</details>';
 }).join('');
}
function closePantrySection(group){group.open=false;pantrySectionState.set(group.dataset.view,false);group.querySelectorAll('details.pantry-accordion').forEach(child=>{child.open=false;pantrySectionState.set(child.dataset.view,false);});}
function openPantrySection(group){document.querySelectorAll('details.pantry-accordion').forEach(other=>{if(other!==group&&other.dataset.accordion===group.dataset.accordion)closePantrySection(other);});group.open=true;pantrySectionState.set(group.dataset.view,true);}
document.addEventListener('click',e=>{const summary=e.target.closest('summary');if(!summary||!summary.parentElement.matches('details.pantry-accordion'))return;e.preventDefault();const group=summary.parentElement;if(group.open)closePantrySection(group);else openPantrySection(group);});
document.addEventListener('toggle',e=>{const group=e.target;if(!group.matches?.('details.pantry-accordion')||!group.isConnected)return;if(group.open)openPantrySection(group);else closePantrySection(group);},true);
function setPantrySections(open){document.querySelectorAll('details.pantry-accordion').forEach(closePantrySection);if(!open)return;let group=document.querySelector('#screen > .group-parent');while(group){openPantrySection(group);group=group.querySelector(':scope > .food-subcategories > .pantry-group, :scope > .items-grid > .product-group');}}
function inventory(){
  const locations=[...new Set(state.items.map(i=>String(i.location||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const filtered=state.items.filter(i=>(!ungroupedOnly||!ProductGroups.groupFor(i,state))&&(categoryFilter==='all'||(categoryFilter.startsWith('all-')&&InventoryCore.categoryGroup(cat(i.category))===categoryFilter.slice(4))||i.category===categoryFilter)&&(locationFilter==='all'||String(i.location||'').trim()===locationFilter)&&
    (statusFilter==='all'||(statusFilter==='low'&&low(i))||(statusFilter==='uncounted'&&!listed(i))||(statusFilter==='notarget'&&!targeted(i))||(statusFilter==='expiry'&&expiresSoon(i)))&&
    (i.name+' '+(i.brand||'')+' '+(i.flavour||'')+' '+(ProductGroups.groupFor(i,state)?.name||'')+' '+(i.location||'')+' '+(i.notes||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(low(b))-Number(low(a))||a.name.localeCompare(b.name));
  return '<section class="card"><div class="section-title"><h2>Pantry & household stock</h2><button data-action="reviewAllProducts">Group similar items</button><details class="pantry-tools"><summary>Pantry tools</summary><div class="actions"><button data-action="organiseFood">Organise food</button><button data-action="newCategory">+ Category</button><button data-action="shoppingList">Shopping list</button><button data-action="manageProductGroups">Product groups</button><button data-action="expandPantry">Open first section</button><button data-action="collapsePantry">Collapse all</button><label class="check-label"><input type="checkbox" id="ungroupedOnly" '+(ungroupedOnly?'checked':'')+'> Ungrouped items only</label><label class="check-label"><input type="checkbox" id="showEmptyCategories" '+(showEmptyCategories?'checked':'')+'> Show empty categories</label></div></details></div>'+
    (groupReviewNotice?'<p role="status">'+escapeHTML(groupReviewNotice)+'</p>':'')+'<div class="filter-grid"><input id="filterSearch" class="search" aria-label="Search stock" placeholder="Search items or locations" value="'+escapeHTML(query)+'">'+
    '<select id="filterCategory" aria-label="Select category"><option value="all">All categories</option>'+InventoryCore.MAIN_GROUPS.map(g=>'<option value="all-'+g.id+'" '+(categoryFilter==='all-'+g.id?'selected':'')+'>'+escapeHTML(g.name)+' — all subcategories</option>').join('')+InventoryCore.sortedCategories(state.categories).map(c=>'<option value="'+escapeHTML(c.id)+'" '+(categoryFilter===c.id?'selected':'')+'>'+escapeHTML(InventoryCore.categoryLabel(c))+'</option>').join('')+'</select>'+
    '<select id="filterStatus" aria-label="Select status">'+[['all','All levels'],['low','Below your target'],['uncounted','Not counted'],['notarget','No target set'],['expiry','Expiring soon']].map(([v,l])=>'<option value="'+v+'" '+(statusFilter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
    '<label for="filterLocation">Storage location</label><select id="filterLocation"><option value="all">All locations</option>'+locations.map(location=>'<option value="'+escapeHTML(location)+'" '+(locationFilter===location?'selected':'')+'>'+escapeHTML(location)+'</option>').join('')+'</select>'+
    '<p class="hint pantry-count">'+filtered.length+' item types · Open a category to see stock.</p></section>'+
    (filtered.length||familyKitPantryRows().length||(categoryFilter==='all'&&statusFilter==='all'&&locationFilter==='all'&&!query.trim()&&state.categories.some(c=>c.type==='food'))?pantryGroups(filtered):'<section class="card empty">'+(state.items.length?'No items match your filters.':'No inventory yet. Add your first item, or load starter items in Settings.')+'</section>');
}
function expiring(){
 const items=InventoryCore.expiryItems(state.items,expiryRange);
 return '<section class="card hero"><div class="eyebrow">USE FIRST</div><h2>Expiring stock</h2><p class="hint">In-stock batches, earliest date first. Includes every storage location. Used-up and uncounted items are excluded.</p><label for="expiryRange">Show products</label><select id="expiryRange">'+[['7','Overdue and next 7 days'],['30','Overdue and next 30 days'],['90','Overdue and next 90 days'],['expired','Past the recorded date'],['all','All dated stock'],['undated','No valid date recorded']].map(([value,label])=>'<option value="'+value+'" '+(expiryRange===value?'selected':'')+'>'+label+'</option>').join('')+'</select><p role="status">'+items.length+' stock entries</p><p class="hint">Follow the date type printed on the pack. Use-by dates concern safety; best-before dates concern quality. Each expiry batch is shown separately here; Pantry keeps them under one product card.</p></section>'+(items.length?'<div class="items-grid">'+items.map(itemCard).join('')+'</div>':'<section class="card empty">No pantry stock matches this date range.</section>')+firstAidExpiryCards();
}
function settings(){
  return '<section class="card"><h2>Household planning assumptions</h2><form id="settingsForm">'+
    field('people','People',setting('people',4),'required type="number" min="1" max="30" step="1"')+
    field('reserveDays','Food reserve goal in days (optional)',state.settings.reserveDays??'','type="number" min="1" step="1" placeholder="e.g. 7 or 14"')+
    '<button type="button" data-action="energyMembers">Set daily targets for each person</button><p class="hint">'+escapeHTML(EnergyAssessment.requirements(state.settings).source)+' · '+fmt(EnergyAssessment.requirements(state.settings).daily)+' kcal / day. Saving a household override below clears per-person targets; changing household size also requires reviewing them.</p>'+
    field('householdKcal','Household kcal per day (optional override)',state.settings.householdKcal??'','type="number" min="1" step="any" placeholder="Default: 2,000 × people"')+'<p class="hint">Food days use known stock calories divided by this daily total. Leave blank for the provisional 2,000 kcal per person assumption. Needs vary by age, body size and activity; adjust for your household, including children. This is an energy estimate, not a balanced-diet assessment.</p>'+
    field('waterPerPerson','Water litres per person / day',setting('waterPerPerson',3),'required type="number" min="0.1" max="20" step="0.1"')+
    '<p class="hint">The water estimate covers drinking and basic cooking only.</p><button class="primary" type="submit">Save assumptions</button></form></section>'+
    '<section class="card"><div class="section-title"><h2>My categories</h2><button data-action="newCategory">+ Category</button></div>'+InventoryCore.sortedCategories(state.categories).map(c=>'<div class="row-line"><div><strong>'+escapeHTML(c.name)+'</strong><div class="tiny muted">'+escapeHTML(InventoryCore.MAIN_GROUPS.find(g=>g.id===InventoryCore.categoryGroup(c)).name)+' / '+(c.type==='food'?'Food for recipes':c.type==='water'?'Water volumes':'General stock')+' · '+state.items.filter(i=>i.category===c.id).length+' item types</div></div><button class="text-button" data-action="editCategory" data-id="'+escapeHTML(c.id)+'">Edit</button></div>').join('')+'</section>'+
    backupStatus()+'<section class="card"><h2>Starter list and backups</h2><p class="small muted">Load an editable list of common items without inventing quantities. You can add more categories and item types whenever you need.</p>'+
    '<div class="actions"><button data-action="starter">+ Load starter items</button><button data-action="export">Export backup</button><button data-action="csv">Export CSV</button><button data-action="import">Import backup</button></div>'+
    '<input id="importInput" type="file" accept="application/json,.json"><p class="hint">JSON backup includes recipes and settings. CSV is a readable inventory list. Import replaces your current inventory after confirmation.</p></section>'+
    '<section class="card"><h2>Useful limitations</h2><p class="small muted">All counts stay on this browser, not automatically synced to your husband’s phone or GitHub. Products can contain multiple expiry batches. Use Manage batches to split counts by date; quick stock use removes the earliest date first. Preparedness is about practical supplies, not chasing a perfect score.</p></section>';
}
function render(){
  $('message').innerHTML=message?'<div class="message warning">'+escapeHTML(message)+'</div>':'';
  $('screen').innerHTML=activeTab==='groupReview'?productGroupReviewScreen():activeTab==='shopping'?shoppingScreen():activeTab==='productGroups'?productGroupsScreen():activeTab==='foodImprove'?foodAssessmentScreen():activeTab==='foodDetails'?foodCalculationScreen():activeTab==='overview'?overview():activeTab==='inventory'?inventory():activeTab==='expiry'?expiring():activeTab==='recipes'?recipeBookScreen():activeTab==='stocktake'?stocktake():settings();
  document.querySelector('.header [data-action="scan"]').hidden=activeTab==='stocktake';
  document.querySelectorAll('.nav [data-tab]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.tab===(['shopping','productGroups','groupReview'].includes(activeTab)?'inventory':activeTab.startsWith('food')?'overview':activeTab)?'page':'false')));
}
function showTab(t){if(t==='inventory'&&activeTab!=='inventory')pantrySectionState.clear();activeTab=t==='meals'?'recipes':t;render();window.scrollTo({top:0,behavior:'smooth'});}
function downloadFile(name,text,mime){
  const blob=new Blob([text],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);
}
function loadStarters(){
  let count=0;
  for(const [category,name,unit,litres] of STARTER_ITEMS){
    if(state.items.some(i=>i.category===category && i.name.toLowerCase()===name.toLowerCase()))continue;
    state.items.push({id:uid(),name,category,unit,current:null,optimum:null,location:'',expiry:'',notes:'',litresPerUnit:litres||null});count++;
  }
  persist();showTab('inventory');notify(count?count+' starter item types added. Their quantities and targets are blank until you enter them.':'Starter items are already in your inventory.');
}
$('quickAdd').addEventListener('click',()=>editItem());
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.tab){showTab(button.dataset.tab);return;}
  const action=button.dataset.action,id=button.dataset.id;
  switch(action){
    case 'overviewFood':case 'overviewWater':{const section=document.getElementById(action==='overviewFood'?'foodCoverage':'waterCoverage');section.setAttribute('tabindex','-1');section.focus({preventScroll:true});section.scrollIntoView({behavior:'smooth',block:'start'});break;}
    case 'expandPantry':setPantrySections(true);break;
    case 'collapsePantry':setPantrySections(false);break;
    case 'newItem':editItem();break;
    case 'editItem':editItem(id);break;
    case 'newCategory':editCategory();break;
    case 'editCategory':editCategory(id);break;
    case 'close':closeDialog();break;
    case 'plus':case 'minus':{
      const i=itemById(id);if(!i)break;
      Object.assign(i,StockBatches.change(i,Math.min(1,action==='minus'?amount(i):1),action==='plus'?'add':'use',''));persist();break;
    }
    case 'starter':loadStarters();break;
    case 'export':if(startupRecoveryNeeded){notify('Current records cannot be read. Open Settings → View recovery copies to download an existing snapshot.');break;}state.backupRequestedAt=new Date().toISOString();persist();downloadFile('home-reserves-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');break;
    case 'csv':{
      const rows=[['Category','Item','Current','Your target','Unit','Location','Expiry','Litres per item','Notes','Product group','Brand','Flavour','Purchase price per stock unit (£)'],...state.items.map(i=>[cat(i.category)?.name||'',i.name,i.current??'',i.optimum??'',i.unit,i.location||'',i.expiry||'',i.litresPerUnit??'',i.notes||'',ProductGroups.groupFor(i,state)?.name||'',i.brand||'',i.flavour||'',i.purchasePrice??''])];
      const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      downloadFile('home-reserves-inventory.csv','\uFEFF'+csv,'text/csv;charset=utf-8');break;
    }
    case 'import':$('importInput')?.click();break;
    case 'deleteItem':if(confirm('Delete this stock item? Meal recipes using it will need updating.')){state.items=state.items.filter(i=>i.id!==id);persist();closeDialog();}break;
    case 'deleteCategory':if(state.items.some(i=>i.category===id)){alert('Move or delete the items in this category first.');break;}
      if(confirm('Delete this category?')){state.categories=state.categories.filter(c=>c.id!==id);persist();closeDialog();}break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.id!=='filterSearch')return;
  query=e.target.value;const caret=e.target.selectionStart;render();const field=$('filterSearch');field.focus();field.setSelectionRange(caret,caret);
});
document.addEventListener('change',async e=>{
  if(e.target.id==='showEmptyCategories'){showEmptyCategories=e.target.checked;render();document.querySelector('.pantry-tools').open=true;document.getElementById('showEmptyCategories').focus();}
  if(e.target.id==='filterLocation'){locationFilter=e.target.value;render();}
  if(e.target.id==='expiryRange'){expiryRange=e.target.value;render();}
  if(e.target.id==='filterCategory'){categoryFilter=e.target.value;render();}
  if(e.target.id==='filterStatus'){statusFilter=e.target.value;render();}
  if(e.target.id==='importInput'&&e.target.files?.[0]){
    try{
      const d=validData(JSON.parse(await e.target.files[0].text()));
      if(!confirm('Replace your ENTIRE current inventory, categories, recipes, settings and kit checklist with this backup?'))return;
      if(!startupRecoveryNeeded)await BackupStore.safety(state);storeInventory(d,{replaceUnreadable:true});state=d;render();notify('Your backup was imported. Your previous data is kept as a safety copy.');
    }catch(err){notify('Could not import file: '+err.message);}
    finally{if(e.target)e.target.value='';}
  }
});
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!['itemForm','categoryForm','settingsForm'].includes(form.id))return;
  e.preventDefault();const data=new FormData(form),id=form.dataset.id;
  if(form.id==='itemForm'){
    let expiry;try{expiry=InventoryCore.parseExpiry(data.get('expiry'));}catch(err){alert(err.message);return;}
    const name=String(data.get('name')||'').trim(),category=String(data.get('category')),unit=String(data.get('unit')||'').trim();
    if(!name||!unit||!cat(category)){alert('Please provide a name, unit and valid category.');return;}
    let item={...(id?itemById(id):{}),id:id||uid(),name,category,unit,portionsPerPack:numberOrNull(data.get('portionsPerPack')),portionType:String(data.get('portionType')||'ingredient'),current:numberOrNull(data.get('current')),optimum:numberOrNull(data.get('optimum')),location:String(data.get('location')||'').trim(),expiry,litresPerUnit:numberOrNull(data.get('litresPerUnit')),notes:String(data.get('notes')||'').trim()};
    try{readProductDetails(form,item);}catch(err){alert(err.message);return;}
    item=StockBatches.reconcile(id?itemById(id):null,item);item.packSize=numberOrNull(data.get('packSize'));item.packUnit=String(data.get('packUnit')||'g');state.entryDefaults={category:item.category,location:item.location};
    if(!id||item.portionsPerPack!==itemById(id)?.portionsPerPack)item.portionSource='manual';applyPortionPlanning(form,item);if(id){const at=state.items.findIndex(i=>i.id===id);if(at<0)return;state.items[at]=item;}else state.items.push(item);if(item.barcode){state.catalogue=state.catalogue||{};for(const key of Object.keys(state.catalogue))if(InventoryCore.sameBarcode(state.catalogue[key]?.barcode||key,item.barcode))state.catalogue[key]={...state.catalogue[key],...item};state.catalogue[item.barcode]={...(state.catalogue[item.barcode]||{}),...item};}
  }else if(form.id==='categoryForm'){
    const name=String(data.get('name')||'').trim(),type=String(data.get('type')),mainGroup=String(data.get('mainGroup')||'');
    if(!name||!['food','water','other'].includes(type)){alert('Enter a valid category.');return;}
    if(id){const c=cat(id);if(!c)return;c.name=name;c.type=type;c.mainGroup=mainGroup;}else state.categories.push({id:uid(),name,type,mainGroup});
  }else if(form.id==='settingsForm'){
    const people=Number(data.get('people')),waterPerPerson=Number(data.get('waterPerPerson'));
    if(!Number.isInteger(people)||people<1||!(waterPerPerson>0)){alert('Enter valid household figures.');return;}
    if(people!==Number(state.settings.people)||numberOrNull(data.get('householdKcal'))!==numberOrNull(state.settings.householdKcal))delete state.settings.energyMembers;
    state.settings={...state.settings,people,waterPerPerson,reserveDays:numberOrNull(data.get('reserveDays')),householdKcal:numberOrNull(data.get('householdKcal'))};
  }
  persist();if($('editor').open)closeDialog();
});
$('editor').addEventListener('click',e=>{if(e.target===$('editor'))closeDialog();});
if('serviceWorker' in navigator){
 let hasController=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hasController){hasController=true;return;}
  if(document.getElementById('appUpdateNotice'))return;
  const notice=document.createElement('div');notice.id='appUpdateNotice';notice.className='message';notice.setAttribute('role','status');
  notice.append('An app update is ready. Save any changes, then ');
  const button=document.createElement('button');button.type='button';button.textContent='Reload app';button.addEventListener('click',()=>location.reload());notice.append(button);document.querySelector('main').prepend(notice);
 });
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));
}

document.addEventListener('invalid',e=>{if(!e.target.closest('#itemForm,#scanProductForm'))return;let parent=e.target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}},true);

document.addEventListener('input',e=>{if(e.target.closest('#itemForm')&&e.target.name==='unit')document.querySelector('#itemForm label[for="f_current"]').textContent='Quantity on hand ('+e.target.value+')';});
