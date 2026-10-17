export type StepTap={x:number;y:number;time:number;scroll:number};
// A tap is not a scroll, pinch, long press, text selection or control activation.
export function stepTapDirection(start:StepTap,end:StepTap,width:number,blocked=false):'previous'|'next'|null {
  if(blocked||width<=0||end.time-start.time>550||end.time<start.time||Math.hypot(end.x-start.x,end.y-start.y)>12||Math.abs(end.scroll-start.scroll)>4)return null;
  if(end.x<width*.32)return 'previous';if(end.x>width*.68)return 'next';return null;
}
export function adjacentStep(index:number,count:number,direction:'previous'|'next'){return Math.max(0,Math.min(count-1,index+(direction==='next'?1:-1)));}
