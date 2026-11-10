'use strict';
const { randomUUID }=require('node:crypto');
const path=require('node:path');
const fs=require('node:fs');
const seed=require('./seed');
const isPg=!!process.env.DATABASE_URL;
let client;
let sqlite;

async function connect(){
  if(isPg){
    const {Pool}=require('pg');
    client=new Pool({connectionString:process.env.DATABASE_URL,max:8,ssl:process.env.DATABASE_URL.includes('localhost')?false:undefined});
    await client.query('SELECT 1');
  }else{
    // Yerel çalıştırmada Node 22 yerleşik SQLite; Render üzerinde PostgreSQL zorunlu.
    if(process.env.NODE_ENV==='production') throw Error('DATABASE_URL tanımlı değil. Render için kalıcı PostgreSQL bağlantısı gereklidir.');
    const {DatabaseSync}=require('node:sqlite');
    const file=process.env.UNITURK_SQLITE_FILE||path.join(__dirname,'..','.data','uniturk.sqlite');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    sqlite=new DatabaseSync(file);
    sqlite.exec('PRAGMA journal_mode=WAL');
    sqlite.exec('PRAGMA foreign_keys=ON');
  }
  await initialize();
}
async function all(sql,values=[]){
  if(isPg){let i=0;return (await client.query(sql.replace(/\?/g,()=>`$${++i}`),values)).rows;}
  return sqlite.prepare(sql).all(...values);
}
async function one(sql,values=[]){return (await all(sql,values))[0]||null;}
async function run(sql,values=[]){
  if(isPg){let i=0;return (await client.query(sql.replace(/\?/g,()=>`$${++i}`),values)).rowCount;}
  return sqlite.prepare(sql).run(...values).changes;
}
async function initialize(){
  const schema=[
    `CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, owner TEXT NOT NULL, work_date TEXT NOT NULL, client TEXT NOT NULL, project TEXT NOT NULL, work_type TEXT NOT NULL, hours REAL NOT NULL, status TEXT NOT NULL, work_mode TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS options (id TEXT PRIMARY KEY, category TEXT NOT NULL, label TEXT NOT NULL, is_private INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL, stage TEXT NOT NULL, estimated_hours REAL NOT NULL DEFAULT 0, due_date TEXT, next_action TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL DEFAULT '', assignee TEXT NOT NULL DEFAULT '', due_date TEXT, status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, name TEXT NOT NULL, assignee TEXT NOT NULL, opened_on TEXT NOT NULL, status TEXT NOT NULL, closed_on TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, owner TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_entries_owner_date ON entries(owner,work_date)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`
  ];
  for(const s of schema)await run(s);
  const seeded=await one("SELECT value FROM metadata WHERE key='initial_seed'");
  if(!seeded){
    const existingOptions=await one('SELECT id FROM options LIMIT 1');
    const existingEntries=await one('SELECT id FROM entries LIMIT 1');
    if(!existingOptions&&!existingEntries){
    let rank=0;
    for(const [category,labels] of Object.entries(seed.categories)){
      for(const label of labels)await run('INSERT INTO options (id,category,label,is_private,sort_order) VALUES (?,?,?,?,?)',[randomUUID(),category,label,0,rank++]);
    }
    const now=new Date().toISOString();
    for(const e of seed.entries)await run('INSERT INTO entries(id,owner,work_date,client,project,work_type,hours,status,work_mode,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [randomUUID(),e.owner,e.work_date,e.client,e.project,e.work_type,e.hours,e.status,e.work_mode,e.notes,now,now]);
    }
    await run('INSERT INTO metadata (key,value) VALUES (?,?)',['initial_seed','1']);
  }
}
async function close(){if(client)await client.end();if(sqlite)sqlite.close();}
module.exports={connect,all,one,run,close,isPg};
