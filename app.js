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
const newData = () => ({version:1,categories:JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),items:[],recipes:[],settings:{people:4,mealsPerDay:1,waterPerPerson:3}});
let state, activeTab = 'overview', categoryFilter = 'all', statusFilter = 'all', query = '', message = '', locationFilter='all', expiryRange='30';
function validData(d){
  if (!d || !Array.isArray(d.categories) || !Array.isArray(d.items) || !Array.isArray(d.recipes) || typeof d.settings !== 'object') throw Error('Not a valid Home Reserves backup');
  if (d.items.length > 20000 || d.categories.length > 500 || d.recipes.length > 2000) throw Error('Backup too large');
  return RecipeBook.initialise(InventoryCore.migrateCategories(d));
}
try {state=validData(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{state=validData(newData());}
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
function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));message='';}
  catch{message='Could not save to browser storage. Please export a backup.';}
  render();
}
function notify(note){message=note;render();window.scrollTo({top:0,behavior:'smooth'});}
function numberOrNull(value){
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
}
function stockStatus(i){return !listed(i)?'uncounted':low(i)?'low':!targeted(i)?'notarget':'ok';}
// A batch requires ALL its ingredients; recipes share one global pool of stock.
function requirements(recipe){
  const needed={};
  for(const ing of recipe.ingredients||[]){
    const q=Number(ing.amount);
    if(q>0 && Number.isFinite(q)) needed[ing.itemId]=(needed[ing.itemId]||0)+q;
  }
  return needed;
}
function calculateMeals(){
  const remaining={};state.items.forEach(i=>remaining[i.id]=i.portionType==='meal'||cat(i.category)?.type!=='food'?0:amount(i));
  const allocated={};state.recipes.forEach(r=>allocated[r.id]=0);
  const individually={};
  state.recipes.forEach(r=>{
    const req=requirements(r),ids=Object.keys(req);
    individually[r.id]=ids.length ? Math.max(0,Math.floor(Math.min(...ids.map(id=>itemById(id)?remaining[id]/req[id]:0))+1e-9)):0;
  });
  let made=true, passes=0;
  // Fair round-robin allocation: one batch per available recipe each round.
  while(made && passes < 10000){
    made=false; passes++;
    for(const r of state.recipes){
      const req=requirements(r),ids=Object.keys(req);
      if(ids.length && ids.every(id=>itemById(id)&&remaining[id]+1e-9 >= req[id])){
        ids.forEach(id=>remaining[id]-=req[id]);
        allocated[r.id]++;
        made=true;
      }
    }
  }
  const portions=InventoryCore.totals(foodItems()).meals+state.recipes.reduce((sum,r)=>sum+(allocated[r.id]||0)*(Number(r.portions)||0),0);
  return {allocated,individually,portions,capped:passes>=10000};
}
function field(name,label,value='',extra=''){
  return '<div class="field"><label for="f_'+name+'">'+label+'</label><input id="f_'+name+'" name="'+name+'" value="'+escapeHTML(value)+'" '+extra+'></div>';
}
function displayDate(value){try{const iso=InventoryCore.parseExpiry(value);return iso?iso.split('-').reverse().join('/'):'';}catch{return String(value||'');}}
function expiryField(value=''){return field('expiry','Use-by / best-before date (optional)',displayDate(value),'type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="DD/MM/YYYY"')+'<p class="hint">Type DD/MM/YYYY or 8 digits (25122027). Leave blank if unknown. Add stock with its own date; use Manage batches to correct existing dates.</p>';}
function dropdown(name,label,options,selected){
  return '<div class="field"><label for="f_'+name+'">'+label+'</label><select id="f_'+name+'" name="'+name+'">'+options.map(([id,text])=>'<option value="'+escapeHTML(id)+'" '+(id===selected?'selected':'')+'>'+escapeHTML(text)+'</option>').join('')+'</select></div>';
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
function portionReviewNote(category,portions){return cat(category)?.type==='food'&&!(Number(portions)>0)?'<p class="hint portion-review">Portions not set. You can save now and review them later; they will not add complete-meal coverage.</p>':'';}
function editItem(id){
 const i=id?itemById(id):null;
 if(!state.categories.length){notify('Create a category before adding stock.');showTab('settings');return;}
 const defaults=entryDefaults(),category=i?.category||defaults.category;
 editDialog('<h2>'+(i?'Edit item':'Add item')+'</h2><form id="itemForm" class="quick-entry" data-id="'+escapeHTML(i?.id||'')+'">'+
  field('name','Item name',i?.name||'','required maxlength="120" placeholder="e.g. Lentils"')+
  field('current','Quantity on hand ('+escapeHTML(i?.unit||'packs')+')',i?i.current??'':1,'type="number" min="0" step="any" placeholder="Not counted"')+
  '<div class="split">'+dropdown('category','Category',state.categories.map(c=>[c.id,c.name]),category)+field('location','Storage location',i?i.location||'':defaults.location,'maxlength="90" placeholder="Pantry"')+'</div>'+
  (i&&StockBatches.read(i).length>1?'<input type="hidden" name="expiry" value="'+escapeHTML(i.expiry||'')+'"><p class="hint">Multiple expiry dates: use Manage batches to edit them.</p><button type="button" data-action="manageBatches" data-id="'+escapeHTML(i.id)+'">Manage batches</button>':expiryField(i?.expiry))+portionReviewNote(category,i?.portionsPerPack)+formActions('Item',i?.id).replace('modal-actions','modal-actions entry-actions')+
  '<details class="entry-section" id="itemPortions"><summary>Portions and pack size</summary><div class="split">'+field('packSize','Weight / volume per pack',i?.packSize??'','type="number" min="0" step="any"')+dropdown('packUnit','Pack unit',[['g','grams'],['ml','millilitres']],i?.packUnit||'g')+'</div>'+
  field('unit','Counted in',i?.unit||'packs','required maxlength="32" placeholder="packs / tins / bottles"')+
  '<div class="split">'+field('portionsPerPack','Portions per pack',i?.portionsPerPack??'','type="number" min="0" step="any"')+dropdown('portionType','These portions are',[['ingredient','Ingredient portions'],['side','Side portions'],['meal','Complete meal portions']],i?.portionType||'ingredient')+'</div>'+
  (i?.portionSource?'<p class="hint">Portions: '+escapeHTML(i.portionSource)+'. Change the count to replace it with your own value.</p>':'')+
  field('litresPerUnit','Litres per item (for drinking water)',i?.litresPerUnit??'','type="number" min="0" step="any"')+'<p class="hint">Ingredient and side portions are not complete meals. Leave unknown sizes and portions blank.</p></details>'+
  '<details class="entry-section"><summary>Stock targets and notes</summary>'+field('optimum','Your stock target',i?.optimum??'','type="number" min="0" step="any" placeholder="Optional"')+
  '<div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes" rows="2" maxlength="300">'+escapeHTML(i?.notes||'')+'</textarea></div></details>'+
  (i?.barcode?'<details class="entry-section"><summary>Product details and nutrition</summary><p class="hint">Barcode: '+escapeHTML(i.barcode)+'</p><button type="button" data-action="productEdit" data-id="'+escapeHTML(i.id)+'">Edit product details</button></details>':'')+'</form>');
}
function editCategory(id){
  const c=id?cat(id):null;
  editDialog('<h2>'+(c?'Edit category':'New category')+'</h2><form id="categoryForm" data-id="'+escapeHTML(c?.id||'')+'">'+
    field('name','Category name',c?.name||'','required maxlength="90" placeholder="e.g. Pet supplies"')+
    dropdown('type','Category used for',[['other','General supplies'],['food','Recipe ingredients'],['water','Drinking water']],c?.type||'other')+
    '<p class="hint">Food categories appear when building meals. Water categories contribute to the water estimate.</p>'+formActions('Category',c?.id)+'</form>');
}
function ingredientRow(itemId='',quantity=''){
  return '<div class="ingredient-row"><select class="ingredientId" aria-label="Ingredient">'+foodItems().map(i=>'<option value="'+escapeHTML(i.id)+'" '+(i.id===itemId?'selected':'')+'>'+escapeHTML(i.name)+' ('+escapeHTML(i.unit)+')</option>').join('')+'</select><input class="ingredientQty" type="number" min="0.001" step="any" value="'+escapeHTML(quantity)+'" placeholder="Qty" aria-label="Quantity used per batch"><button type="button" data-action="removeIngredient" aria-label="Remove ingredient">×</button></div>';
}
function editRecipe(id){
  if (!foodItems().length){showTab('inventory');notify('Add food items to the inventory first, then build a meal from those ingredients.');return;}
  const r=state.recipes.find(r=>r.id===id);
  editDialog('<h2>'+(r?'Edit meal':'Add meal')+'</h2><form id="recipeForm" data-id="'+escapeHTML(r?.id||'')+'">'+
    field('name','Meal name',r?.name||'','required maxlength="120" placeholder="e.g. Bean chilli with rice"')+
    field('portions','Portions per batch',r?.portions||4,'required type="number" min="1" max="100" step="1"')+
    '<label>Ingredients needed for ONE batch</label><p class="hint">Quantities use the same units as inventory. If each batch needs two tins of beans, enter 2.</p><div id="ingredientRows">'+
    (r?.ingredients?.length?r.ingredients.map(ing=>ingredientRow(ing.itemId,ing.amount)).join(''):ingredientRow())+'</div>'+
    '<button type="button" class="light-button" data-action="addIngredient">+ Ingredient</button>'+formActions('Recipe',r?.id)+'</form>');
}
function stat(value,label){return '<div class="stat"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>';}
function stats(){
  const counted=state.items.filter(listed).length,below=state.items.filter(low).length,exp=state.items.filter(expiresSoon).length;
  return coverageSummary()+'<div class="stat-grid">'+stat(fmt(counted)+'<span class="small muted"> / '+fmt(state.items.length)+'</span>','Item types counted')+stat(fmt(below),'Below your optimum')+stat(fmt(exp),'Expiring or expired')+stat(fmt(calculateMeals().portions),'Planned food portions')+'</div>';
}
function backupStatus(){return '<section class="card"><h2>Protect your stocktake</h2><p class="hint">'+(state.backupRequestedAt?'Last backup download requested: '+escapeHTML(new Date(state.backupRequestedAt).toLocaleDateString('en-GB'))+'. Check that the file is saved.':'No backup download recorded yet.')+' Keep a copy outside this phone. Backups include stock, product details, portions, categories, meal plans and your recipe notebook. Household sync is not connected.</p><button data-action="export">Export backup</button></section>';}
function overview(){
  const m=calculateMeals(),people=setting('people',4),meals=setting('mealsPerDay',1),days=m.portions/(people*meals),water=waterLitres(),waterDays=water/(people*setting('waterPerPerson',3));
  const below=state.items.filter(low).sort((a,b)=>a.name.localeCompare(b.name));
  return '<section class="card hero"><div class="eyebrow">YOUR HOME AT A GLANCE</div><h2>Everything in one place</h2><p class="small muted">Track what you have, set your own comfortable levels and see what needs using or checking. No automatic shopping targets.</p><button data-action="reviewGaps">Identify gaps</button></section>'+gapsSummary()+foodCoverageCard()+stats()+
  '<section class="card"><div class="section-title"><h2>Meal plan and water coverage</h2><button class="text-button" data-tab="meals">Meal details →</button></div>'+
  '<div class="split"><div><div class="large-number">'+(state.recipes.length||m.portions?fmt(days):'—')+'</div><div class="small muted">Days of tracked meals only</div><div class="small"><strong>'+(state.recipes.length||m.portions?fmt(days/7)+' weeks':'Add recipes to estimate')+'</strong></div></div>'+
  '<div><div class="large-number">'+(water>0?fmt(waterDays):'—')+'</div><div class="small muted">Water days</div><div class="small"><strong>'+fmt(water)+' litres logged</strong></div></div></div>'+
  '<p class="hint">Based on '+fmt(people)+' people, '+fmt(meals)+' tracked meal(s) per person daily and '+fmt(setting('waterPerPerson',3))+' litres of water per person daily. These are approximate planning figures, not guarantees of a nutritionally complete diet or water for washing.</p></section>'+
  '<section class="card"><div class="section-title"><h2>Below your optimum</h2><button class="text-button" data-tab="inventory">All stock →</button></div>'+
  (below.length?below.slice(0,7).map(i=>'<div class="row-line"><span>'+escapeHTML(i.name)+'</span><span class="small nowrap">'+fmt(i.current)+' / '+fmt(i.optimum)+' '+escapeHTML(i.unit)+'</span></div>').join(''):'<div class="empty">Nothing currently recorded below its target.</div>')+
  (below.length>7?'<p class="hint">Plus '+(below.length-7)+' more items.</p>':'')+'</section>'+
  (!state.items.length?'<section class="card"><h2>Start your inventory</h2><p class="small muted">Add the items you already have, or load a starter list and fill in quantities as you do a stock check.</p><div class="actions"><button class="primary" data-action="newItem">+ Add first item</button><button data-action="starter">Load starter list</button></div></section>':'');
}
function itemCard(i){
  const c=cat(i.category),expiry=daysToExpiry(i),below=i.batchEntry?low({...i,current:i.productCurrent}):low(i),max=targeted(i)?Number(i.optimum):0;
  let badges='<span class="badge">'+escapeHTML(c?.name||'Other')+'</span>';
  if(cat(i.category)?.type==='food'&&!(Number(i.portionsPerPack)>0))badges+='<span class="badge">Portions to review</span>';
  if(!listed(i))badges+='<span class="badge low">Not yet counted</span>';
  else if(below)badges+='<span class="badge low">Below optimum</span>';
  else if(!targeted(i))badges+='<span class="badge">No target</span>';
  if(expiry!==null&&expiry<=30)badges+='<span class="badge red">'+(expiry<0?'Expired':expiry===0?'Expires today':'Expires in '+expiry+' days')+'</span>';
  return '<article class="item"><div class="item-header"><div><div class="item-title">'+escapeHTML(i.name)+'</div>'+badges+'</div><button class="text-button" data-action="editItem" data-id="'+escapeHTML(i.id)+'">Edit</button></div>'+
    (!i.batchEntry&&listed(i)&&max>0?'<div class="meter '+(below?'low':'')+'"><span style="width:'+Math.min(100,amount(i)*100/max)+'%"></span></div>':'')+
    '<div class="item-bottom"><div class="counts">Current: <strong>'+(listed(i)?fmt(i.current):'—')+'</strong> '+escapeHTML(i.unit)+'<br>Optimum: <strong>'+(targeted(i)?fmt(i.optimum):'Not set')+'</strong> '+escapeHTML(i.unit)+
    (i.portionsPerPack?'<br>'+fmt(amount(i)*i.portionsPerPack)+' '+escapeHTML(i.portionType||'ingredient')+' portions'+(['estimated','calculated'].includes(i.portionSource)?' (estimate)':''):'')+(i.location?'<br>📍 '+escapeHTML(i.location):'')+(i.expiry?'<br>Use-by / best-before: '+escapeHTML(displayDate(i.expiry)):'')+(i.notes?'<br>'+escapeHTML(i.notes):'')+'</div>'+
    (i.batchEntry?'<span class="hint">Batch quantity · product total '+fmt(i.productCurrent)+' '+escapeHTML(i.unit)+'</span>':'<div class="stepper"><button type="button" data-action="minus" data-id="'+escapeHTML(i.id)+'" aria-label="Use one '+escapeHTML(i.name)+'" '+(!listed(i)||amount(i)<=0?'disabled':'')+'>−</button><strong>'+(listed(i)?fmt(i.current):'—')+'</strong><button type="button" data-action="plus" data-id="'+escapeHTML(i.id)+'" aria-label="Add one '+escapeHTML(i.name)+'">+</button></div>')+'</div>'+batchSummary(i)+'</article>';
}
const pantrySectionState=new Map();
let pantrySectionDefaults=new Map();
try{const saved=JSON.parse(localStorage.getItem('home_reserves_sections_v1'));if(Array.isArray(saved))pantrySectionDefaults=new Map(saved.filter(e=>Array.isArray(e)&&typeof e[0]==='string'&&typeof e[1]==='boolean'));}catch{}
function pantryViewKey(id){return JSON.stringify([categoryFilter,statusFilter,locationFilter,query,id]);}
function pantryGroups(items){
 const groups=new Map();
 for(const c of state.categories)groups.set(c.id,{id:c.id,name:c.name,type:c.type,items:[]});
 for(const item of items){const id=item.category||'';if(!groups.has(id))groups.set(id,{id,name:'Uncategorised',items:[]});groups.get(id).items.push(item);}
 const filtering=categoryFilter!=='all'||statusFilter!=='all'||locationFilter!=='all'||query.trim()!=='';
 const kitId=familyKitCategoryId(),kitRows=familyKitPantryRows();
 const isOpen=id=>{const key=pantryViewKey(id);return pantrySectionState.has(key)?pantrySectionState.get(key):filtering?true:pantrySectionDefaults.get(id)||false;};
 const draw=g=>{
  const kit=g.id===kitId?kitRows:[],below=g.items.filter(low).length+kit.filter(r=>low({...r,optimum:r.target})).length,expiring=g.items.filter(expiresSoon).length+kit.filter(expiresSoon).length;
  const title=g.type==='food'&&g.name.toLowerCase()==='food'?'Other food — to organise':g.name;
  return '<details class="pantry-group" data-category="'+escapeHTML(g.id)+'" data-view="'+escapeHTML(pantryViewKey(g.id))+'" '+(isOpen(g.id)?'open':'')+'><summary><span class="group-title">'+escapeHTML(title)+'</span><span class="group-count">'+(g.items.length?g.items.length+' item type'+(g.items.length===1?'':'s'):'')+(kit.length?(g.items.length?' · ':'')+kit.length+' checklist entries':'')+(!g.items.length&&!kit.length?'Empty':'')+'</span>'+(below?'<span class="badge low">'+below+' below optimum</span>':'')+(expiring?'<span class="badge red">'+expiring+' due / overdue</span>':'')+'</summary><div class="items-grid">'+g.items.map(itemCard).join('')+(!g.items.length&&!kit.length?'<p class="hint">No items in this group yet.</p>':'')+'</div>'+(kit.length?familyKitPantryContent(kit):'')+'</details>';
 };
 const foods=[...groups.values()].filter(g=>g.type==='food'&&(!filtering||g.items.length)),foodItemsShown=foods.flatMap(g=>g.items);
 const rootId='__food-root',food=foods.length?'<details class="pantry-group food-parent" data-category="'+rootId+'" data-view="'+escapeHTML(pantryViewKey(rootId))+'" '+(isOpen(rootId)?'open':'')+'><summary><span class="group-title">Food</span><span class="group-count">'+foodItemsShown.length+' item types · '+foods.length+' subcategories</span>'+(foodItemsShown.some(low)?'<span class="badge low">'+foodItemsShown.filter(low).length+' below optimum</span>':'')+(foodItemsShown.some(expiresSoon)?'<span class="badge red">'+foodItemsShown.filter(expiresSoon).length+' due / overdue</span>':'')+'</summary><div class="food-subcategories">'+foods.map(draw).join('')+'</div></details>':'';
 return food+[...groups.values()].filter(g=>g.type!=='food'&&(g.items.length||(g.id===kitId&&kitRows.length))).map(draw).join('');
}
document.addEventListener('toggle',e=>{
 const group=e.target;if(!group.matches?.('.pantry-group')||!group.isConnected)return;
 pantrySectionState.set(group.dataset.view,group.open);
 if(categoryFilter==='all'&&statusFilter==='all'&&locationFilter==='all'&&!query.trim()){
  pantrySectionDefaults.set(group.dataset.category,group.open);
  try{localStorage.setItem('home_reserves_sections_v1',JSON.stringify([...pantrySectionDefaults]));}catch{}
 }
},true);
function setPantrySections(open){document.querySelectorAll('.pantry-group').forEach(group=>{pantrySectionState.set(group.dataset.view,open);group.open=open;});}
function inventory(){
  const locations=[...new Set(state.items.map(i=>String(i.location||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const filtered=state.items.filter(i=>(categoryFilter==='all'||(categoryFilter==='all-food'&&cat(i.category)?.type==='food')||i.category===categoryFilter)&&(locationFilter==='all'||String(i.location||'').trim()===locationFilter)&&
    (statusFilter==='all'||(statusFilter==='low'&&low(i))||(statusFilter==='uncounted'&&!listed(i))||(statusFilter==='notarget'&&!targeted(i))||(statusFilter==='expiry'&&expiresSoon(i)))&&
    (i.name+' '+(i.location||'')+' '+(i.notes||'')).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(low(b))-Number(low(a))||a.name.localeCompare(b.name));
  return '<section class="card"><div class="section-title"><h2>Pantry & household stock</h2><div class="actions"><button data-action="organiseFood">Organise food</button><button data-action="newCategory">+ Category</button><button data-action="newItem">+ Add item</button><button class="primary" data-action="scan">Scan barcode</button></div></div>'+
    '<p class="hint">All your household stock is here. Use Storage location to see just the pantry, freezer or another cupboard.</p><div class="filter-grid"><input id="filterSearch" class="search" aria-label="Search stock" placeholder="Search items or locations" value="'+escapeHTML(query)+'">'+
    '<select id="filterCategory" aria-label="Select category"><option value="all">All categories</option><option value="all-food" '+(categoryFilter==='all-food'?'selected':'')+'>Food — all subcategories</option>'+state.categories.map(c=>'<option value="'+escapeHTML(c.id)+'" '+(categoryFilter===c.id?'selected':'')+'>'+escapeHTML(c.type==='food'?'Food / '+(c.name.toLowerCase()==='food'?'Other food':c.name):c.name)+'</option>').join('')+'</select>'+
    '<select id="filterStatus" aria-label="Select status">'+[['all','All levels'],['low','Below optimum'],['uncounted','Not counted'],['notarget','No optimum set'],['expiry','Expiring soon']].map(([v,l])=>'<option value="'+v+'" '+(statusFilter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
    '<label for="filterLocation">Storage location</label><select id="filterLocation"><option value="all">All locations</option>'+locations.map(location=>'<option value="'+escapeHTML(location)+'" '+(locationFilter===location?'selected':'')+'>'+escapeHTML(location)+'</option>').join('')+'</select>'+
    '<p class="hint">'+filtered.length+' inventory item types shown; kit contents are listed separately. Open Food to browse its subcategories, then open a group to see items. Use + / − for quick stock adjustments, or Edit for an exact count.</p>'+(filtered.length||familyKitPantryRows().length||(categoryFilter==='all'&&statusFilter==='all'&&locationFilter==='all'&&!query.trim()&&state.categories.some(c=>c.type==='food'))?'<div class="actions"><button data-action="expandPantry">Expand all</button><button data-action="collapsePantry">Collapse all</button></div>':'')+'</section>'+
    (filtered.length||familyKitPantryRows().length||(categoryFilter==='all'&&statusFilter==='all'&&locationFilter==='all'&&!query.trim()&&state.categories.some(c=>c.type==='food'))?pantryGroups(filtered):'<section class="card empty">'+(state.items.length?'No items match your filters.':'No inventory yet. Add your first item, or load starter items in Settings.')+'</section>');
}
function expiring(){
 const items=InventoryCore.expiryItems(state.items,expiryRange);
 return '<section class="card hero"><div class="eyebrow">USE FIRST</div><h2>Expiring stock</h2><p class="hint">In-stock batches, earliest date first. Includes every storage location. Used-up and uncounted items are excluded.</p><label for="expiryRange">Show products</label><select id="expiryRange">'+[['7','Overdue and next 7 days'],['30','Overdue and next 30 days'],['90','Overdue and next 90 days'],['expired','Past the recorded date'],['all','All dated stock'],['undated','No valid date recorded']].map(([value,label])=>'<option value="'+value+'" '+(expiryRange===value?'selected':'')+'>'+label+'</option>').join('')+'</select><p role="status">'+items.length+' stock entries</p><p class="hint">Follow the date type printed on the pack. Use-by dates concern safety; best-before dates concern quality. Each expiry batch is shown separately here; Pantry keeps them under one product card.</p></section>'+(items.length?'<div class="items-grid">'+items.map(itemCard).join('')+'</div>':'<section class="card empty">No pantry stock matches this date range.</section>')+firstAidExpiryCards();
}
function meals(){
  const plan=calculateMeals(),people=setting('people',4),perDay=setting('mealsPerDay',1),days=plan.portions/(people*perDay);
  return '<section class="card hero"><div class="eyebrow">MEAL CAPACITY</div><h2>How many meals can you make?</h2>'+
    '<div class="stat-grid">'+stat(fmt(plan.portions),'Individual portions')+stat(fmt(Math.floor(plan.portions/people)),'Complete family meals')+stat(fmt(days),'Days of tracked meals')+stat(fmt(days/7),'Weeks of tracked meals')+'</div>'+
    '<p class="hint">For '+fmt(people)+' people, '+fmt(perDay)+' tracked meal(s) per person per day. Each ingredient is allocated once across the recipes below to avoid counting the same tin or pouch twice.</p></section>'+
    '<section class="card"><div class="section-title"><h2>Your meals</h2><button class="primary" data-action="newRecipe">+ Meal</button></div>'+
    (state.recipes.length?state.recipes.map((r,index)=>'<article class="meal"><div class="line"><div><h3>'+escapeHTML(r.name)+'</h3><div class="small muted">'+fmt(r.portions)+' portions per batch</div></div><button class="text-button" data-action="editRecipe" data-id="'+escapeHTML(r.id)+'">Edit</button></div>'+
      '<ul>'+r.ingredients.map(ing=>{const i=itemById(ing.itemId);return '<li>'+fmt(ing.amount)+' '+escapeHTML(i?.unit||'units')+' '+escapeHTML(i?.name||'(item removed)')+'</li>';}).join('')+'</ul>'+
      '<div class="line"><div class="small"><strong>'+fmt(plan.allocated[r.id]||0)+' batches</strong> in shared plan<br><span class="muted">Up to '+fmt(plan.individually[r.id]||0)+' if made on its own</span></div>'+
      '<div class="recipe-tools"><button data-action="recipeUp" data-id="'+escapeHTML(r.id)+'" title="Move earlier" aria-label="Move '+escapeHTML(r.name)+' earlier" '+(index===0?'disabled':'')+'>↑</button><button data-action="recipeDown" data-id="'+escapeHTML(r.id)+'" title="Move later" aria-label="Move '+escapeHTML(r.name)+' later" '+(index===state.recipes.length-1?'disabled':'')+'>↓</button></div></div></article>').join(''):
      '<div class="empty">To calculate meals, add food items to Inventory, then create a meal listing the ingredients needed for one batch and how many portions it makes.</div>')+
    '<p class="hint">The plan rotates through recipes from top to bottom, making one batch each when ingredients are available. Change the order with the arrows; your result may change with recipe choices and priorities. Portions do not measure calorie or nutritional adequacy.</p>'+(plan.capped?'<p class="message warning">Calculation stopped at its batch limit. Extremely large stock quantities may be undercounted.</p>':'')+'</section>'+
    '<section class="card"><h2>Family meal planning</h2><p class="small muted">Start with meals you really make — for example, pasta and sauce, bean chilli with rice, or lentil soup. Include ALL key ingredients in the recipe. The app will show your possible batch count from your current stock. Change household size or meals per day in Settings.</p><button data-tab="inventory">Add food inventory →</button></section>';
}
function settings(){
  return '<section class="card"><h2>Household planning assumptions</h2><form id="settingsForm"><div class="split">'+
    field('people','People',setting('people',4),'required type="number" min="1" max="30" step="1"')+
    field('mealsPerDay','Tracked meals per person / day',setting('mealsPerDay',1),'required type="number" min="1" max="6" step="1"')+'</div>'+
    field('householdKcal','Household kcal per day (optional override)',state.settings.householdKcal??'','type="number" min="1" step="any" placeholder="Default: 2,000 × people"')+'<p class="hint">Food days use known stock calories divided by this daily total. Leave blank for the provisional 2,000 kcal per person assumption. Needs vary by age, body size and activity; adjust for your household, including children. This is an energy estimate, not a balanced-diet assessment.</p>'+
    field('waterPerPerson','Water litres per person / day',setting('waterPerPerson',3),'required type="number" min="0.1" max="20" step="0.1"')+
    '<p class="hint">Select 1 tracked meal a day if you are only planning dinners, or 3 if you have included breakfast, lunch and dinner. The water estimate covers drinking and basic cooking only.</p><button class="primary" type="submit">Save assumptions</button></form></section>'+
    '<section class="card"><div class="section-title"><h2>My categories</h2><button data-action="newCategory">+ Category</button></div>'+state.categories.map(c=>'<div class="row-line"><div><strong>'+escapeHTML(c.name)+'</strong><div class="tiny muted">'+(c.type==='food'?'Food for recipes':c.type==='water'?'Water volumes':'General stock')+' · '+state.items.filter(i=>i.category===c.id).length+' item types</div></div><button class="text-button" data-action="editCategory" data-id="'+escapeHTML(c.id)+'">Edit</button></div>').join('')+'</section>'+
    backupStatus()+'<section class="card"><h2>Starter list and backups</h2><p class="small muted">Load an editable list of common items without inventing quantities. You can add more categories and item types whenever you need.</p>'+
    '<div class="actions"><button data-action="starter">+ Load starter items</button><button data-action="export">Export backup</button><button data-action="csv">Export CSV</button><button data-action="import">Import backup</button></div>'+
    '<input id="importInput" type="file" accept="application/json,.json"><p class="hint">JSON backup includes recipes and settings. CSV is a readable inventory list. Import replaces your current inventory after confirmation.</p></section>'+
    '<section class="card"><h2>Useful limitations</h2><p class="small muted">All counts stay on this browser, not automatically synced to your husband’s phone or GitHub. Products can contain multiple expiry batches. Use Manage batches to split counts by date; quick stock use removes the earliest date first. Preparedness is about practical supplies, not chasing a perfect score.</p></section>';
}
function render(){
  $('message').innerHTML=message?'<div class="message warning">'+escapeHTML(message)+'</div>':'';
  $('screen').innerHTML=activeTab==='overview'?overview():activeTab==='inventory'?inventory():activeTab==='expiry'?expiring():activeTab==='recipes'?recipeBookScreen():activeTab==='meals'?meals():activeTab==='stocktake'?stocktake():settings();
  document.querySelectorAll('.nav [data-tab]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.tab===activeTab?'page':'false')));
}
function showTab(t){activeTab=t;render();window.scrollTo({top:0,behavior:'smooth'});}
function moveRecipe(id,offset){
  const from=state.recipes.findIndex(r=>r.id===id),to=from+offset;
  if(from<0||to<0||to>=state.recipes.length)return;
  [state.recipes[from],state.recipes[to]]=[state.recipes[to],state.recipes[from]];
  persist();
}
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
    case 'expandPantry':setPantrySections(true);break;
    case 'collapsePantry':setPantrySections(false);break;
    case 'newItem':editItem();break;
    case 'editItem':editItem(id);break;
    case 'newCategory':editCategory();break;
    case 'editCategory':editCategory(id);break;
    case 'newRecipe':editRecipe();break;
    case 'editRecipe':editRecipe(id);break;
    case 'close':closeDialog();break;
    case 'plus':case 'minus':{
      const i=itemById(id);if(!i)break;
      Object.assign(i,StockBatches.change(i,Math.min(1,action==='minus'?amount(i):1),action==='plus'?'add':'use',''));persist();break;
    }
    case 'addIngredient':$('ingredientRows').insertAdjacentHTML('beforeend',ingredientRow());break;
    case 'removeIngredient':button.closest('.ingredient-row')?.remove();break;
    case 'recipeUp':moveRecipe(id,-1);break;
    case 'recipeDown':moveRecipe(id,1);break;
    case 'starter':loadStarters();break;
    case 'export':state.backupRequestedAt=new Date().toISOString();persist();downloadFile('home-reserves-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');break;
    case 'csv':{
      const rows=[['Category','Item','Current','Optimum','Unit','Location','Expiry','Litres per item','Notes'],...state.items.map(i=>[cat(i.category)?.name||'',i.name,i.current??'',i.optimum??'',i.unit,i.location||'',i.expiry||'',i.litresPerUnit??'',i.notes||''])];
      const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      downloadFile('home-reserves-inventory.csv','\uFEFF'+csv,'text/csv;charset=utf-8');break;
    }
    case 'import':$('importInput')?.click();break;
    case 'deleteItem':if(confirm('Delete this stock item? Meal recipes using it will need updating.')){state.items=state.items.filter(i=>i.id!==id);persist();closeDialog();}break;
    case 'deleteCategory':if(state.items.some(i=>i.category===id)){alert('Move or delete the items in this category first.');break;}
      if(confirm('Delete this category?')){state.categories=state.categories.filter(c=>c.id!==id);persist();closeDialog();}break;
    case 'deleteRecipe':if(confirm('Delete this meal?')){state.recipes=state.recipes.filter(r=>r.id!==id);persist();closeDialog();}break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.id!=='filterSearch')return;
  query=e.target.value;const caret=e.target.selectionStart;render();const field=$('filterSearch');field.focus();field.setSelectionRange(caret,caret);
});
document.addEventListener('change',async e=>{
  if(e.target.id==='filterLocation'){locationFilter=e.target.value;render();}
  if(e.target.id==='expiryRange'){expiryRange=e.target.value;render();}
  if(e.target.id==='filterCategory'){categoryFilter=e.target.value;render();}
  if(e.target.id==='filterStatus'){statusFilter=e.target.value;render();}
  if(e.target.id==='importInput'&&e.target.files?.[0]){
    try{
      const d=validData(JSON.parse(await e.target.files[0].text()));
      if(!confirm('Replace your ENTIRE current inventory, categories, meals and settings with this backup?'))return;
      state=d;persist();notify('Your backup was imported.');
    }catch(err){notify('Could not import file: '+err.message);}
    finally{if(e.target)e.target.value='';}
  }
});
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!['itemForm','categoryForm','recipeForm','settingsForm'].includes(form.id))return;
  e.preventDefault();const data=new FormData(form),id=form.dataset.id;
  if(form.id==='itemForm'){
    let expiry;try{expiry=InventoryCore.parseExpiry(data.get('expiry'));}catch(err){alert(err.message);return;}
    const name=String(data.get('name')||'').trim(),category=String(data.get('category')),unit=String(data.get('unit')||'').trim();
    if(!name||!unit||!cat(category)){alert('Please provide a name, unit and valid category.');return;}
    let item={...(id?itemById(id):{}),id:id||uid(),name,category,unit,portionsPerPack:numberOrNull(data.get('portionsPerPack')),portionType:String(data.get('portionType')||'ingredient'),current:numberOrNull(data.get('current')),optimum:numberOrNull(data.get('optimum')),location:String(data.get('location')||'').trim(),expiry,litresPerUnit:numberOrNull(data.get('litresPerUnit')),notes:String(data.get('notes')||'').trim()};
    item=StockBatches.reconcile(id?itemById(id):null,item);item.packSize=numberOrNull(data.get('packSize'));item.packUnit=String(data.get('packUnit')||'g');state.entryDefaults={category:item.category,location:item.location};
    if(!id||item.portionsPerPack!==itemById(id)?.portionsPerPack)item.portionSource='manual';if(id){const at=state.items.findIndex(i=>i.id===id);if(at<0)return;state.items[at]=item;}else state.items.push(item);
  }else if(form.id==='categoryForm'){
    const name=String(data.get('name')||'').trim(),type=String(data.get('type'));
    if(!name||!['food','water','other'].includes(type)){alert('Enter a valid category.');return;}
    if(id){const c=cat(id);if(!c)return;c.name=name;c.type=type;}else state.categories.push({id:uid(),name,type});
  }else if(form.id==='recipeForm'){
    const name=String(data.get('name')||'').trim(),portions=Number(data.get('portions'));
    const ingredients=[...form.querySelectorAll('.ingredient-row')].map(row=>({itemId:row.querySelector('.ingredientId')?.value,amount:Number(row.querySelector('.ingredientQty')?.value)}));
    if(!name||!Number.isInteger(portions)||portions<1||!ingredients.length||ingredients.some(ing=>!ing.itemId||!Number.isFinite(ing.amount)||ing.amount<=0)){
      alert('Enter a meal name, portions and a positive amount for every ingredient.');return;
    }
    const recipe={id:id||uid(),name,portions,ingredients};
    if(id){const at=state.recipes.findIndex(r=>r.id===id);if(at<0)return;state.recipes[at]=recipe;}else state.recipes.push(recipe);
  }else if(form.id==='settingsForm'){
    const people=Number(data.get('people')),mealsPerDay=Number(data.get('mealsPerDay')),waterPerPerson=Number(data.get('waterPerPerson'));
    if(!Number.isInteger(people)||people<1||!Number.isInteger(mealsPerDay)||mealsPerDay<1||!(waterPerPerson>0)){alert('Enter valid household figures.');return;}
    state.settings={...state.settings,people,mealsPerDay,waterPerPerson,householdKcal:numberOrNull(data.get('householdKcal'))};
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
