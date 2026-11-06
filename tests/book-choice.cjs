// Select through the user-facing passage form without completing any reading.
module.exports=async function chooseBook(p,mode,book,date='2026-10-20'){
 await p.locator('.nav[data-page=home]').click();
 await p.locator(`[data-mode=${mode}]`).click();
 await p.locator(`.day-node[data-date="${date}"]`).click();
 await p.clock.runFor(300);
 await p.locator(mode==='qt'?'#qt-book-select':'#word-book-select').selectOption(book);
 await p.locator(mode==='qt'?'#passage-selection [type=submit]':'#word-selection [type=submit]').click();
};
