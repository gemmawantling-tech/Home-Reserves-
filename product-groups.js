/* Optional grouping metadata; inventory rows remain the sole quantity ledger. */
(function(root){'use strict';
const C=typeof module!=='undefined'?require('./inventory-core.js'):root.InventoryCore;
const numeric=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
function unit(value){const s=String(value||'').trim().toLowerCase(),map={g:['mass',1],gram:['mass',1],grams:['mass',1],kg:['mass',1000],kilogram:['mass',1000],kilograms:['mass',1000],ml:['volume',1],millilitre:['volume',1],millilitres:['volume',1],l:['volume',1000],litre:['volume',1000],litres:['volume',1000]};if(map[s])return {key:map[s][0],factor:map[s][1]};const aliases={packs:'pack',packet:'pack',packets:'pack',pouch:'pack',pouches:'pack',tins:'tin',can:'tin',cans:'tin',jars:'jar',bottles:'bottle',bags:'bag',units:'unit',items:'unit',item:'unit',portions:'portion',cartons:'carton',boxes:'box',tubs:'tub',pots:'pot',rolls:'roll',sachets:'sachet'};return s?{key:aliases[s]||s,factor:1}:null;}
function compatible(a,b){return !!unit(a)&&unit(a)?.key===unit(b)?.key;}
function groupFor(item,data){return (data.productGroups||[]).find(g=>g.id===item.productGroupId)||null;}
function members(g,data){return (data.items||[]).filter(i=>i.productGroupId===g.id);}
function totals(g,items){const target=numeric(g.target),base=unit(g.unit),seen=new Set();let quantity=0,uncounted=0,incompatible=0,varieties=0;for(const i of items||[]){if(i.productGroupId!==g.id||seen.has(i.id))continue;seen.add(i.id);varieties++;const q=numeric(i.current);if(q===null)uncounted++;if(!base||!compatible(i.unit,g.unit)){incompatible++;continue;}if(q===null)continue;quantity+=q*unit(i.unit).factor/base.factor;}return {quantity:Math.round(quantity*1e8)/1e8,varieties,uncounted,incompatible,target,progress:target>0?Math.min(1,quantity/target):null};}
function validateItem(data,item){if(item.productGroupId&&!groupFor(item,data))throw Error('This product group is unavailable. Choose another group or Ungrouped.');}
function breakdown(g,items){const buckets=new Map(),seen=new Set();for(const i of items){if(i.productGroupId!==g.id||seen.has(i.id))continue;seen.add(i.id);const u=unit(i.unit),q=numeric(i.current);if(!u||q===null)continue;const key=u.key,normal=key==='mass'?'g':key==='volume'?'ml':key;const b=buckets.get(key)||{unit:normal,quantity:0};b.quantity+=q*u.factor;buckets.set(key,b);}return [...buckets.values()].map(b=>({...b,quantity:Math.round(b.quantity*1e8)/1e8}));}
function displayCategory(item,data){const g=groupFor(item,data);if(!g)return item.category;return data.categories.some(c=>c.id===g.category)?g.category:data.categories[0]?.id||item.category;}
function setMembers(data,ids,group){const wanted=new Set(ids);if(!wanted.size&&!group.id)throw Error('Select at least one item.');for(const id of wanted)if(!data.items.some(i=>i.id===id))throw Error('An item has changed. Reopen grouping.');const first=data.items.find(i=>wanted.has(i.id));let next=save(data,{...group,category:group.category||first?.category,unit:group.unit||first?.unit||'unit'});const removed=members(group,next).filter(i=>!wanted.has(i.id)).map(i=>i.id);next=assign(next,removed,null);return assign(next,[...wanted],group.id);}
function syncCatalogue(data){for(const [key,p] of Object.entries(data.catalogue||{})){const item=data.items.find(i=>C.sameBarcode(i.barcode,p.barcode||key));if(item)data.catalogue[key]={...p,productGroupId:item.productGroupId||null};}return data;}
function assign(data,ids,groupId){const next=JSON.parse(JSON.stringify(data)),wanted=new Set(ids);if(groupId&&!(next.productGroups||[]).some(g=>g.id===groupId))throw Error('Product group not found.');for(const i of next.items){if(!wanted.has(i.id))continue;i.productGroupId=groupId||null;validateItem(next,i);}return syncCatalogue(next);}
function save(data,group){const next=JSON.parse(JSON.stringify(data)),g={...group,name:String(group.name||'').trim(),unit:String(group.unit||'unit').trim(),category:group.category||next.categories[0]?.id||'',target:numeric(group.target)};if(!next.categories.some(c=>c.id===g.category))g.category=next.categories[0]?.id||'';if(!g.id||!g.name||g.name.length>90||!unit(g.unit))throw Error('Enter a group name of up to 90 characters.');if(group.target!==null&&group.target!==undefined&&group.target!==''&&g.target===null)throw Error('The group target must be zero or above.');next.productGroups=next.productGroups||[];if(next.productGroups.some(x=>x.id!==g.id&&x.category===g.category&&x.name.toLowerCase()===g.name.toLowerCase()))throw Error('A group with this name already exists in this category. Use Merge groups if needed.');const at=next.productGroups.findIndex(x=>x.id===g.id);if(at<0)next.productGroups.push(g);else next.productGroups[at]=g;for(const item of members(g,next))validateItem(next,item);return next;}
function merge(data,sourceId,targetId){if(sourceId===targetId)throw Error('Choose two different groups.');const source=(data.productGroups||[]).find(g=>g.id===sourceId),target=(data.productGroups||[]).find(g=>g.id===targetId);if(!source||!target)throw Error('Product group not found.');const next=assign(data,members(source,data).map(i=>i.id),targetId);next.productGroups=next.productGroups.filter(g=>g.id!==sourceId);for(const [key,p] of Object.entries(next.catalogue||{}))if(p.productGroupId===sourceId)next.catalogue[key]={...p,productGroupId:targetId};return next;}
function remove(data,id){const next=assign(data,(data.items||[]).filter(i=>i.productGroupId===id).map(i=>i.id),null);next.productGroups=(next.productGroups||[]).filter(g=>g.id!==id);for(const [key,p] of Object.entries(next.catalogue||{}))if(p.productGroupId===id)next.catalogue[key]={...p,productGroupId:null};return next;}
function suggestion(item){const s=[item.name,item.brand,item.flavour].filter(Boolean).join(' ').toLowerCase();
const rules=[
[/\b(coffee pods?|coffee capsules?|nespresso|dolce gusto)\b/,'Coffee Pods'],
[/\binstant coffee\b|\bcoffee granules\b/,'Instant Coffee'],
[/\b(coffee beans|whole bean coffee)\b/,'Coffee Beans'],
[/\b(ground coffee|filter coffee|cafeti[eè]re coffee|espresso ground)\b/,'Ground Coffee'],
[/\b(microwave|microwavable|ready cooked|cooked|pilau|thai coconut)\b.*\brice\b|\brice\b.*\b(microwave|microwavable|ready cooked)\b/,'Microwave Rice'],
[/\bdolmio\b|\bpasta sauce\b|\b(tomato|bolognese|basil)\b.*\bsauce\b/,'Pasta Sauces'],
[/\b(curry sauce|tikka masala sauce|korma sauce)\b/,'Curry Sauces'],
[/\b(ketchup|mayonnaise|mustard)\b/,'Condiments'],
[/\b(basmati rice|long grain rice|brown rice|dry rice|jasmine rice)\b/,'Dry Rice'],
[/\b(spaghetti|penne|fusilli|macaroni|dry pasta)\b/,'Dry Pasta'],
[/\bbaked beans\b/,'Baked Beans'],
[/\b(kidney beans|butter beans|cannellini beans|black beans)\b/,'Beans'],
[/\bchickpeas\b/,'Chickpeas'],[/\blentils\b/,'Lentils'],
[/\b(porridge oats|rolled oats|oatmeal)\b/,'Porridge Oats'],
[/\b(peanut butter|almond butter)\b/,'Nut Butters'],
[/\b(tinned tuna|canned tuna|tuna chunks|tuna steaks)\b/,'Tinned Tuna'],
[/\b(tinned tomatoes|chopped tomatoes|plum tomatoes|passata)\b/,'Tomatoes'],
[/\btea bags?\b/,'Tea Bags'],[/\b(uht milk|long life milk)\b/,'Long-life Milk'],
[/\b(bottled water|spring water|mineral water)\b/,'Drinking Water'],
[/\b(plain flour|self raising flour|bread flour)\b/,'Flour'],
[/\b(olive oil|sunflower oil|vegetable oil|rapeseed oil)\b/,'Cooking Oils'],
[/\b(washing up liquid|dishwashing liquid)\b/,'Washing-up Liquid'],
[/\b(toilet roll|toilet paper)\b/,'Toilet Rolls'],[/\bbaby wipes\b/,'Baby Wipes']
];return rules.find(([pattern])=>pattern.test(s))?.[1]||'';}
function review(data){return data.items.map(i=>({id:i.id,name:i.name,category:i.category,unit:i.unit,current:i.current,existing:groupFor(i,data)?.name||'',suggested:groupFor(i,data)?'':suggestion(i)}));}
function applyReview(data,choices,makeId){let next=JSON.parse(JSON.stringify(data));const seen=new Set();for(const choice of choices){if(seen.has(choice.id))throw Error('A product was selected twice.');seen.add(choice.id);const item=next.items.find(i=>i.id===choice.id);if(!item)throw Error('An item has changed. Review the inventory again.');if(item.productGroupId)throw Error('An item is already grouped. Review the inventory again.');const name=String(choice.name||'').trim();if(!name||name.length>90)throw Error('Enter a group name of up to 90 characters.');let group=(next.productGroups||[]).find(g=>g.name.toLowerCase()===name.toLowerCase());if(!group){group={id:makeId(),name,category:item.category,unit:item.unit,target:null};next=save(next,group);}next=assign(next,[item.id],group.id);}validate(next);return next;}
// One-time metadata upgrade. Explicitly ungrouped items stay ungrouped after this version.
function automatic(data,makeId){if(data.automaticGroupingVersion===1)return {data,assigned:0};const rows=review(data),choices=[];for(const r of rows){if(r.existing||!r.suggested||!unit(r.unit)||!data.categories.some(c=>c.id===r.category))continue;choices.push({id:r.id,name:r.suggested});}if(!choices.length)return {data,assigned:0};const next=applyReview(data,choices,makeId);next.automaticGroupingVersion=1;return {data:next,assigned:choices.length};}
function validate(data){if(data.productGroups===undefined||data.productGroups===null)return;if(!Array.isArray(data.productGroups)||data.productGroups.length>2000)throw Error('Invalid product-group data.');const ids=new Set();for(const g of data.productGroups){if(!g||typeof g.id!=='string'||!g.id||ids.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>90||typeof g.category!=='string'||!unit(g.unit)||g.target!==null&&g.target!==undefined&&g.target!==''&&numeric(g.target)===null)throw Error('Invalid or duplicate product-group record.');ids.add(g.id);}}
const api={validate,unit,compatible,groupFor,members,totals,validateItem,assign,save,merge,remove,suggestion,review,applyReview,automatic,breakdown,displayCategory,setMembers};if(typeof module!=='undefined')module.exports=api;else root.ProductGroups=api;
})(typeof window==='undefined'?globalThis:window);
