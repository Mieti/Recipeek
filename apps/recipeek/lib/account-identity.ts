import type {Database} from './repository.ts';
import {HttpError} from './http.ts';
import {confirmedIdentity,type LegacyAccount} from './auth-config.ts';

export type LegacyIdentity={userId:string;email:string};
type AuthIdentity={id:string;email?:string;email_confirmed_at?:string|null};

// Inputs come exclusively from the verified Auth user and the trusted Sites
// gateway. Never match email addresses taken from form data or user metadata.
export async function resolveAccountProfile(db:Database,user:AuthIdentity|null,legacy:LegacyIdentity|null=null,displayName='Cuoco di casa',configured:LegacyAccount|null=null){
  const identity=confirmedIdentity(user);if(!identity)return null;
  if(configured&&identity.id===configured.authId){
    if(!await db.prepare('SELECT 1 FROM profiles WHERE id=?').bind(configured.profileId).first())throw new HttpError(503,'Il ricettario precedente non è disponibile. Contatta l’assistenza.');
    return linkLegacyProfile(db,identity.id,configured.profileId);
  }
  if(legacy&&identity.email.trim().toLowerCase()===legacy.email.trim().toLowerCase())return linkLegacyProfile(db,identity.id,legacy.userId);
  return resolveProfile(db,identity.id,displayName);
}

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
// services in this request. Email equality alone is not an ownership proof.
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
