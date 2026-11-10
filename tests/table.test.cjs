const {test}=require('node:test');const assert=require('node:assert/strict');const a=require('../src/analyzer');
const meta={copywriter:true,content_type:'article'};
const table=String.raw`| **Title Tag** | Sensory Integration Therapy \| Riverton Care Center |
| --- | --- |
| **Meta Description** | Explore sensory integration therapy at Riverton Care Center and learn how personalized sensory input can support rehabilitation and daily function. |
| **Slug** | /sensory-integration-therapy |
| **Website** | facility.example |
| **Primary Keyword** | sensory integration therapy |
| **Secondary Keywords** | sensory issues<br>ot for sensory issues<br/>occupational therapy for sensory integration disorder<BR />sensory integration |
| **Local Keywords** | Riverton Care Center<br>Riverton, Ohio<br>Riverton, OH |
| **Topical Keywords** | what is sensory integration therapy<br>how does sensory integration work |`;
const body='# Sensory integration therapy explained\n\nSensory integration therapy supports daily function.\n\n## How sensory issues affect daily life\n\nCare teams help with sensory issues in Riverton, Ohio. [Our services](/services)';
const check=(r,label)=>r.checks.find(c=>c.label===label);
function run(text,m=meta,settings={}){return a.analyze({meta:m,body:text},{settings});}
test('exact two-column table at top or bottom reads metadata and preserves escaped pipes and comma phrases',()=>{
 for(const text of [table+'\n\n'+body,body+'\n\n'+table]){
  const r=run(text);assert.equal(r.metadata.title_tag,'Sensory Integration Therapy | Riverton Care Center');assert.equal(r.preview.url,'https://facility.example/sensory-integration-therapy');
  assert.equal(r.keywords.find(k=>k.phrase==='Riverton, Ohio').count,1);assert.ok(!r.keywords.some(k=>k.phrase==='Ohio'));assert.equal(r.keywords.find(k=>k.phrase==='sensory integration therapy').count,2);
  assert.equal(r.keywords.filter(k=>k.kind==='secondary').length,4);assert.equal(r.total,run(body).total);assert.equal(r.body.headings.length,2);
  assert.equal(r.keywords.find(k=>k.phrase==='Riverton, OH').count,0);
 }
});
test('metadata table does not inflate style, link/image, paragraph, complex or POV metrics',()=>{
 const text=body+'\n\n'+table+'\n';const r=run(text),base=run(body,r.metadata);
 for(const label of ['Paragraphs','Complex words','Internal links','External links','Style elements'])assert.equal(check(r,label).detail,check(base,label).detail);
 assert.deepEqual(check(r,'Point of view').cueGroups.map(g=>g.count),check(base,'Point of view').cueGroups.map(g=>g.count));assert.deepEqual(r.images,base.images);assert.deepEqual(r.toc.map(h=>h.words),base.toc.map(h=>h.words));
});
test('properties take precedence over table cells, including empty values',()=>{
 const text=table.replace('| **Primary Keyword** | sensory integration therapy |','| **Primary Keyword** | |').replace('| **Slug** | /sensory-integration-therapy |\n','');
 const r=run(text,{...meta,primary_keyword:'old keyword',slug:'/property-slug',seo_title:'old name'});assert.equal(r.metadata.primary_keyword,'old keyword');assert.equal(r.metadata.slug,'/property-slug');assert.ok(r.keywords.some(k=>k.kind==='primary'&&k.phrase==='old keyword'));assert.equal(r.preview.title,'Sensory Integration Therapy | Riverton Care Center');
});
test('table metadata needs opt-in properties and cannot alter profile or opt-in',()=>{
 assert.equal(run(table,{}).optedIn,false);assert.equal(run(table,{copywriter:true,content_type:'other'}).error,'Set content_type to article or webpage.');
});
test('tables in fences/comments and ordinary content tables are not treated as metadata',()=>{
 for(const text of ['```markdown\n'+table+'\n```','<!--\n'+table+'\n-->','%%\n'+table+'\n%%'])assert.equal(a.prepareDocument({meta,body:text}).tableFields.length,0);
 const ordinary='| Benefit | Value |\n|---|---|\n| Care | Helpful |';assert.equal(a.prepareDocument({meta,body:ordinary}).body,ordinary);
});
test('duplicate fields, multiple tables and unescaped title pipes are reviewable without inflating content',()=>{
 assert.match(check(run(table+'\n| **Slug** | /other |'),'Metadata table').issues.join(' '),/Duplicate/);
 assert.match(check(run(table+'\n\n'+table),'Metadata table').issues.join(' '),/Multiple/);
 assert.match(check(run(table.replace('\\| Riverton','| Riverton')),'Metadata table').issues.join(' '),/Invalid table row/);
});
test('source offsets still select body mentions and metadata rows exactly after a frontmatter prefix',()=>{
 const text='---\ncopywriter: true\ncontent_type: article\n---\n'+table+'\n\n'+body;const d=a.splitDocument(text,()=>meta),r=a.analyze(d);
 for(const k of r.keywords)for(const l of k.mentions)assert.equal(a.norm(text.slice(l.from,l.to)),a.norm(k.phrase));
 const changed=table.replace('Sensory Integration Therapy \\| Riverton Care Center','Short');const raw='---\nx: y\n---\n'+changed+'\n\n'+body;const t=a.analyze(a.splitDocument(raw,()=>meta));const loc=check(t,'Title tag').locations[0];assert.match(raw.slice(loc.from,loc.to),/^\| \*\*Title Tag\*\*/);
});
test('keyword fields support semicolons with commas intact and Properties retain legacy comma-list behavior',()=>{
 const r=run(table.replace('Riverton Care Center<br>Riverton, Ohio<br>Riverton, OH','Riverton Care Center; Riverton, Ohio; Riverton, OH'));assert.equal(r.keywords.filter(k=>k.kind==='local').length,3);assert.ok(r.keywords.some(k=>k.phrase==='Riverton, Ohio'));
 assert.equal(run(body,{...meta,secondary_keywords:'one,two'}).keywords.filter(k=>k.kind==='secondary').length,2);
});
test('slug defaults and tolerance boundaries differ by profile, including homepage exemption',()=>{
 assert.deepEqual(a.DEFAULTS.ranges.slug,[20,60,10]);
 for(const [n,status]of [[9,'review'],[10,'near'],[19,'near'],[20,'pass'],[60,'pass'],[61,'near'],[70,'near'],[71,'review']]){const slug='k'+'x'.repeat(n-1),r=run('',{...meta,primary_keyword:slug,slug});assert.equal(check(r,'Slug').status,status,`${n} article`);}
 for(const [n,status]of [[1,'pass'],[19,'pass'],[60,'pass'],[61,'near'],[70,'near'],[71,'review']]){const r=run('',{...meta,content_type:'webpage',primary_keyword:'unrelated',slug:'/'+'x'.repeat(n-1)});assert.equal(check(r,'Slug').status,status,`${n} webpage`);assert.ok(!check(r,'Slug').detail.includes('primary keyword'));}
 assert.equal(check(run('',{...meta,content_type:'webpage',slug:''}),'Slug').status,'review');
});
test('zero/custom tolerances validate and individual dismissal recomputes remaining severity',()=>{
 assert.equal(a.settingsWithDefaults({maxSentenceTolerance:0}).maxSentenceTolerance,0);assert.equal(a.settingsWithDefaults({maxParagraphTolerance:-1}).maxParagraphTolerance,25);
 const sentence=n=>'word '.repeat(n).trim()+'.';assert.equal(check(run(sentence(26),meta,{maxSentenceTolerance:0}),'Long sentences').status,'review');
 const text=sentence(28)+' '+sentence(35),r=run(text),c=check(r,'Long sentences');assert.equal(c.status,'review');const key=a.findingKey(c,c.locations[1],text),filtered=a.applyDismissals(r,text,{[key]:true});assert.equal(check(filtered,'Long sentences').status,'near');
});
