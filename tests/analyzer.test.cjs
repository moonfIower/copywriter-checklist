const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,splitDocument,parseBody,occurrences,ranges}=require('../src/analyzer');
const doc=(body='',meta={})=>({body,meta:{copywriter:true,content_type:'article',...meta}});
const analyzeOnce=(d,o={})=>analyze(d,{...o,settings:{complexMinMentions:1,...o.settings}});
const check=(r,label)=>r.checks.find(c=>c.label===label);
test('ordinary notes require explicit boolean opt-in',()=>{
 assert.deepEqual(analyze({body:'# Secret',meta:{}}),{optedIn:false});
 assert.equal(analyze({body:'x',meta:{copywriter:'true'}}).optedIn,false);
});
test('hybrid format separates properties and rejects broken YAML',()=>{
 const d=splitDocument('---\ncopywriter: true\n---\n# Body',()=>({copywriter:true}));
 assert.equal(d.body,'# Body');assert.equal(d.offset,25);
 assert.match(splitDocument('---\nbad\n---\nbody',()=>{throw Error('bad YAML')}).error,/bad YAML/);
});
test('lede is first paragraph after H1, not a heading or byline',()=>{
 const lede='This is a useful lede that describes the promise of the article in a clear and concise way.';
 const r=analyze(doc('# A heading\n\n'+lede+'\n\nBY AUTHOR | DATE\n\nBody',{primary_keyword:'clear'}));
 assert.equal(r.body.lede,lede);assert.equal(check(r,'Lede').status,'pass');
 assert.equal(parseBody('# Heading\n\n## Next\n\nBody').lede,'');
});
test('whole keyword phrases, hyphenated slugs, boundaries and non-overlapping ranges',()=>{
 assert.equal(occurrences('CASH FLOW cash-flow cash flowing xcash flow','cash flow'),3);
 assert.equal(occurrences('cat cats concatenate CAT','cat'),3);
 assert.equal(occurrences('cash, flow','cash flow'),1);
 assert.deepEqual(ranges('Cash flow','cash flow'),[{from:0,to:9}]);
});
test('fences, comments, image text and URLs do not inflate counts',()=>{
 const r=analyze(doc('Hello [world](https://host/long-url).\n\n```md\n# Fake\nsecret words\n```\n\n%% hidden words %%\n\n![alt words](photo.webp)'));
 assert.equal(r.total,2);assert.equal(r.body.headings.length,0);
});
test('images flag absent alt, wiki ambiguity and wrong type',()=>{
 const r=analyze(doc('![Good](a.webp) ![](b.png) ![[c.webp|Alias]]'));
 assert.equal(r.images.length,3);assert.equal(check(r,'Image alt text').status,'review');assert.equal(check(r,'WebP images').status,'review');
});

test('secondary keywords support comma strings, newlines, lists and pasted list items',()=>{
 const {secondaryKeywords}=require('../src/analyzer');
 for(const value of ['alpha, beta\ngamma',['alpha','beta','gamma']])assert.deepEqual(secondaryKeywords(value),['alpha','beta','gamma']);
 assert.deepEqual(secondaryKeywords([' Alpha ', 'alpha', '', ' BETA\n beta ',17]),['Alpha','BETA']);
 const r=analyze(doc('Alpha beta gamma.',{secondary_keywords:'alpha, beta, gamma'}));
 assert.equal(r.keywords.length,3);assert.ok(r.keywords.every(k=>k.count===1));
 assert.equal(check(r,'Secondary keyword format'),undefined);
});
test('all supplied Northfield phrases are independent keywords including nested phrases',()=>{
 const list='choosing a skilled nursing facility, what to look for in a skilled nursing facility, skilled nursing home facilities, skilled nursing facility with rehabilitation, rehabilitation facilities, nursing home planning, what to look for in a memory care facility, questions to ask a nursing home, nursing home compare, CMS nursing home compare, CMS skilled nursing facility ratings, Northfield Care Center, Brownsville, Tennessee, Northfield County';
 const r=analyze(doc('CMS nursing home compare. Northfield Care Center in Brownsville, Tennessee and Northfield County.',{secondary_keywords:list}));
 assert.equal(r.keywords.length,15);
 for(const phrase of ['CMS nursing home compare','nursing home compare','Northfield Care Center','Brownsville','Tennessee','Northfield County'])assert.equal(r.keywords.find(k=>k.phrase===phrase).count,1);
 assert.equal(r.keywords.find(k=>k.phrase==='rehabilitation facilities').count,0);
});

test('only content_type selects a profile; former names cannot serve as fallback',()=>{
 for(const old of ['content-type','content_profile']){
  const d={body:'Body',meta:{copywriter:true,[old]:'article'}};
  assert.match(analyze(d).error,/content_type/);
  d.meta.content_type='webpage';assert.equal(analyze(d).profile,'webpage');
 }
});

test('H1 length and primary presence are combined and missing H1 is explicit',()=>{
 const r=analyze(doc('# A useful care heading for readers',{primary_keyword:'care'}));assert.equal(check(r,'H1 heading').status,'pass');
 assert.equal(check(analyze(doc('Body')),'H1 heading').detail,'H1 missing');
 assert.equal(check(analyze(doc('# Short',{primary_keyword:'Short'})),'H1 heading').status,'review');
 assert.ok(!r.checks.some(c=>c.label==='One H1'));
});
test('heading count is only H2s with inclusive 5–15 range and correct order',()=>{
 for(const [n,status]of [[4,'near'],[5,'pass'],[15,'pass'],[16,'near']]){
  const r=analyze(doc('# Main\n\n'+Array(n).fill('## H2\n\n### H3').join('\n\n')));
  assert.equal(check(r,'Heading count').status,status);assert.equal(check(r,'Heading count').detail,`${n} H2 headings`);
  assert.deepEqual(r.checks.filter(c=>c.group==='Structure').slice(0,3).map(c=>c.label),['H1 heading','Heading count','Heading character counts']);
 }
});
test('H2 length summary lists only exceptions and counts distinct secondary phrases',()=>{
 const heading='A helpful alpha heading for readers';
 const r=analyze(doc(`## ${heading}\n\n## Short\n\n## Alpha beta heading for readers`,{secondary_keywords:['alpha','beta','absent']}));
 const c=check(r,'Heading character counts');assert.equal(c.status,'near');assert.match(c.detail,/2 secondary keywords/);assert.deepEqual(c.issues,[]);assert.equal(c.locations[0].label,'Short · 5 characters');
 const good=check(analyze(doc(`## ${heading}`,{secondary_keywords:['alpha','absent']})),'Heading character counts');assert.equal(good.status,'pass');assert.equal(good.issues.length,0);
 assert.equal(check(analyze(doc(`## ${heading}`,{secondary_keywords:['missing']})),'Heading character counts').status,'review');
});
test('heading depth, hierarchy and H3 density checks remain',()=>{
 const r=analyze(doc('# Title\n\n### Orphan\n\n## Section\n\n'+Array(6).fill('### Child').join('\n\n')+'\n\n#### Deep'));
 for(const l of ['Heading depth','Heading hierarchy','H3s per H2 section'])assert.equal(check(r,l).status,'review');
 assert.equal(check(analyze(doc('# Title\n\n## Section')),'H3s per H2 section').status,'pass');
});
test('optional topical/local lists accept pasted input and absence does not add errors',()=>{
 const r=analyze(doc('Alpha beta gamma.',{topical_keywords:['alpha','beta'],local_keywords:'gamma'}));assert.equal(r.keywords.filter(k=>k.kind==='topical').length,2);assert.equal(r.keywords.filter(k=>k.kind==='local').length,1);
 const none=analyze(doc('Text'));assert.ok(!none.checks.some(c=>/^(topical|local)/.test(c.label)));
});
test('old property names are ignored',()=>{
 const r=analyze(doc('',{seo_title:'title',seo_description:'meta',seo_slug:'/slug',url_slug:'/slug'}));
 for(const l of ['Title tag','Meta description','Slug']){assert.equal(check(r,l).status,'review');assert.match(check(r,l).detail,/^0 characters/);}
});

test('soft character benchmarks are inclusive with close allowances; missing keywords stay Review',()=>{
 for(const [n,status]of [[24,'review'],[25,'near'],[29,'near'],[30,'pass'],[60,'pass'],[61,'near'],[65,'near'],[66,'review']]){
  const r=analyze(doc('',{title_tag:'kw '+'x'.repeat(n-3),primary_keyword:'kw'}));assert.equal(check(r,'Title tag').status,status);
 }
 assert.equal(check(analyze(doc('',{title_tag:'x'.repeat(61)})),'Title tag').status,'review');
});
test('custom benchmark settings affect results and invalid saved ranges fall back safely',()=>{
 const {settingsWithDefaults}=require('../src/analyzer');
 const r=analyze(doc('',{title_tag:'kw '+'x'.repeat(17),primary_keyword:'kw'}),{settings:{ranges:{title:[10,20,2]}}});assert.equal(check(r,'Title tag').status,'pass');
 assert.deepEqual(settingsWithDefaults({ranges:{title:[30,20,5]}}).ranges.title,[30,60,5]);
 assert.equal(settingsWithDefaults({minInternal:-1}).minInternal,2);
});
test('body profile ranges also receive close allowances without passing empty content',()=>{
 for(const [n,status]of [[899,'review'],[900,'near'],[999,'near'],[1000,'pass'],[2500,'pass'],[2600,'near'],[2601,'review']])assert.equal(check(analyze(doc('word '.repeat(n))),'Body word count').status,status);
 assert.equal(check(analyze(doc('')),'Body word count').status,'review');
});
test('matching title/H1 is acceptable; meta/lede and true duplicates still flagged',()=>{
 const r=analyze(doc('# A shared title\n\nClear lede.\n\n## Useful section\n\nDifferent body.',{title_tag:'A shared title',meta_description:'Other meta',slug:'/slug'}));assert.equal(check(r,'Duplicate elements').status,'pass');
 const same=analyze(doc('# A shared title\n\nClear lede.\n\n## Useful section\n\nDifferent body.',{title_tag:'A shared title',meta_description:'Clear lede.',slug:'/slug'}));assert.equal(check(same,'Duplicate elements').status,'review');
});
test('diagnostic source ranges select actual headings, long paragraphs and duplicate text',()=>{
 const body='# Short\n\nOne. Two. Three. Four.\n\n## Bad\n\nRepeat body.\n\nRepeat body.';
 const r=analyze({body,offset:10,meta:{copywriter:true,content_type:'article',primary_keyword:'kw'}});
 for(const label of ['H1 heading','Heading character counts','Duplicate elements']){
  const c=check(r,label);assert.ok(c.locations.length,label);assert.ok(c.locations.every(l=>l.from>=10&&l.to>l.from));
 }
 const range=check(r,'H1 heading').locations[0];assert.equal(body.slice(range.from-10,range.to-10),'# Short');
});
test('score weights close passes, excludes manual/info and handles no scored checks',()=>{
 const {checklistScore}=require('../src/analyzer');
 const r=checklistScore([{status:'pass'},{status:'near'},{status:'review'},{status:'manual'},{status:'info'},{status:'pass',scored:false}]);assert.equal(r.value,63);assert.equal(r.count,3);assert.equal(r.near,1);
 assert.equal(checklistScore([{status:'manual'}]).value,null);
});
test('preview returns literal safe strings and assembled page URL',()=>{
 const r=analyze(doc('',{title_tag:'<script>Title</script>',meta_description:'Description',site_url:'https://example.com',slug:'/page'}));assert.equal(r.preview.title,'<script>Title</script>');assert.equal(r.preview.url,'https://example.com/page');
});

test('metadata and H1 use compact keyword checkmark wording',()=>{
 const r=analyze(doc('# A useful keyword heading for readers',{primary_keyword:'keyword',title_tag:'A useful keyword title for readers',meta_description:'A useful keyword description for readers that explains the purpose of this page.',slug:'/a-useful-keyword-page-for-readers'}));
 for(const label of ['Title tag','Meta description','Slug','H1 heading']){assert.match(check(r,label).detail,/✓ primary keyword/);assert.doesNotMatch(check(r,label).detail,/keyword present/);}
 assert.match(check(analyze(doc('',{primary_keyword:'keyword',title_tag:'Other title'})),'Title tag').detail,/✕ primary keyword/);
});

test('compact benchmark text follows current settings without allowance notes',()=>{
 const r=analyze(doc('Text'));
 for(const c of r.checks){assert.doesNotMatch(c.target,/close allowance|not a ranking|approximate|tense\/switching/);assert.doesNotMatch(c.detail,/keyword density|Dominant cues|H2 headings checked|outside length range/);}
 assert.equal(check(r,'H3s per H2 section').target,'<5 H3s per H2 section');
 assert.equal(check(r,'Long paragraphs').target,'Up to 250 words per paragraph');
 assert.equal(check(r,'Readability').target,'50–100 readability');
});
test('H2 defaults are 10–70 characters and H3 rule is strictly fewer than five',()=>{
 const {DEFAULTS}=require('../src/analyzer');assert.deepEqual(DEFAULTS.ranges.h2,[10,70,5]);
 for(const [n,status]of [[4,'pass'],[5,'review']])assert.equal(check(analyze(doc('# Title\n\n## Section\n\n'+Array(n).fill('### Subheading').join('\n\n'))),'H3s per H2 section').status,status);
});
test('alt text flags vague labels and filenames but accepts a specific description',()=>{
 for(const alt of ['image','photo1','IMG_1234','photo.webp','placeholder'])assert.equal(check(analyze(doc(`![${alt}](a.webp)`)),'Image alt text').status,'review');
 const c=check(analyze(doc('![Nurse helping a resident walk in a therapy room](a.webp)')),'Image alt text');assert.equal(c.status,'pass');assert.match(c.target,/Descriptive/);
});

test('POV is neutral, grouped and identical for both profiles, with exact source ranges',()=>{
 const body='We help you. They help us.\n\n```\nI am code.\n```\n\n![my image](my.webp) [your guide](https://example.com/our)';
 for(const profile of ['article','webpage']){
  const c=check(analyze({body,offset:20,meta:{copywriter:true,content_type:profile}}),'Point of view');assert.equal(c.status,'info');assert.equal(c.target,'');assert.equal(c.scored,false);
  assert.deepEqual(c.cueGroups.map(g=>[g.label,g.count]),[['First person',2],['Second person',2],['Third person',1]]);
  for(const group of c.cueGroups)for(const l of group.locations)assert.equal(body.slice(l.from-20,l.to-20),l.label);
 }
});
test('image checks are a single neutral row until an image is embedded',()=>{
 const empty=analyze(doc('No images yet.'));assert.equal(check(empty,'Images').status,'info');assert.equal(check(empty,'Images').scored,false);
 assert.equal(check(empty,'WebP images'),undefined);assert.equal(check(empty,'Image alt text'),undefined);
 const image=analyze(doc('![Resident gardening outdoors](photo.webp)'));assert.equal(check(image,'Images'),undefined);assert.equal(check(image,'Image alt text').status,'pass');assert.equal(check(image,'WebP images').status,'pass');
});
test('link benchmarks are compact and empty destination check is removed',()=>{
 const r=analyze(doc('[missing]()'));
 assert.equal(check(r,'Empty link destinations'),undefined);assert.equal(check(r,'Internal links').target,'At least 2 internal links on this page');assert.equal(check(r,'External links').target,'At least 1 external link on this page');assert.equal(check(r,'Anchor text').target,'Descriptive anchor text');
});
test('sentence and paragraph limits are separate and boundary-inclusive',()=>{
 const {DEFAULTS}=require('../src/analyzer');assert.equal(DEFAULTS.maxWords,250);assert.equal(DEFAULTS.maxSentenceWords,25);
 for(const [n,status]of [[25,'pass'],[26,'near'],[30,'near'],[31,'review']]){
  const body='word '.repeat(n).trim()+'.';const r=analyze(doc(body));assert.equal(check(r,'Long sentences').status,status);assert.equal(check(r,'Long paragraphs').status,'pass');
  if(status==='review'){const l=check(r,'Long sentences').locations[0];assert.equal(body.slice(l.from,l.to),body);}
 }
 for(const [n,status]of [[250,'pass'],[251,'near'],[275,'near'],[276,'review']]){
  const body=Array(n).fill('Word.').join(' '),r=analyze(doc(body));assert.equal(check(r,'Long paragraphs').status,status);assert.equal(check(r,'Long sentences').status,'pass');
  if(status==='review'){const l=check(r,'Long paragraphs').locations[0];assert.equal(body.slice(l.from,l.to),body);}
 }
});
test('paragraph metrics exclude headings/list blocks and show independent averages',()=>{
 const r=analyze(doc('# Heading\n\nOne sentence. Two sentences.\n\nThree words here.\n\n- List item\n\n## Section'));
 assert.match(check(r,'Paragraphs').detail,/2 paragraphs · average 1.5 sentences · average 3.5 words/);assert.equal(check(r,'Skimmable paragraphs'),undefined);
});
test('complex word buttons are inline, source-aligned, and excluded from score',()=>{
 const body='Simple rehabilitation and communication.\n\n```\nrehabilitation\n```\n\n[Helpful](https://example.com/communication) ![communication](photo.webp)';
 const c=check(analyzeOnce({body,offset:8,meta:{copywriter:true,content_type:'article'}}),'Complex words');assert.equal(c.inline,true);assert.equal(c.scored,false);assert.deepEqual(c.locations.map(l=>l.label),['rehabilitation','communication']);
 for(const l of c.locations)assert.equal(body.slice(l.from-8,l.to-8),l.label);
 const r=analyzeOnce(doc('rehabilitation communication'),{settings:{complexSyllables:20}});assert.equal(check(r,'Complex words').locations.length,0);
});
test('source masking preserves offsets across comments and formatted text',()=>{
 const {visibleSource}=require('../src/analyzer');
 const body='**We** <!-- hidden you --> tell [you](https://example.com/their) about `them`.\n\n%% I am hidden %%\n\nThey answer.';
 const visible=visibleSource(body);assert.equal(visible.length,body.length);
 const groups=check(analyze(doc(body)),'Point of view').cueGroups;
 assert.deepEqual(groups.flatMap(g=>g.locations.map(l=>l.label)),['We','you','They']);
 for(const g of groups)for(const l of g.locations)assert.equal(body.slice(l.from,l.to),l.label);
});

test('complex filter defaults use four syllables and eight letters',()=>{
 const {DEFAULTS}=require('../src/analyzer');assert.equal(DEFAULTS.complexSyllables,4);assert.equal(DEFAULTS.complexMinLetters,8);
 const r=analyzeOnce(doc('Residents need rehabilitation and communication.'));
 assert.deepEqual(check(r,'Complex words').locations.map(l=>l.label),['rehabilitation','communication']);
});
test('complex ignore list is case insensitive and supports pasted lists',()=>{
 const r=analyzeOnce(doc('Rehabilitation needs communication and rehabilitation.'),{settings:{ignoredWords:'rehabilitation, COMMUNICATION'}});
 assert.equal(check(r,'Complex words').locations.length,0);assert.equal(check(r,'Complex words').target,'4+ syllables · 8+ letters · 1+ mentions');
});
test('configured keyword words are omitted from complex findings and exclusion can be disabled',()=>{
 const d=doc('Rehabilitation improves communication.',{secondary_keywords:['rehabilitation services']});
 assert.deepEqual(check(analyzeOnce(d),'Complex words').locations.map(l=>l.label),['communication']);
 assert.deepEqual(check(analyzeOnce(d,{settings:{excludeKeywordWords:false}}),'Complex words').locations.map(l=>l.label),['Rehabilitation','communication']);
});
test('acronyms and mid-sentence names are filtered while sentence-initial long words remain',()=>{
 const d=doc('We visit Alexandria. Communication matters. REHABILITATION helps.');
 assert.deepEqual(check(analyzeOnce(d),'Complex words').locations.map(l=>l.label),['Communication']);
 assert.ok(check(analyzeOnce(d,{settings:{excludeProperNames:false}}),'Complex words').locations.some(l=>l.label==='Alexandria'));
});

test('muted gauge palette matches manuscript bands and highlight inputs are sanitized',()=>{
 const {progressColor,normalizeColors,highlightStyle}=require('../src/analyzer');
 assert.deepEqual([0,25,50,75,100].map(progressColor),['#b78181','#c39977','#c3b578','#a6b894','#6c9275']);
 assert.equal(normalizeColors({primary:'invalid'}).primary,'#28b455');assert.equal(normalizeColors({local:'#123abc'}).local,'#123abc');assert.equal(highlightStyle('#123abc'),'background-color:#123abc40');
});

test('complex words group case-insensitively with counts and exact ordered occurrence ranges',()=>{
 const body='Rehabilitation helps. Rehabilitation supports communication. We need rehabilitation.';
 const c=check(analyzeOnce(doc(body)),'Complex words');
 assert.equal(c.wordGroups.length,2);const rehab=c.wordGroups.find(g=>g.label.toLowerCase()==='rehabilitation');assert.equal(rehab.count,3);assert.equal(rehab.occurrences.length,3);
 for(const l of rehab.occurrences)assert.equal(body.slice(l.from,l.to).toLowerCase(),'rehabilitation');
 assert.match(c.detail,/2 complex words · 4 occurrences/);
});

test('keyword mention benchmarks vary by profile and category without enforcing counts',()=>{
 for(const [profile,text]of [['article','At least 8–10 mentions'],['webpage','At least 4–6 mentions']]){
  const r=analyze(doc('primary secondary topical local '+'filler '.repeat(96),{content_type:profile,primary_keyword:'primary',secondary_keywords:['secondary'],topical_keywords:['topical'],local_keywords:['local']}));
  assert.equal(check(r,'primary: primary').target,text);assert.equal(check(r,'primary: primary').status,'pass');
  for(const kind of ['secondary','topical','local']){assert.equal(check(r,`${kind}: ${kind}`).target,'At least 1–2 mentions');assert.equal(check(r,`${kind}: ${kind}`).status,'pass');}
 }
});
test('keywords review only when absent or above the configurable severe-density limit',()=>{
 for(const [count,status]of [[0,'review'],[1,'pass'],[3,'pass'],[4,'review']]){
  const r=analyze(doc('target '.repeat(count)+'filler '.repeat(100-count),{primary_keyword:'target',secondary_keywords:['target'],topical_keywords:['target'],local_keywords:['target']}));
  for(const kind of ['primary','secondary','topical','local'])assert.equal(check(r,`${kind}: target`).status,status);
  assert.ok(!r.checks.some(c=>c.label.startsWith('Repetition cue:')));
 }
 const r=analyze(doc('target '.repeat(4)+'filler '.repeat(96),{primary_keyword:'target'}),{settings:{repeatDensity:5}});assert.equal(check(r,'primary: target').status,'pass');
});

test('H2s require an immediately following prose paragraph, allowing whitespace and comments',()=>{
 for(const [after,status]of [['\n\nA useful paragraph.','pass'],['\n\n<!-- comment -->\n\nA useful paragraph.','pass'],['\n\n### Subheading\n\nLater prose.','review'],['\n\n- A list','review'],['\n\n![Image](a.webp)\n\nLater prose.','review'],['\n\n---\n\nLater prose.','review'],['','review']]){
  const r=analyze(doc('## A section heading'+after)),c=check(r,'Paragraphs after H2s');assert.equal(c.status,status,after);if(status==='review')assert.equal(c.locations[0].label,'A section heading');
 }
 const setext=analyze(doc('Section heading\n---------------\n\nA paragraph.'));assert.equal(check(setext,'Paragraphs after H2s').status,'pass');
});
test('keywords expose source-aligned mentions and exclude hidden destinations/code',()=>{
 const body='# Keyword topic\n\nKeyword **topic** here. [Keyword topic](https://example.com/keyword-topic) `keyword topic`';
 const r=analyze({body,offset:20,meta:{copywriter:true,content_type:'article',primary_keyword:'keyword topic'}}),k=r.keywords[0];assert.equal(k.count,3);assert.equal(k.mentions.length,3);assert.equal(k.mentions[0].from,22);
 assert.match(body.slice(k.mentions[1].from-20,k.mentions[1].to-20),/Keyword \*\*topic/);
 assert.equal(check(r,'primary: keyword topic').keyword.mentions.length,k.count);
});
test('section quick counts reflect visible statuses without treating Info as a failure',()=>{
 const {sectionCounts}=require('../src/analyzer');assert.deepEqual(sectionCounts([{status:'pass',scored:false},{status:'near'},{status:'review'},{status:'info'},{status:'manual'}]),{passed:1,close:1,review:1});
});
test('H2 table of contents excludes fenced headings and retains exact heading locations',()=>{
 const body='# Main\n\n## First section\n\nTwo words.\n\n### Supporting heading\n\nMore text.\n\n```\n## Fake\n```\n\n## Second section\n\nLast paragraph.';
 const r=analyze({body,offset:5,meta:{copywriter:true,content_type:'article'}});assert.deepEqual(r.toc.map(h=>h.title),['First section','Second section']);assert.equal(r.toc[0].words,4);assert.equal(body.slice(r.toc[1].from-5,r.toc[1].to-5),'## Second section');
});
test('paragraph benchmark reflects configured words and ignore list remains active',()=>{
 const r=analyzeOnce(doc('Rehabilitation helps communication.'),{settings:{maxWords:300,ignoredWords:['rehabilitation']}});assert.equal(check(r,'Paragraphs').target,'~3 sentences, 300 words per paragraph');assert.deepEqual(check(r,'Complex words').wordGroups.map(g=>g.label),['communication']);
});
