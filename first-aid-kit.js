(function(root){
'use strict';
// Practical household starter targets, not prescribed or official kit quantities.
const supplies=[
 ['plasters','Dressings and bandages','Assorted waterproof plasters',20,'plasters','A mix of sizes; check skin sensitivity.'],
 ['gauze','Dressings and bandages','Sterile gauze / wound dressings',6,'dressings','Mix small, medium and large; replace opened or damaged sterile packs.'],
 ['eye','Dressings and bandages','Sterile eye dressings',2,'dressings','Keep sealed; follow first-aid guidance for eye injuries.'],
 ['triangular','Dressings and bandages','Triangular bandages',2,'bandages','For use with first-aid guidance.'],
 ['crepe','Dressings and bandages','Crêpe / roller bandages',2,'rolls','Different widths are useful.'],
 ['tape','Dressings and bandages','Medical adhesive tape',1,'roll','For securing dressings.'],
 ['pins','Dressings and bandages','Safety pins',6,'pins','Store securely away from children.'],
 ['gloves','Cleaning and protection','Disposable gloves (latex-free)',5,'pairs','Count pairs, not individual gloves.'],
 ['wipes','Cleaning and protection','Alcohol-free cleansing wipes',10,'wipes','Follow pack instructions.'],
 ['water','Cleaning and protection','Sterile water / saline for wound cleaning',2,'sealed containers','Choose wound-cleansing products and follow their instructions.'],
 ['scissors','Tools and information','Blunt-ended first-aid scissors',1,'pair','Store safely.'],
 ['tweezers','Tools and information','Tweezers',1,'pair','Keep clean.'],
 ['thermometer','Tools and information','Digital thermometer',1,'thermometer','Keep instructions and a working battery.'],
 ['guide','Tools and information','Current first-aid guide',1,'guide','Keep a paper copy; practise basic first-aid skills.'],
 ['contacts','Tools and information','Emergency contacts and medicine record',1,'copy','Record relevant allergies, products and doses actually given; keep private.'],
 ['box','Tools and information','Secure labelled first-aid storage box',1,'box','Keep supplies cool and dry; medicines and sharp tools out of children’s reach.'],
 ['paracetamol','Medicines — check with a pharmacist','Age-appropriate paracetamol',null,'packs','Ask a pharmacist about formulations for ages 9 and 12 and any adults. Follow each product label; avoid duplicate paracetamol-containing products.'],
 ['ibuprofen','Medicines — check with a pharmacist','Age-appropriate ibuprofen, if suitable',null,'packs','Check suitability and formulation with a pharmacist. Do not give to a child who is dehydrated or has chickenpox.'],
 ['antihistamine','Medicines — check with a pharmacist','Age-appropriate antihistamine / bite treatment, if suitable',null,'packs','Ask a pharmacist to choose an age-appropriate product; do not assume adult products suit both boys.'],
 ['syringe','Medicines — check with a pharmacist','Oral dosing syringe / supplied medicine measure',null,'measures','Use the measure supplied or recommended for that medicine, never a kitchen teaspoon.']
].map(([id,group,name,target,unit,note])=>({id,group,name,target,unit,note,current:null,expiry:''}));
function get(data){const saved=data.firstAidKit;return {profile:saved?.profile||'Family household — boys aged 12 and 9, with no health conditions reported.',checkedAt:saved?.checkedAt||'',rows:supplies.map(row=>{const old=saved?.rows?.find(r=>r.id===row.id);return {...row,...(old?{current:old.current,target:old.target,expiry:old.expiry}:{} )};})};}
function save(data,rows){const next=JSON.parse(JSON.stringify(data));const clean=supplies.map(base=>{const row=rows.find(r=>r.id===base.id);if(!row)throw Error('A checklist row is missing. Reopen the kit.');for(const key of ['current','target'])if(row[key]!==null&&(!Number.isInteger(row[key])||row[key]<0||row[key]>100000))throw Error('Use a whole number of items, or leave it blank.');return {id:base.id,current:row.current,target:row.target,expiry:row.expiry||''};});next.firstAidKit={...get(data),rows:clean,checkedAt:new Date().toISOString()};return next;}
const api={get,save,supplies};if(typeof module!=='undefined')module.exports=api;else root.FirstAidKit=api;
})(typeof window==='undefined'?globalThis:window);
