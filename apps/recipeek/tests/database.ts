import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { Database } from '../lib/repository.ts';

export function fixture(){
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));
  sqlite.exec("INSERT INTO profiles (id,name,created_at) VALUES ('alice','Alice','2026'),('bob','Bob','2026')");
  function prepare(sql:string,params:unknown[]=[]):unknown { return {bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...params as [])??null,all:async()=>({results:sqlite.prepare(sql).all(...params as [])}),run:async()=>{const result=sqlite.prepare(sql).run(...params as []);return {meta:{changes:Number(result.changes)}};}}; }
  const db = {prepare,batch:async(statements:{run:()=>Promise<unknown>}[])=>{sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as Database;
  return {db,sqlite};
}