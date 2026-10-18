export function transcriptFirst(text:string){
  const value=text.trim();
  return !value||value.length<160&&!/\d|ingredient|mescol|cuoc|tagli|aggiung|inforn|vers|friggi|boll|mix|bake|cook|chop|stir|add\b/i.test(value);
}
export function recipeTextWindow(text:string,limit=24000){
  if(text.length<=limit)return text;
  const heading=/^(?:#{1,6}\s*)?(?:ingredienti|ingredients)\b[^\n]{0,80}$/im.exec(text);
  const start=heading?Math.max(0,heading.index-300):0;
  return text.slice(start,start+limit);
}
