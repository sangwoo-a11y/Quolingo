// Startup failures and auth races use local fixtures; no remote auth or data is contacted.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),prefix='/Quolingo/';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!pathname.startsWith(prefix))return res.writeHead(404).end();
 const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);});
});
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}${prefix}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-12T03:00:00Z')});
  await p.route('**/supabase-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.QUOLINGO_SUPABASE={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};"}));
  await p.route('**/vendor/supabase-2.118.0.js',r=>r.fulfill({contentType:'text/javascript',body:`
   window.fixtureUser=null;window.authSubscriptions=0;window.remoteReads=0;window.remoteWrites=0;
   window.supabase={createClient:()=>{
    if(localStorage.getItem('fixture-mode')==='construct-failure')throw Error('unavailable');
    return {auth:{onAuthStateChange:fn=>{if(localStorage.getItem('fixture-mode')==='subscribe-failure')throw Error('unavailable');window.authListener=fn;window.authSubscriptions++;},getSession:()=>{
     const mode=localStorage.getItem('fixture-mode');
     if(mode==='rejected')return Promise.reject(Error('offline'));
     if(mode==='signed'){window.fixtureUser={id:'${A}',email:'a@example.test'};return Promise.resolve({data:{session:{user:window.fixtureUser}}});}
     if(mode==='guest')return Promise.resolve({data:{session:null}});
     return new Promise(resolve=>{window.finishSession=resolve;});
    }},from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>{window.remoteReads++;return {data:{payload:JSON.parse(localStorage.getItem('quolingo-user:'+window.fixtureUser.id)),revision:1}};}})}),
    rpc:async()=>{window.remoteWrites++;throw Error('Unexpected write');}};
   }};` }));
  await p.goto(url);await p.evaluate(({A,B})=>{
   const journal=note=>({'2026-11-11':{'joshua-1':{sessions:{'1-1':{start:1,end:1,read:[1],completed:true,observation:note,interpretation:'meaning',application:'action'}}}}});
   const profile={name:'guest',qtBookId:'joshua',readingBookId:'joshua'};
   localStorage.setItem('quolingo-profile-v1',JSON.stringify(profile));localStorage.setItem('quolingo-chapters-v2',JSON.stringify(journal('GUEST_ONLY')));
   for(const [id,note] of [[A,'ACCOUNT_A_ONLY'],[B,'ACCOUNT_B_ONLY']])localStorage.setItem('quolingo-user:'+id,JSON.stringify({profile:{...profile,name:note},chapters:journal(note),reading:{},legacyEntries:{}}));
  },{A,B});await p.reload();
  const baseline=await p.evaluate(({A,B})=>({A:localStorage.getItem('quolingo-user:'+A),B:localStorage.getItem('quolingo-user:'+B),guest:localStorage.getItem('quolingo-chapters-v2')}),{A,B});
  await p.clock.runFor(9000);assert.equal(await p.locator('#cloud-boot').isVisible(),true);
  await p.clock.runFor(1100);assert.equal(await p.locator('#cloud-boot').isVisible(),false);assert.ok(await p.locator('.day-node').count()>0);assert.equal(await p.evaluate(()=>accountStore.owner),null);assert.equal(await p.evaluate(()=>window.remoteReads+window.remoteWrites),0);
  await p.locator('.nav[data-page=journal]').tap();assert.match(await p.locator('#content').textContent(),/GUEST_ONLY/);assert.doesNotMatch(await p.locator('#content').textContent(),/ACCOUNT_A_ONLY|ACCOUNT_B_ONLY/);
  await p.locator('.nav[data-page=account]').tap();assert.equal(await p.locator('[data-action=cloud-reconnect]').count(),1);
  await p.screenshot({path:'/tmp/quolingo-login-recovery.png'});
  await p.evaluate(()=>localStorage.setItem('fixture-mode','signed'));await p.locator('[data-action=cloud-reconnect]').tap();await p.waitForFunction(()=>cloudAccount.status==='synced');
  assert.equal(await p.evaluate(()=>window.authSubscriptions),1);assert.equal(await p.evaluate(()=>accountStore.owner),A);
  await p.locator('.nav[data-page=journal]').tap();assert.match(await p.locator('#content').textContent(),/ACCOUNT_A_ONLY/);assert.doesNotMatch(await p.locator('#content').textContent(),/GUEST_ONLY|ACCOUNT_B_ONLY/);
  await p.evaluate(()=>window.finishSession({data:{session:null}}));assert.equal(await p.evaluate(()=>accountStore.owner),A);
  // A failed recheck retains an already verified account and can reconnect.
  await p.evaluate(()=>{localStorage.setItem('fixture-mode','rejected');void cloudAccount.init();});await p.waitForFunction(()=>cloudAccount.status==='session-error');assert.equal(await p.evaluate(()=>accountStore.owner),A);
  await p.locator('.nav[data-page=account]').tap();await p.evaluate(()=>localStorage.setItem('fixture-mode','signed'));await p.locator('[data-action=cloud-reconnect]').tap();await p.waitForFunction(()=>cloudAccount.status==='synced');assert.equal(await p.evaluate(()=>window.authSubscriptions),1);
  // A verified auth event arriving before a stalled getSession timeout must win.
  await p.evaluate(()=>localStorage.removeItem('fixture-mode'));await p.reload();
  await p.evaluate(A=>{window.fixtureUser={id:A,email:'a@example.test'};window.authListener('SIGNED_IN',{user:window.fixtureUser});},A);await p.clock.runFor(1);await p.waitForFunction(()=>cloudAccount.status==='synced');await p.clock.runFor(11000);assert.equal(await p.evaluate(()=>accountStore.owner),A);assert.equal(await p.evaluate(()=>cloudAccount.status),'synced');assert.equal(await p.locator('#cloud-boot').isVisible(),false);
  await p.evaluate(()=>window.finishSession({data:{session:null}}));assert.equal(await p.evaluate(()=>accountStore.owner),A);
  // Network restoration confirms the session before using an account's records.
  await p.reload();await p.clock.runFor(10100);assert.equal(await p.evaluate(()=>accountStore.owner),null);
  await p.evaluate(()=>{localStorage.setItem('fixture-mode','signed');window.dispatchEvent(new Event('online'));});await p.waitForFunction(()=>cloudAccount.status==='synced');assert.equal(await p.evaluate(()=>accountStore.owner),A);
  // Rejection and client construction errors also show the home without discarding data.
  for(const mode of ['rejected','subscribe-failure','construct-failure']){
   await p.evaluate(mode=>localStorage.setItem('fixture-mode',mode),mode);await p.reload();await p.waitForFunction(()=>!!document.querySelector('.day-node'));assert.equal(await p.locator('#cloud-boot').isVisible(),false);assert.equal(await p.evaluate(()=>accountStore.owner),null);
  }
  assert.deepEqual(await p.evaluate(({A,B})=>({A:localStorage.getItem('quolingo-user:'+A),B:localStorage.getItem('quolingo-user:'+B),guest:localStorage.getItem('quolingo-chapters-v2')}),{A,B}),baseline);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS: renamed /Quolingo/ startup, bounded session wait, usable guest home, untouched account/guest caches, explicit retry, single subscription, stale result/timeout protection, online recovery and rejected/throwing auth startup.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
