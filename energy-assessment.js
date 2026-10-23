/* Conservative energy ledger. No record mutations or nutrition guesses. */
(function(root){'use strict';
const F=typeof module!=='undefined'?require('./food-coverage.js'):root.FoodCoverage;
const B=typeof module!=='undefined'?require('./stock-batches.js'):root.StockBatches;
const C=typeof module!=='undefined'?require('./inventory-core.js'):root.InventoryCore;
const L=typeof module!=='undefined'?require('./product-lookup.js'):root.ProductLookup;
const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
function requirements(s={}){const members=Array.isArray(s.energyMembers)?s.energyMembers:[];const valid=members.length>0&&members.length===Number(s.people||4)&&members.every(m=>m&&num(m.kcal)>0);return valid?{daily:members.reduce((n,m)=>n+Number(m.kcal),0),members,source:'Your per-person planning targets'}:{daily:num(s.householdKcal)>0?Number(s.householdKcal):(Number(s.people)>0?Number(s.people):4)*2000,members:[],source:num(s.householdKcal)>0?'Your household override':'Provisional 2,000 kcal × household size',needsMembers:true};}
function energy(n,key){const kcal=num(n['energy-kcal_'+key]),kj=num(n['energy-kj_'+key]);if(kcal!==null)return kcal;if(kj!==null)return kj/4.184;const raw=num(n['energy_'+key]);return raw!==null&&['kj','kcal'].includes(n.energy_unit)?raw/(n.energy_unit==='kj'?4.184:1):null;}
function unitEnergy(i){
 const n=i.nutrition||{},m=F.measure(i),a=i.foodAssessment||{},method=a.method||'auto',basis=a.stockBasis,nb=a.nutritionBasis;
 if(basis&&nb&&basis!==nb)return {reason:'Stock and nutrition use different dry / prepared / drained bases. Enter matching label values.'};
 if(nb==='unknown'||basis==='unknown')return {reason:'Confirm whether the weights and calories describe dry, prepared or drained food.'};
 const knownBasis=!!basis&&basis===nb;
 const unit=num(i.kcalPerUnit),serving=energy(n,'serving'),per100=num(a.labelPer100)??energy(n,knownBasis&&nb==='prepared'&&energy(n,'prepared_100g')!==null?'prepared_100g':'100g');
 if(method==='unit'||(method==='auto'&&unit!==null))return unit===null?{reason:'Calories per counted stock unit missing.'}:{each:unit,arithmetic:unit+' kcal per '+(i.unit||'unit'),knownBasis};
 if(method==='servings'){
  if(m?.loose)return {reason:'For loose grams / kg / litres, use matching per-100 nutrition or a measured serving size.'};
  const servings=num(i.portionsPerPack),servingSize=L.metricAmount(i.servingSize);if(m&&servingSize?.unit===m.unit&&servings*servingSize.value>(num(a.edibleSize)??m.size)+1e-8)return {reason:'Label serving count exceeds the edible pack size. Correct the count or serving weight.'};return serving!==null&&servings>0?{each:serving*servings,arithmetic:servings+' label servings × '+serving+' kcal per serving',knownBasis}:{reason:'Enter label servings per pack and calories per serving.'};
 }
 if(!m)return {reason:'Pack weight / volume missing. Enter it, or use label servings or whole-unit calories.'};
 const edible=num(a.edibleSize),fraction=num(a.edibleFraction)??1;
 if(edible!==null&&(edible<=0||m.loose||edible>m.size))return {reason:'Edible size must be positive, no greater than the pack size, and measured in the same units.'};
 if(!(fraction>0&&fraction<=1))return {reason:'Edible fraction must be above zero and no greater than one.'};
 const size=(m.loose?m.size*fraction:edible??m.size);
 if(per100!==null&&method!=='servingWeight')return {each:per100*size/100,arithmetic:size+' '+m.unit+' edible × '+per100+' kcal per 100'+m.unit+' ÷ 100',knownBasis};
 const ss=L.metricAmount(i.servingSize)||((num(i.servingWeight)>0&&['g','ml'].includes(i.servingUnit))?{value:Number(i.servingWeight),unit:i.servingUnit}:null);
 return serving!==null&&ss&&ss.unit===m.unit?{each:serving*size/ss.value,arithmetic:size+' '+m.unit+' ÷ '+ss.value+' '+m.unit+' per serving × '+serving+' kcal',knownBasis}:{reason:serving!==null?'Serving weight / volume missing or incompatible with the stock unit.':'Calories per 100g / 100ml or per serving missing.'};
}
function assess(data,today=new Date().toISOString().slice(0,10)){
 const req=requirements(data.settings),rows=[],seen=new Set();let verified=0,estimatedExtra=0,noCookMeals=0;const mealTypes=new Set();
 for(const i of data.items||[]){
 const row={id:i.id,name:i.name,unit:i.unit||'units',recorded:num(i.current),category:i.category,kind:'unassessed',kcal:null,quantity:0};
 // Repeated record IDs cannot inflate stock; distinct IDs remain visible even if barcodes match.
 if(i.id&&seen.has(i.id)){rows.push({...row,kind:'excluded',reason:'Duplicate record ID excluded. Review inventory; no records were deleted.'});continue;}if(i.id)seen.add(i.id);
 if(!F.eligible(i,data)){rows.push({...row,kind:'excluded',reason:'Water, alcohol or a non-food category; not included in food energy.'});continue;}
 if(row.recorded===null){rows.push({...row,reason:'Stock quantity missing or invalid.'});continue;}
 if(row.recorded===0){rows.push({...row,kind:'excluded',reason:'No recorded stock.'});continue;}
 let batches;try{batches=B.read(i);}catch{rows.push({...row,reason:'Batch quantities are invalid. Review batches.'});continue;}
 const dated=batches.map(b=>{let date='';try{date=C.parseExpiry(b.expiry);}catch{}return {...b,date};});
 const q=Math.min(row.recorded,dated.filter(b=>!b.date||b.date>=today).reduce((s,b)=>s+b.quantity,0));row.quantity=q;row.expired=row.recorded-q;row.undated=dated.filter(b=>!b.date).reduce((s,b)=>s+b.quantity,0);
 if(!q){rows.push({...row,kind:'excluded',reason:'All recorded stock is past its date. Review expiry batches.'});continue;}
 if(aReady(i)){row.noCookPortions=q*Number(i.portionsPerPack);noCookMeals+=row.noCookPortions;mealTypes.add(i.id);}
 const calc=unitEnergy(i),a=i.foodAssessment||{},estimate=a.estimate||{};
 let each=calc.each,source=a.source||i.source||'Existing household record; label not yet checked',confidence='Not label-confirmed',assumptions=calc.knownBasis?'Weights and nutrition use the same recorded basis.':'Assumes the label applies to the food as stocked; dry / prepared / drained basis not yet confirmed.';
 if(each===undefined){
  const e=num(estimate.kcalPerUnit);
  if(estimate.enabled&&e!==null&&String(estimate.source||'').trim()&&String(estimate.assumptions||'').trim()&&['low','medium'].includes(estimate.confidence)){each=e;source=estimate.source;assumptions=estimate.assumptions;confidence=estimate.confidence;row.manualEstimate=true;row.labelIssue=calc.reason;}
  else{rows.push({...row,reason:calc.reason});continue;}
 }
 if(!Number.isFinite(each)||each<0){rows.push({...row,reason:'Invalid energy value. Check the label.'});continue;}
 const isVerified=!row.manualEstimate&&a.reviewed===true&&a.reviewSignature===signature(i)&&calc.knownBasis&&String(a.source||'').trim();
 row.kind=isVerified?'verified':'estimated';row.kcal=each*q;row.each=each;row.source=source;row.confidence=isVerified?'Label and basis checked by you':confidence;row.assumptions=assumptions;row.arithmetic=q+' '+row.unit+' × ('+(row.manualEstimate?each+' estimated kcal per stock unit':calc.arithmetic)+') = '+row.kcal+' kcal';
 if(isVerified)verified+=row.kcal;else estimatedExtra+=row.kcal;

 rows.push(row);
 }
 const remaining=rows.filter(r=>r.kind==='unassessed'),eligibleRows=rows.filter(r=>r.kind!=='excluded');
 remaining.sort((a,b)=>{const impact=r=>{const i=data.items.find(i=>i.id===r.id),m=F.measure(i||{});return (m?m.size:0)*(r.recorded||0);};return impact(b)-impact(a)||(b.recorded||0)-(a.recorded||0);});
 const legacy=F.analyse(data,today),total=verified+estimatedExtra;const preparationUnassessed=eligibleRows.filter(r=>{const a=data.items.find(i=>i.id===r.id)?.foodAssessment||{};return [a.readyToEat,a.requiresWater,a.requiresHeat,a.requiresCooking].some(v=>typeof v!=='boolean');}).length;
 return {rows,remaining,verified,estimatedExtra,total,daily:req.daily,requirements:req,verifiedDays:verified/req.daily,estimatedDays:total/req.daily,noCookMeals,preparationUnassessed,mealVariety:mealTypes.size,assessed:eligibleRows.length-remaining.length,foodTypes:eligibleRows.length,legacy,goal:num(data.settings?.reserveDays),duplicateBarcodes:duplicateCodes(data.items||[])};
}
function signature(i){return JSON.stringify([i.unit,i.packSize,i.packUnit,i.portionsPerPack,i.servingSize,i.servingWeight,i.servingUnit,i.kcalPerUnit,i.nutrition,i.foodAssessment?.labelPer100,i.foodAssessment?.method,i.foodAssessment?.stockBasis,i.foodAssessment?.nutritionBasis,i.foodAssessment?.edibleSize,i.foodAssessment?.edibleFraction]);}
function aReady(i){const a=i.foodAssessment||{};return a.readyToEat===true&&a.requiresWater===false&&a.requiresHeat===false&&a.requiresCooking===false&&a.mealConfirmed===true&&i.portionType==='meal'&&num(i.portionsPerPack)>0;}
function duplicateCodes(items){const codes=new Map();for(const i of items){if(!i.barcode)continue;try{const code=C.barcode(i.barcode);if(!codes.has(code))codes.set(code,[]);codes.get(code).push(i.id);}catch{}}return [...codes.values()].filter(ids=>ids.length>1);}
const api={assess,requirements,unitEnergy,signature};if(typeof module!=='undefined')module.exports=api;else root.EnergyAssessment=api;
})(typeof window==='undefined'?globalThis:window);
