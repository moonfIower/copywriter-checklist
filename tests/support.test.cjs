const {test}=require('node:test'),assert=require('node:assert/strict');const {wordGoal,WordCountSync}=require('../src/support');
test('word_goal accepts a number or explicit range with safe default fallback',()=>{assert.deepEqual(wordGoal(1500,[1000,2500,100]),[1000,1500,100]);assert.deepEqual(wordGoal('1,200–1,600',[1000,2500,100]),[1200,1600,100]);assert.deepEqual(wordGoal([70000,90000],[70000,100000,5000]),[70000,90000,5000]);for(const bad of [-1,0,'hello','20–10',NaN])assert.deepEqual(wordGoal(bad,[5,10,2]),[5,10,2]);});
test('word_count writer updates only its property, avoids loops, excludes dirty/unassigned notes',async()=>{let text='Saved writing.',eligible=true,open=text,writes=0;const fm={status:'draft',word_goal:10};const file={path:'Draft.md',extension:'md'},app={vault:{cachedRead:async()=>text},fileManager:{processFrontMatter:async(_f,cb)=>{writes++;cb(fm);text='---\nword_count: '+fm.word_count+'\n---\nSaved writing.';open=text;}}};const sync=new WordCountSync(app,{eligible:()=>eligible,openText:()=>open,count:()=>2,parseYaml:()=>({...fm})});await sync.flush(file);assert.equal(fm.word_count,2);assert.equal(fm.status,'draft');assert.equal(fm.word_goal,10);await sync.flush(file);assert.equal(writes,1);open='Unsaved changed writing.';await sync.flush(file);assert.equal(writes,1);eligible=false;await sync.flush(file);assert.equal(writes,1);sync.stop();});
test('lede requires keyword and word_goal overrides the article benchmark',()=>{const {analyze}=require('../src/analyzer');const body='# Care\n\nThis clear introduction explains the care options offered by our team for residents and their families.\n\n## More care\n\nWe provide support.';const meta={copywriter:true,content_type:'article',primary_keyword:'care',word_goal:'20–200'};let r=analyze({meta,body});assert.match(r.checks.find(c=>c.label==='Lede').detail,/✓ primary keyword/);assert.equal(r.checks.find(c=>c.label==='Body word count').status,'pass');r=analyze({meta:{...meta,primary_keyword:'missing phrase'},body});assert.equal(r.checks.find(c=>c.label==='Lede').status,'review');});

test('word_goal defaults, migration, overrides and unchanged counts are safe',async()=>{
 const file={path:'Draft.md',extension:'md'};let fm={word_count:2,content_type:'article',status:'draft'},writes=0;
 const text='---\nplaceholder: true\n---\nTwo words';
 const app={vault:{cachedRead:async()=>text},fileManager:{processFrontMatter:async(f,cb)=>{writes++;cb(fm)}}};
 const sync=new WordCountSync(app,{eligible:()=>true,openText:()=>text,count:()=>2,parseYaml:()=>({...fm}),defaultGoal:meta=>meta.content_type==='webpage'?900:2500});
 await sync.flush(file);assert.equal(fm.word_goal,2500);assert.equal(fm.status,'draft');await sync.flush(file);assert.equal(writes,1);
 fm.word_goal=1700;await sync.flush(file);assert.equal(fm.word_goal,1700);assert.equal(writes,1);
 delete fm.word_goal;fm.word_count_goal='1200-1600';await sync.flush(file);assert.equal(fm.word_goal,1600);assert.equal(Object.hasOwn(fm,'word_count_goal'),false);
 fm.word_goal=900;fm.word_count_goal=1200;await sync.flush(file);assert.equal(fm.word_goal,900);assert.equal(Object.hasOwn(fm,'word_count_goal'),false);
 delete fm.word_goal;fm.content_type='webpage';await sync.flush(file);assert.equal(fm.word_goal,900);sync.stop();
});

test('numeric goals normalize ranges and numeric text; numeric benchmarks retain the minimum',()=>{
 const {numericWordGoal}=require('../src/support');assert.equal(numericWordGoal('1000-2500',900),2500);assert.equal(numericWordGoal('100000',900),100000);assert.equal(numericWordGoal(1700,2500),1700);assert.equal(numericWordGoal(undefined,900),900);assert.deepEqual(wordGoal(900,[500,900,50]),[500,900,50]);assert.deepEqual(wordGoal(300,[500,900,50]),[300,300,50]);
});

test('word sync rejects stale cached eligibility and checks the actual properties again before writing',async()=>{
 const file={path:'Draft.md',extension:'md'},text='---\ncontent_type: article\n---\nDraft text';let parsed={content_type:'manuscript'},actual={content_type:'manuscript'},calls=0;
 const sync=new WordCountSync({vault:{cachedRead:async()=>text},fileManager:{processFrontMatter:async(_,fn)=>{calls++;fn(actual);}}},{eligible:()=>true,validFrontmatter:fm=>fm?.content_type==='article',parseYaml:()=>parsed,count:()=>2,defaultGoal:()=>2500});
 await sync.flush(file);assert.equal(calls,0);
 parsed={content_type:'article'};await sync.flush(file);assert.equal(calls,1);assert.equal(actual.word_count,undefined);
 actual={content_type:'article'};await sync.flush(file);assert.equal(actual.word_count,2);assert.equal(actual.word_goal,2500);
});
