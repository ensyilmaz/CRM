'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const db=require('./src/db');
const {staff}=require('./src/seed');
const PORT=Number(process.env.PORT||3000);
const PUBLIC=path.join(__dirname,'public');
const TECH_USER=process.env.TECH_USERNAME||'teknik';
const TECH_PASS=process.env.TECH_PASSWORD||'Aa12345678';
const DETAIL_USER=process.env.DETAIL_USERNAME||'detay';
const DETAIL_PASS=process.env.DETAIL_PASSWORD||'detay';
const SESSION_MS=7*24*60*60*1000;
const attempts=new Map();
const categories=['clients','projects','work_types','statuses','work_modes'];
const stages=['Yeni','Görüşme','Teklif','Kazanıldı','Kaybedildi'];
const caseStatuses=['Açık','İşlemde','Beklemede','Tamamlandı'];
const taskStatuses=['Bekliyor','Devam Ediyor','Tamamlandı'];
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
class Problem extends Error{constructor(status,msg){super(msg);this.status=status}}
const fail=(n,m)=>{throw new Problem(n,m)};
const assert=(b,m='Geçersiz veri.',code=400)=>{if(!b)fail(code,m)};
const safeStr=(v,max=250)=>typeof v==='string'?v.trim().slice(0,max):'';
const required=(v,label,max=250)=>{const s=safeStr(v,max);assert(s.length>0,`${label} zorunludur.`);return s};
const isDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().startsWith(v);
const dateVal=(v,label,mandatory=true)=>{if(!v&&!mandatory)return null;assert(isDate(v),`${label} geçerli bir tarih olmalıdır.`);return v};
const now=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const hashes=(s)=>crypto.createHash('sha256').update(s).digest('hex');
function equalSecret(a,b){const a1=crypto.createHash('sha256').update(String(a)).digest(),b1=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(a1,b1)}
function cookies(req){const c={};String(req.headers.cookie||'').split(';').forEach(part=>{const idx=part.indexOf('=');if(idx>0)c[part.slice(0,idx).trim()]=part.slice(idx+1).trim()});return c}
function sessionCookie(req,token,clear=false){const secure=process.env.NODE_ENV==='production'||String(req.headers['x-forwarded-proto'])==='https';return `uniturk_session=${clear?'':token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:Math.floor(SESSION_MS/1000)}${secure?'; Secure':''}`;}
function tryRate(req){const addr=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim().slice(0,120);const key=addr||'unknown';const record=attempts.get(key)||{count:0,until:0};if(record.until>Date.now())fail(429,'Çok fazla hatalı giriş denemesi. Bir süre sonra yeniden deneyin.');return {key,record};}
function failRate(pair){const {key,record}=pair;record.count++;if(record.count>=12){record.until=Date.now()+15*60*1000;record.count=0;}attempts.set(key,record)}
async function getSession(req){const token=cookies(req).uniturk_session;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return db.one('SELECT role,owner,expires_at FROM sessions WHERE token_hash=? AND expires_at > ?',[hashes(token),now()]);}
function requireDetail(sess){assert(sess.role==='detay','Bu bölüm için detay yetkisi gerekiyor.',403)}
function sessionUser(sess){return sess.role==='detay'?{role:'detay',name:'Aleyna Topkara / Yönetim',owner:'Aleyna Topkara'}:{role:'teknik',name:sess.owner,owner:sess.owner}}
function validateOrigin(req){if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return;const origin=req.headers.origin;if(!origin)return;try{const u=new URL(origin);const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();assert(u.host===host,'İstek kaynağı doğrulanamadı.',403);}catch(e){if(e instanceof Problem)throw e;fail(403,'İstek kaynağı doğrulanamadı.')}}
async function getBody(req){let data='';for await(const c of req){data+=c;if(data.length>100_000)fail(413,'İstek boyutu çok büyük.')}try{return JSON.parse(data||'{}')}catch{fail(400,'JSON biçimi geçersiz.')}}
async function sendAsset(req,res,u){let name=u.pathname==='/'?'/index.html':u.pathname;let file=path.resolve(PUBLIC,'.'+decodeURIComponent(name));if(!file.startsWith(PUBLIC+path.sep))return fail(404,'Sayfa bulunamadı.');let stat;try{stat=fs.statSync(file)}catch{return fail(404,'Sayfa bulunamadı.')}if(!stat.isFile())return fail(404,'Sayfa bulunamadı.');const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Cache-Control':name.endsWith('.html')?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"});fs.createReadStream(file).pipe(res);}
async function route(req,res){
 const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`),p=url.pathname,m=req.method;
 if(p==='/health')return json(res,200,{ok:true,db:db.isPg?'postgres':'sqlite'});
 if(!p.startsWith('/api/')){if(m!=='GET'&&m!=='HEAD')fail(405,'İzin verilmiyor.');return sendAsset(req,res,url)}
 validateOrigin(req);
 if(p==='/api/login'&&m==='POST'){
   const limit=tryRate(req),body=await getBody(req),username=safeStr(body.username,100),password=String(body.password||'');let role=null,owner=null;
   if(username===TECH_USER&&equalSecret(password,TECH_PASS)){
     role='teknik';owner=safeStr(body.person,70);if(!['Salih Akkaya','Enes Yılmaz'].includes(owner))fail(400,'Salih Akkaya veya Enes Yılmaz çalışma alanını seçin.');
   }else if(username===DETAIL_USER&&equalSecret(password,DETAIL_PASS)){role='detay';owner='Aleyna Topkara';}
   if(!role){failRate(limit);fail(401,'Kullanıcı adı veya şifre hatalı.');}
   attempts.delete(limit.key);
   const token=crypto.randomBytes(32).toString('hex');
   await db.run('INSERT INTO sessions(token_hash,role,owner,expires_at,created_at) VALUES (?,?,?,?,?)',[hashes(token),role,owner,new Date(Date.now()+SESSION_MS).toISOString(),now()]);
   res.setHeader('Set-Cookie',sessionCookie(req,token));return json(res,200,{user:sessionUser({role,owner})});
 }
 const sess=await getSession(req);
 if(p==='/api/me'&&m==='GET')return json(res,200,{user:sess?sessionUser(sess):null});
 if(p==='/api/logout'&&m==='POST'){const token=cookies(req).uniturk_session;if(token)await db.run('DELETE FROM sessions WHERE token_hash=?',[hashes(token)]);res.setHeader('Set-Cookie',sessionCookie(req,'',true));return json(res,200,{ok:true});}
 if(!sess)fail(401,'Oturum açmanız gerekiyor.');
 if(p==='/api/staff'&&m==='GET')return json(res,200,{items:staff});
 if(p==='/api/options'&&m==='GET'){
   const rows=await db.all(sess.role==='detay'?'SELECT * FROM options ORDER BY sort_order ASC':'SELECT * FROM options WHERE is_private=0 ORDER BY sort_order ASC');
   return json(res,200,{items:rows});
 }
 if(p==='/api/entries'&&m==='GET'){
   const rows=await db.all(sess.role==='detay'?'SELECT * FROM entries ORDER BY work_date DESC,created_at DESC':'SELECT * FROM entries WHERE owner=? ORDER BY work_date DESC,created_at DESC',sess.role==='detay'?[]:[sess.owner]);return json(res,200,{items:rows});
 }
 if(p==='/api/entries'&&m==='POST'){
   const b=await getBody(req),obj=parseEntry(b,sess),id=uuid(),ts=now();
   await db.run('INSERT INTO entries(id,owner,work_date,client,project,work_type,hours,status,work_mode,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[id,obj.owner,obj.work_date,obj.client,obj.project,obj.work_type,obj.hours,obj.status,obj.work_mode,obj.notes,ts,ts]);return json(res,201,{id});
 }
 if(/^\/api\/entries\/[^/]+$/.test(p)&&['PUT','DELETE'].includes(m)){
   const id=p.split('/').pop(),row=await db.one('SELECT * FROM entries WHERE id=?',[id]);assert(row,'Kayıt bulunamadı.',404);assert(sess.role==='detay'||row.owner===sess.owner,'Bu kayıt için yetkiniz yok.',403);
   if(m==='DELETE'){await db.run('DELETE FROM entries WHERE id=?',[id]);return json(res,200,{ok:true})}
   const b=await getBody(req),e=parseEntry(b,sess,row.owner);await db.run('UPDATE entries SET owner=?,work_date=?,client=?,project=?,work_type=?,hours=?,status=?,work_mode=?,notes=?,updated_at=? WHERE id=?',[e.owner,e.work_date,e.client,e.project,e.work_type,e.hours,e.status,e.work_mode,e.notes,now(),id]);return json(res,200,{ok:true});
 }
 if(p==='/api/cases'&&m==='GET')return json(res,200,{items:await db.all('SELECT * FROM cases ORDER BY opened_on DESC,created_at DESC')});
 if(p==='/api/cases'&&m==='POST'){
   const b=parseCase(await getBody(req)),id=uuid(),ts=now();await db.run('INSERT INTO cases(id,name,assignee,opened_on,status,closed_on,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[id,b.name,b.assignee,b.opened_on,b.status,b.closed_on,ts,ts]);return json(res,201,{id});
 }
 if(/^\/api\/cases\/[^/]+$/.test(p)&&['PUT','DELETE'].includes(m)){
   const id=p.split('/').pop(),row=await db.one('SELECT id FROM cases WHERE id=?',[id]);assert(row,'Case bulunamadı.',404);
   if(m==='DELETE'){await db.run('DELETE FROM cases WHERE id=?',[id]);return json(res,200,{ok:true});}
   const b=parseCase(await getBody(req));await db.run('UPDATE cases SET name=?,assignee=?,opened_on=?,status=?,closed_on=?,updated_at=? WHERE id=?',[b.name,b.assignee,b.opened_on,b.status,b.closed_on,now(),id]);return json(res,200,{ok:true});
 }
 if(p==='/api/opportunities'&&m==='GET'){requireDetail(sess);return json(res,200,{items:await db.all('SELECT * FROM opportunities ORDER BY created_at DESC')});}
 if(p==='/api/opportunities'&&m==='POST'){requireDetail(sess);const b=parseOpportunity(await getBody(req)),id=uuid(),ts=now();await db.run('INSERT INTO opportunities(id,title,client,stage,estimated_hours,due_date,next_action,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,b.title,b.client,b.stage,b.estimated_hours,b.due_date,b.next_action,b.description,ts,ts]);return json(res,201,{id})}
 if(/^\/api\/opportunities\/[^/]+$/.test(p)&&['PUT','DELETE'].includes(m)){requireDetail(sess);const id=p.split('/').pop();assert(await db.one('SELECT id FROM opportunities WHERE id=?',[id]),'Fırsat bulunamadı.',404);if(m==='DELETE'){await db.run('DELETE FROM opportunities WHERE id=?',[id]);return json(res,200,{ok:true})}const b=parseOpportunity(await getBody(req));await db.run('UPDATE opportunities SET title=?,client=?,stage=?,estimated_hours=?,due_date=?,next_action=?,description=?,updated_at=? WHERE id=?',[b.title,b.client,b.stage,b.estimated_hours,b.due_date,b.next_action,b.description,now(),id]);return json(res,200,{ok:true})}
 if(p==='/api/tasks'&&m==='GET'){requireDetail(sess);return json(res,200,{items:await db.all('SELECT * FROM tasks ORDER BY created_at DESC')})}
 if(p==='/api/tasks'&&m==='POST'){requireDetail(sess);const b=parseTask(await getBody(req)),id=uuid(),ts=now();await db.run('INSERT INTO tasks(id,title,client,assignee,due_date,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[id,b.title,b.client,b.assignee,b.due_date,b.status,b.notes,ts,ts]);return json(res,201,{id})}
 if(/^\/api\/tasks\/[^/]+$/.test(p)&&['PUT','DELETE'].includes(m)){requireDetail(sess);const id=p.split('/').pop();assert(await db.one('SELECT id FROM tasks WHERE id=?',[id]),'İş bulunamadı.',404);if(m==='DELETE'){await db.run('DELETE FROM tasks WHERE id=?',[id]);return json(res,200,{ok:true})}const b=parseTask(await getBody(req));await db.run('UPDATE tasks SET title=?,client=?,assignee=?,due_date=?,status=?,notes=?,updated_at=? WHERE id=?',[b.title,b.client,b.assignee,b.due_date,b.status,b.notes,now(),id]);return json(res,200,{ok:true})}
 if(p==='/api/options'&&m==='POST'){requireDetail(sess);const b=parseOption(await getBody(req)),id=uuid();assert(!(await db.one('SELECT id FROM options WHERE category=? AND label=?',[b.category,b.label])),'Bu tanım zaten mevcut.');await db.run('INSERT INTO options(id,category,label,is_private,sort_order) VALUES (?,?,?,?,?)',[id,b.category,b.label,b.is_private,Date.now()]);return json(res,201,{id});}
 if(/^\/api\/options\/[^/]+$/.test(p)&&['PUT','DELETE'].includes(m)){requireDetail(sess);const id=p.split('/').pop(),row=await db.one('SELECT * FROM options WHERE id=?',[id]);assert(row,'Tanım bulunamadı.',404);if(m==='DELETE'){await db.run('DELETE FROM options WHERE id=?',[id]);return json(res,200,{ok:true})}const b=parseOption(await getBody(req));assert(!(await db.one('SELECT id FROM options WHERE category=? AND label=? AND id<>?',[b.category,b.label,id])),'Bu tanım zaten mevcut.');await db.run('UPDATE options SET category=?,label=?,is_private=? WHERE id=?',[b.category,b.label,b.is_private,id]);return json(res,200,{ok:true})}
 fail(404,'İstenen işlem bulunamadı.');
}
function parseEntry(b,sess,currentOwner){
 const owner=sess.role==='detay'?required(b.owner||currentOwner||'Aleyna Topkara','Personel',70):sess.owner;
 assert(staff.includes(owner),'Personel seçimi geçersiz.');
 const hours=Number(b.hours);assert(Number.isFinite(hours)&&hours>0&&hours<=24,'Süre 0 ile 24 saat arasında olmalıdır.');
 return {owner,work_date:dateVal(b.work_date,'Çalışma tarihi'),client:required(b.client,'Müşteri',120),project:required(b.project,'Proje',160),work_type:required(b.work_type,'Çalışma türü',120),hours,status:required(b.status,'Durum',100),work_mode:required(b.work_mode,'Çalışma şekli',60),notes:safeStr(b.notes,3000)};
}
function parseCase(b){
 const name=required(b.name,'Case adı',180),assignee=required(b.assignee,'İlgilenen',100),opened_on=dateVal(b.opened_on,'Case açılış tarihi'),status=required(b.status,'Durum',50);
 assert(caseStatuses.includes(status),'Geçersiz case durumu.');assert([...staff,'Yönetim'].includes(assignee),'İlgilenen seçimi geçersiz.');
 const closed_on=status==='Tamamlandı'?dateVal(b.closed_on,'Case kapanış tarihi'):null;
 if(closed_on)assert(closed_on>=opened_on,'Kapanış tarihi açılış tarihinden önce olamaz.');
 return {name,assignee,opened_on,status,closed_on};
}
function parseOpportunity(b){const stage=required(b.stage,'Aşama',50);assert(stages.includes(stage),'Aşama geçersiz.');const estimated_hours=Number(b.estimated_hours||0);assert(Number.isFinite(estimated_hours)&&estimated_hours>=0&&estimated_hours<=100000,'Tahmini efor geçersiz.');return {title:required(b.title,'Fırsat adı',180),client:required(b.client,'Müşteri',140),stage,estimated_hours,due_date:dateVal(b.due_date,'Takip tarihi',false),next_action:safeStr(b.next_action,500),description:safeStr(b.description,3000)};}
function parseTask(b){const status=required(b.status,'Durum',50);assert(taskStatuses.includes(status),'Durum geçersiz.');return {title:required(b.title,'İş adı',180),client:safeStr(b.client,140),assignee:safeStr(b.assignee,100),due_date:dateVal(b.due_date,'Termin tarihi',false),status,notes:safeStr(b.notes,3000)};}
function parseOption(b){const category=required(b.category,'Kategori',100);assert(categories.includes(category),'Kategori geçersiz.');return {category,label:required(b.label,'Tanım',160),is_private:category==='clients'&&b.is_private?1:0};}
async function start(){await db.connect();const server=http.createServer((req,res)=>route(req,res).catch(err=>{if(!res.headersSent){const code=err.status||500;if(code===500)console.error('SERVER ERROR',err);json(res,code,{error:code===500?'Beklenmeyen bir sunucu hatası oluştu.':err.message})}else res.destroy()}));server.listen(PORT,'0.0.0.0',()=>console.log(`Uniturk CRM: http://localhost:${PORT}`));return server;}
if(require.main===module)start().catch(e=>{console.error(e);process.exit(1)});
module.exports={start};
