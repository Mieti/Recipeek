export const signedOutEvent='recipeek:signed-out';
export const accountEventStorage='recipeek:account-event';
export const accountEventChannel='recipeek:account';
export function publishSignedOut(){
  try{window.localStorage.setItem(accountEventStorage,String(Date.now()));}catch{/* BroadcastChannel and same-tab event still work without storage. */}
  try{const channel=new BroadcastChannel(accountEventChannel);channel.postMessage('signed-out');channel.close();}catch{/* Storage events support browsers without BroadcastChannel. */}
  window.dispatchEvent(new Event(signedOutEvent));
}
