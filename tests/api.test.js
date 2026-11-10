'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const PORT=47913,ROOT=`http://127.0.0.1:${PORT}`;
let server,dir;
async function request(url,{method='GET',body,cookie}={}){
 const response=await fetch(ROOT+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
 const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(username,password,person){const r=await request('/api/login',{method:'POST',body:{username,password,person}});assert.equal(r.status,200,JSON.stringify(r.data));return r.cookie}
const newCase={name:'VPN Erişim Sorunu',assignee:'Salih Akkaya',opened_on:'2026-11-10',status:'Açık'};
test.before(async()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'uniturk-test-'));server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(PORT),UNITURK_SQLITE_FILE:path.join(dir,'test.sqlite'),DATABASE_URL:'',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});let ready=false;for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));try{if((await request('/health')).status===200){ready=true;break}}catch{}}if(!ready)throw Error('Test sunucusu başlatılamadı.')});
test.after(()=>{server?.kill();fs.rmSync(dir,{recursive:true,force:true})});
test('Giriş ve erişim kontrolleri, örnek veri',async()=>{
 const bad=await request('/api/login',{method:'POST',body:{username:'teknik',password:'hatalı',person:'Salih Akkaya'}});assert.equal(bad.status,401);
 const anon=await request('/api/cases');assert.equal(anon.status,401);
 const salih=await login('teknik','Aa12345678','Salih Akkaya');
 const enes=await login('teknik','Aa12345678','Enes Yılmaz');
 const detail=await login('detay','detay');
 const se=await request('/api/entries',{cookie:salih});assert.equal(se.status,200);assert.equal(se.data.items.length,1);assert.ok(se.data.items.every(e=>e.owner==='Salih Akkaya'));
 const ee=await request('/api/entries',{cookie:enes});assert.ok(ee.data.items.every(e=>e.owner==='Enes Yılmaz'));
 const d=await request('/api/entries',{cookie:detail});assert.equal(d.data.items.length,3);assert.equal(d.data.items.reduce((n,e)=>n+e.hours,0),15);
 assert.equal((await request('/api/opportunities',{cookie:salih})).status,403);
 assert.equal((await request('/api/tasks',{cookie:salih})).status,403);
 assert.equal((await request('/api/options',{method:'POST',cookie:salih,body:{label:'Gizli',category:'clients'}})).status,403);
 const cross=await request(`/api/entries/${ee.data.items[0].id}`,{method:'PUT',cookie:salih,body:{work_date:'2026-11-10',client:'Yeşilay',project:'Genel Destek',work_type:'Toplantı',hours:1,status:'Devam Ediyor',work_mode:'Yerinde'}});assert.equal(cross.status,403);
 const asSalih=await request('/api/entries',{method:'POST',cookie:salih,body:{owner:'Aleyna Topkara',work_date:'2026-11-10',client:'Yeşilay',project:'Genel Destek',work_type:'Toplantı',hours:1.5,status:'Devam Ediyor',work_mode:'Yerinde'}});assert.equal(asSalih.status,201);const check=await request('/api/entries',{cookie:salih});assert.equal(check.data.items.length,2);assert.ok(check.data.items.every(e=>e.owner==='Salih Akkaya'));
 const c1=await request('/api/cases',{method:'POST',cookie:salih,body:newCase});assert.equal(c1.status,201);const c_id=c1.data.id;
 const visible=await request('/api/cases',{cookie:detail});assert.ok(visible.data.items.some(c=>c.id===c_id));
 const noDate=await request(`/api/cases/${c_id}`,{method:'PUT',cookie:enes,body:{...newCase,status:'Tamamlandı'}});assert.equal(noDate.status,400);
 const early=await request(`/api/cases/${c_id}`,{method:'PUT',cookie:detail,body:{...newCase,status:'Tamamlandı',closed_on:'2026-11-09'}});assert.equal(early.status,400);
 const yes=await request(`/api/cases/${c_id}`,{method:'PUT',cookie:detail,body:{...newCase,status:'Tamamlandı',closed_on:'2026-11-11'}});assert.equal(yes.status,200);
 const after=await request('/api/cases',{cookie:enes});assert.equal(after.data.items.find(c=>c.id===c_id).closed_on,'2026-11-11');
 const reopen=await request(`/api/cases/${c_id}`,{method:'PUT',cookie:salih,body:newCase});assert.equal(reopen.status,200);assert.equal((await request('/api/cases',{cookie:detail})).data.items.find(c=>c.id===c_id).closed_on,null);
 const options=await request('/api/options',{cookie:detail});assert.ok(options.data.items.length>=25);
 const privateOpt=await request('/api/options',{method:'POST',cookie:detail,body:{category:'clients',label:'Özel Test Müşterisi',is_private:true}});assert.equal(privateOpt.status,201);
 const techOptions=await request('/api/options',{cookie:salih});assert.ok(!techOptions.data.items.some(x=>x.label==='Özel Test Müşterisi'));
 const detOptions=await request('/api/options',{cookie:detail});assert.ok(detOptions.data.items.some(x=>x.label==='Özel Test Müşterisi'));
 const opp=await request('/api/opportunities',{method:'POST',cookie:detail,body:{title:'Yeni SD-WAN',client:'Özel Test Müşterisi',stage:'Yeni',estimated_hours:8}});assert.equal(opp.status,201);assert.equal((await request('/api/opportunities',{cookie:detail})).data.items.length,1);
 const task=await request('/api/tasks',{method:'POST',cookie:detail,body:{title:'Keşif planla',client:'Yeşilay',status:'Bekliyor'}});assert.equal(task.status,201);
 assert.equal((await request('/api/logout',{method:'POST',cookie:salih})).status,200);assert.equal((await request('/api/entries',{cookie:salih})).status,401);
});
