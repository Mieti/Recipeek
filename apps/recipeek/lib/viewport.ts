export function visibleViewport(layoutHeight:number,height:number,top:number,scale=1){
  return {height:Math.max(1,height),top:Math.max(0,top),keyboard:Math.abs(scale-1)<.05&&layoutHeight-height>120};
}
export function fieldScrollDelta(fieldTop:number,fieldBottom:number,visibleTop:number,visibleBottom:number){
  if(fieldBottom>visibleBottom)return Math.min(fieldBottom-visibleBottom,fieldTop-visibleTop);
  return fieldTop<visibleTop?fieldTop-visibleTop:0;
}
