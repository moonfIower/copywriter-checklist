const {test}=require('node:test');const assert=require('node:assert/strict');
const {MARKER,bookmarks,bookmarkChapter,bookmarkEdit}=require('../src/bookmark');const {analyze:copyAnalyze}=require('../src/analyzer');const analyze=text=>{const r=copyAnalyze({body:text,meta:{copywriter:true,content_type:'article'}});return {...r,chapterCount:r.toc.length,chapters:[{line:0},...r.toc]};};
function checkMove(text,target,expected){const e=bookmarkEdit(text,target);assert.equal(text.slice(0,e.from)+e.insert+text.slice(e.to),e.text);assert.equal(e.text,expected);assert.equal(bookmarks(e.text).length,1);assert.equal(bookmarks(e.text)[0].line,e.line);return e;}
test('real marker is ignored by counts and assigned to containing chapter',()=>{
 const text=`Opening words\n## One\nFirst chapter\n${MARKER}\nMore words\n## Two\nSecond chapter`;
 const r=analyze(text);assert.equal(r.total,analyze(text.replace(MARKER,'')).total);assert.equal(r.chapterCount,2);assert.equal(bookmarkChapter(r.chapters,bookmarks(text)[0].line),1);
 assert.equal(bookmarkChapter(r.chapters,0),0);
});
test('placing and moving preserves every prose line upward/downward and is idempotent',()=>{
 const initial='## One\nAlpha\n## Two\nBeta';const e=checkMove(initial,1,`## One\n${MARKER}\nAlpha\n## Two\nBeta`);
 const down=checkMove(e.text,4,`## One\nAlpha\n## Two\n${MARKER}\nBeta`);
 checkMove(down.text,0,`${MARKER}\n## One\nAlpha\n## Two\nBeta`);
 const same=bookmarkEdit(down.text,3);assert.equal(same.text,down.text);assert.equal(same.from,same.to);assert.equal(same.insert,'');
 assert.equal(analyze(initial).total,analyze(down.text).total);
});
test('marker follows inserted lines naturally and deleting its line removes it',()=>{
 const text=`## One\n${MARKER}\nbody`;assert.equal(bookmarks('new prose\n'+text)[0].line,2);assert.deepEqual(bookmarks(text.replace(MARKER+'\n','')),[]);
});
test('code fences, metadata, larger comments, inline markers are not bookmarks',()=>{
 const text=`---\nx: 1\n${MARKER}\n---\n\`\`\`md\n${MARKER}\n\`\`\`\n<!--\n${MARKER}\n-->\nText ${MARKER}\n${MARKER}`;
 assert.equal(bookmarks(text).length,1);assert.equal(bookmarks(text)[0].line,11);
});
test('empty notes, EOF without newline, CRLF and duplicates preserve valid marker lines',()=>{
 checkMove('',0,MARKER+'\n');checkMove('Alpha',1,'Alpha\n'+MARKER);checkMove(`Alpha\n${MARKER}`,0,`${MARKER}\nAlpha`);
 checkMove('A\r\nB',1,`A\r\n${MARKER}\r\nB`);
 checkMove(`${MARKER}\nA\n${MARKER}\nB`,4,`A\nB\n${MARKER}`);
});

test('placement into Properties, fenced code and comments is rejected without altering input',()=>{
 for(const [text,line] of [['---\nx: 1\n---\nprose',1],['```\ncode\n```',1],['<!--\ncomment\n-->',1]])assert.throws(()=>bookmarkEdit(text,line),/prose line/);
});
test('legacy bookmark heading is recognized without mistaking normal prose',()=>{const {legacyBookmark}=require('../src/bookmark');assert.equal(legacyBookmark('## Chapter\n## BOOKMARK ----------------\ntext').line,1);assert.equal(legacyBookmark('A BOOKMARK in prose'),null);});
