const {test}=require('node:test');const assert=require('node:assert/strict');const a=require('../src/analyzer');
const meta={copywriter:true,content_type:'article',primary_keyword:'care'};
const run=(body,extra={},settings={})=>a.analyze({meta:{...meta,...extra},body,offset:12},{settings});
test('keyword clusters require configured mentions within one prose paragraph',()=>{
 assert.ok(run('Care care care care.').checks.some(c=>c.label==='Keyword clustering'));
 assert.ok(!run('Care care.\n\nCare care.').checks.some(c=>c.label==='Keyword clustering'));
 assert.ok(!run('Care care care.').checks.some(c=>c.label==='Keyword clustering'));
 assert.ok(run('Care care care.',{}, {clusterMentions:3}).checks.some(c=>c.label==='Keyword clustering'));
 assert.ok(!run('## Care care care care\n\nCare.').checks.some(c=>c.label==='Keyword clustering'));
});
test('long H2 section marker is configurable and strictly above its benchmark',()=>{
 const body='## Section\n\nOne two three.';assert.equal(run(body,{}, {maxSectionWords:3}).toc[0].long,false);assert.equal(run(body,{}, {maxSectionWords:2}).toc[0].long,true);
});
test('complex word dismissal updates grouped counts while leaving other occurrences navigable',()=>{
 const body='Rehabilitation helps rehabilitation.';const r=a.analyze({meta,body}),c=r.checks.find(c=>c.label==='Complex words'),first=c.wordGroups[0].occurrences[0],key=a.findingKey(c,first,body);const row=a.applyDismissals(r,body,{[key]:true}).checks.find(c=>c.label==='Complex words');assert.equal(row.wordGroups[0].count,1);assert.equal(row.wordGroups[0].occurrences[0].from,21);assert.match(row.detail,/1 occurrences/);
});
test('large draft remains analyzable, ordinary notes remain opted out and settings are cloned',()=>{
 const body=Array.from({length:80},(_,i)=>`## Useful heading ${i}\n\n${'Helpful information for a reader. '.repeat(40)}`).join('\n\n');const start=performance.now();const r=run(body);assert.equal(r.toc.length,80);assert.ok(performance.now()-start<5000);assert.equal(a.analyze({meta:{},body}).optedIn,false);const saved={ignoredWords:['B']},settings=a.settingsWithDefaults(saved);settings.ignoredWords.push('C');assert.deepEqual(saved.ignoredWords,['B']);
});
test('ignoring an unusual H2 removes its length warning while retaining missing secondary-keyword review',()=>{
 const body='## A\n\nHelpful care.';const r=a.analyze({meta,body}),c=r.checks.find(c=>c.label==='Heading character counts'),key=a.findingKey(c,c.locations[0],body);const filtered=a.applyDismissals(r,body,{[key]:true}).checks.find(c=>c.label==='Heading character counts');assert.equal(filtered.locations.length,0);assert.equal(filtered.status,'review');assert.match(filtered.detail,/No remaining length findings/);assert.ok(filtered.issues.some(i=>/secondary/.test(i)));
});
