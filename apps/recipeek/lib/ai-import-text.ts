export function transcriptFirst(text:string){
  const value=text.trim();
  // A caption with amounts but no preparation cannot produce a complete recipe.
  // Acquire the existing transcript before spending a model call on that fragment.
  return !/mescol|cuoc|cuocer|cottura|tagli|aggiung|inforn|vers[ai]|friggi|boll|impast|frull|sciogl|rosol|condisci|riposa|lascia|amalgam|monta|scalda|mix|bake|cook|chop|stir|add\b|heat|combine|whisk|blend|simmer/i.test(value);
}
export function recipeTextWindow(text:string,limit=24000){
  if(text.length<=limit)return text;
  const heading=/^(?:#{1,6}\s*)?(?:ingredienti|ingredients)\b[^\n]{0,80}$/im.exec(text);
  const start=heading?Math.max(0,heading.index-300):0;
  return text.slice(start,start+limit);
}
