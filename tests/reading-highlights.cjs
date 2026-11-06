// Local Bible text and browser storage only; no real auth, sharing or database calls.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-06T03:00:00Z')});
  await p.route('**/supabase-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.QUOLINGO_SUPABASE={};'}));
  await p.goto(url);await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'기록 테스트',bookId:'joshua',theme:'sky'}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-11-05':{'joshua-1':{sessions:{'1-2':{start:1,end:2,read:[1,2],observation:'이전 관찰',interpretation:'이전 해석',application:'이전 적용',completed:true}}}}}));
  });await p.reload();
  const nav=id=>p.locator(`.nav[data-page=${id}]`).tap();
  const open=async mode=>{await nav('home');await p.locator(`[data-mode=${mode}]`).tap();await p.locator('.day-node[data-date="2026-11-06"]').tap();};
  const choose=async(mode,book,id)=>{await open(mode);await p.locator(mode==='qt'?'#qt-book-select':'#word-book-select').selectOption(book);await p.locator(mode==='qt'?'#chapter-select':'#word-chapter').selectOption(id);await p.locator(mode==='qt'?'#passage-selection [type=submit]':'#word-selection [type=submit]').tap();};
  const mark=start=>p.locator(`[data-action=select-verse][data-start="${start}"]`);
  const recordVerse=async start=>{if(await mark(start).getAttribute('aria-expanded')!=='true')await mark(start).tap();await p.locator(`[data-action=record-verse][data-start="${start}"]`).tap();await p.locator('[data-action=save-verse-record]').tap();};
  const marked=async start=>mark(start).evaluate(el=>el.closest('.verse-row').classList.contains('is-highlighted'));
  const saved=await p.evaluate(()=>({total:allTimeCount(),streak:streak(),qt:JSON.stringify(data)}));
  await nav('account');assert.equal(await p.locator('#qt-book,#reading-book').count(),0);
  await open('qt');assert.equal(await p.locator('#qt-book-select option').count(),66);assert.equal(await p.locator('#qt-book-select optgroup[label=구약] option').count(),39);
  await p.locator('#qt-book-select').selectOption('john');await p.locator('#chapter-select').selectOption('john-3');await p.locator('#start-verse').selectOption('16');await p.locator('#end-verse').selectOption('16');await p.locator('#passage-selection [type=submit]').tap();assert.equal(await p.locator('.verse-row').count(),1);assert.equal(await p.locator('.verse-bookmark').count(),0);
  await open('reading');assert.equal(await p.locator('#word-book-select').inputValue(),'joshua');assert.equal(await p.locator('#word-book-select option').count(),66);await p.locator('#word-book-select').selectOption('malachi');assert.equal(await p.locator('#word-chapter').inputValue(),'malachi-1');await p.locator('#word-chapter').selectOption('malachi-4');await p.locator('#word-selection [type=submit]').tap();
  await p.locator('[data-action=next-chapter]').tap();assert.equal(await p.locator('.chapter-title').textContent(),'마태복음 1장');assert.equal(await p.evaluate(()=>profile.readingBookId),'matthew');await p.locator('[data-action=previous-chapter]').tap();assert.equal(await p.evaluate(()=>selected),'malachi-4');await p.goBack();await p.waitForFunction(()=>selected==='matthew-1');
  assert.equal(await p.evaluate(()=>allTimeCount()),saved.total);assert.equal(await p.evaluate(()=>readChapters().length),0);
  await choose('reading','genesis','genesis-1');assert.equal(await p.locator('[data-action=previous-chapter]').isDisabled(),true);
  await choose('reading','revelation','revelation-22');assert.equal(await p.locator('[data-action=next-chapter]').isDisabled(),true);
  // The two book defaults remain independent and survive account save/reload.
  await nav('account');await p.locator('#account-form [type=submit]').tap();await p.reload();assert.deepEqual(await p.evaluate(()=>[profile.qtBookId,profile.readingBookId]),['john','revelation']);
  await choose('reading','john','john-3');const verse=await p.locator('.verse-row').filter({has:mark('16')}).locator('.verse-text').textContent();
  assert.equal(await p.locator('[data-action=record-verse]:visible').count(),0);
  await mark('16').tap();assert.equal(await mark('16').getAttribute('aria-expanded'),'true');assert.equal(await p.locator('[data-action=record-verse]:visible').count(),1);assert.equal(await marked('16'),false);
  await p.screenshot({path:'/tmp/quolingo-verse-action.png'});await p.locator('[data-action=record-verse][data-start="16"]').tap();await p.locator('#verse-record-note').fill('취소할 메모');await p.screenshot({path:'/tmp/quolingo-verse-record-dialog.png'});await p.locator('#verse-record-dialog .share-actions [data-action=close-verse-record]').tap();assert.equal(await marked('16'),false);assert.equal(await p.evaluate(()=>Object.keys(readingData[today]?.highlights||{}).length),0);
  await mark('17').tap();assert.equal(await mark('16').getAttribute('aria-expanded'),'false');assert.equal(await p.locator('[data-action=record-verse]:visible').count(),1);
  await recordVerse('16');assert.equal(await marked('16'),true);assert.equal(await p.locator('.is-highlighted').count(),1);
  await mark('16').tap();assert.equal(await p.locator('[data-action=record-verse][data-start="16"]').textContent(),'기록 수정');await p.locator('[data-action=record-verse][data-start="16"]').tap();await p.locator('#verse-record-note').fill('처음 쓴 기록');await p.locator('[data-action=save-verse-record]').tap();assert.equal(await p.evaluate(()=>readingData[today].highlights['john-3:krv:16-16'].note),'처음 쓴 기록');
  await mark('16').focus();await p.keyboard.press('Enter');await p.locator('[data-action=record-verse][data-start="16"]').tap();assert.equal(await p.locator('#verse-record-note').inputValue(),'처음 쓴 기록');await p.locator('#verse-record-note').fill('저장하지 않은 수정');await p.keyboard.press('Escape');assert.equal(await p.locator('#verse-record-dialog').evaluate(el=>el.open),false);assert.equal(await p.evaluate(()=>readingData[today].highlights['john-3:krv:16-16'].note),'처음 쓴 기록');assert.equal(await p.evaluate(()=>allTimeCount()),saved.total);
  await recordVerse('17');await p.locator('[data-action=read-chapter]').tap();const earned=await p.evaluate(()=>allTimeCount());await p.locator('[data-action=read-chapter]').tap();assert.equal(await marked('16'),true);assert.equal(await p.evaluate(()=>allTimeCount()),saved.total);assert.ok(earned>saved.total);
  await nav('journal');assert.match(await p.locator('#content').textContent(),/이전 관찰/);assert.equal(await p.locator('.highlighted-entry').count(),0);await p.locator('[data-action=journal-tab][data-tab=reading]').tap();assert.equal(await p.locator('.highlighted-entry').count(),2);assert.doesNotMatch(await p.locator('#content').textContent(),/이전 관찰/);assert.equal(await p.locator('.highlighted-entry blockquote').last().textContent(),verse);
  const emptyEntry=p.locator('.highlighted-entry').first();assert.equal(await emptyEntry.locator('.highlight-note,label').count(),0);assert.ok((await emptyEntry.locator('blockquote').textContent()).trim());
  assert.equal(await p.locator('.highlight-note').count(),1);
  const note=p.locator('.highlight-note').last();await note.fill('감사와 사랑을 기억하기 <script>bad()</script>');await p.reload();assert.equal(await p.locator('[data-tab=reading]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('.highlight-note').last().inputValue(),'감사와 사랑을 기억하기 <script>bad()</script>');
  await p.goBack();await p.waitForFunction(()=>journalTab==='qt');await p.goForward();await p.waitForFunction(()=>journalTab==='reading');
  await p.locator('.highlight-note').fill('  \n  ');await p.locator('.highlight-note').press('Tab');assert.equal(await p.locator('.highlight-note,label[for^=highlight-note]').count(),0);assert.equal(await p.locator('.highlighted-entry blockquote').count(),2);await p.reload();assert.equal(await p.locator('.highlight-note').count(),0);
  await p.screenshot({path:'/tmp/quolingo-highlight-journal.png'});
  // Stored passage stays in its original edition even after changing the account version.
  await nav('account');await p.locator('#bible-version').selectOption('nkrv');await p.locator('#account-form [type=submit]').tap();await nav('journal');assert.equal(await p.locator('.highlighted-entry blockquote').last().textContent(),verse);assert.match(await p.locator('.highlighted-entry small').last().textContent(),/개역한글/);
  await choose('reading','deuteronomy','deuteronomy-6');await mark('18').waitFor();assert.equal(await mark('18').getAttribute('data-end'),'19');await recordVerse('18');
  await choose('reading','acts','acts-24');assert.equal(await mark('7').count(),0);
  await nav('journal');await p.locator('[data-action=journal-tab][data-tab=reading]').tap();assert.equal(await p.locator('.highlighted-entry').count(),3);await p.locator('.highlighted-entry [data-action=remove-highlight]').first().tap();assert.equal(await p.locator('.highlighted-entry').count(),2);
  // A failed write leaves saved bookmarks intact and reports the error.
  await choose('reading','john','john-3');await mark('16').waitFor();
  await p.evaluate(()=>{window.realSet=accountStore.setItem.bind(accountStore);accountStore.setItem=(key,value)=>{if(key===READING_KEY)throw Error('full');return window.realSet(key,value);};});
  await recordVerse('16');assert.equal(await marked('16'),false);assert.equal(await p.locator('#verse-record-dialog').evaluate(el=>el.open),true);assert.match(await p.locator('#verse-record-feedback').textContent(),/저장하지 못/);await p.evaluate(()=>{accountStore.setItem=window.realSet;});await p.locator('[data-action=save-verse-record]').tap();assert.equal(await marked('16'),true);
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/quolingo-highlight-reader.png'});
  assert.deepEqual(await p.evaluate(()=>({total:allTimeCount(),streak:streak(),qt:JSON.stringify(data)})),saved);assert.deepEqual(errors,[]);
  console.log('PASS: book selectors outside account, independent saved defaults, cross-book navigation and Bible ends, mobile history, verse marking/notes, journal tabs, persistence, source-edition snapshots, merged/missing verses, unchanged rewards and storage-failure recovery.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
