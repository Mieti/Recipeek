import type {Database} from './repository.ts';
import {HttpError} from './http.ts';

export async function mappedProfile(db:Database,authId:string){return (await db.prepare('SELECT profile_id FROM external_identities WHERE auth_user_id=?').bind(authId).first<{profile_id:string}>())?.profile_id??null;}
export async function resolveProfile(db:Database,authId:string,displayName='Cuoco di casa'){
  const mapped=await mappedProfile(db,authId);if(mapped)return mapped;
  const id=`sb_${authId}`;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO profiles(id,name,bio,discoverable,created_at) VALUES (?,?,'',0,?)").bind(id,displayName.trim().length>=2?displayName.trim().slice(0,60):'Cuoco di casa',new Date().toISOString()),
    db.prepare('INSERT OR IGNORE INTO external_identities(auth_user_id,profile_id,created_at) VALUES (?,?,?)').bind(authId,id,new Date().toISOString()),
  ]);
  return (await mappedProfile(db,authId))!;
}
// Both identities must have been verified by their respective authentication
// services in this request. Email equality is deliberately not an ownership proof.
export async function linkLegacyProfile(db:Database,authId:string,legacyId:string){
  const existing=await mappedProfile(db,authId);
  if(existing&&existing!==legacyId)throw new HttpError(409,'Questo account ha già un ricettario distinto. Esportalo prima di scegliere come unire i dati.');
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO profiles(id,name,bio,discoverable,created_at) VALUES (?,'Cuoco di casa','',0,?)").bind(legacyId,new Date().toISOString()),
    db.prepare('INSERT OR IGNORE INTO external_identities(auth_user_id,profile_id,created_at) VALUES (?,?,?)').bind(authId,legacyId,new Date().toISOString()),
  ]);
  if(await mappedProfile(db,authId)!==legacyId)throw new HttpError(409,'Il ricettario è già associato a un altro account.');
  return legacyId;
}
