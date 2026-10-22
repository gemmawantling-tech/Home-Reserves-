(function(root){
'use strict';
const core=typeof module!=='undefined'?require('./inventory-core.js'):root.InventoryCore;
const recipes=typeof module!=='undefined'?require('./recipe-stock.js'):root.RecipeStock;
const known=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
function analyse(data,kitRows=[],{today=new Date()}={}){
 const items=data.items||[],categories=data.categories||[],result={low:[],uncounted:[],portions:[],noTargets:[],recipesMissing:[],recipesReview:[],kitLow:[],kitUncounted:[],expired:core.expiryItems(items,'expired',today),undated:core.expiryItems(items,'undated',today)};
 for(const item of items){if(!known(item.current))result.uncounted.push(item);else if(known(item.optimum)&&Number(item.optimum)>Number(item.current))result.low.push({...item,shortfall:Number(item.optimum)-Number(item.current)});if(!known(item.optimum))result.noTargets.push(item);if(categories.find(c=>c.id===item.category)?.type==='food'&&Number(item.current)>0&&!(Number(item.portionsPerPack)>0))result.portions.push(item);}
 for(const recipe of data.cookbook||[]){const checked=recipes.check(recipe,items,{today}),missing=checked.rows.filter(r=>r.status==='missing'||r.status==='short'),review=checked.rows.filter(r=>['unlinked','unknown','review'].includes(r.status));if(missing.length)result.recipesMissing.push({id:recipe.id,name:recipe.name,rows:missing});if(review.length)result.recipesReview.push({id:recipe.id,name:recipe.name,rows:review});}
 for(const row of kitRows){if(!known(row.target)||Number(row.target)<=0)continue;if(!known(row.current))result.kitUncounted.push(row);else if(Number(row.current)<Number(row.target))result.kitLow.push({...row,shortfall:Number(row.target)-Number(row.current)});}
 return result;
}
const api={analyse};if(typeof module!=='undefined')module.exports=api;else root.GapReview=api;
})(typeof window==='undefined'?globalThis:window);
