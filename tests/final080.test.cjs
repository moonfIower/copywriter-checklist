const {test}=require('node:test'),assert=require('node:assert/strict'),a=require('../src/analyzer');
const meta={copywriter:true,content_type:'article'},check=(r,n)=>r.checks.find(c=>c.label===n);
const table=url=>`| **Title Tag** | Sensory Integration Therapy |\n|---|---|\n| **Primary Keyword** | sensory integration therapy |\n| **URL** | ${url} |`;
test('URL row derives origin and only the final segment with or without protocol, trailing slash and parameters',()=>{
 for(const url of ['riverton.example/blog/sensory-integration-therapy','https://riverton.example/blog/sensory-integration-therapy/','riverton.example/blog/sensory-integration-therapy?source=email#care']){
  const body=table(url)+'\n\n# Care\n\n[Care](https://riverton.example/services) [Self](/blog/sensory-integration-therapy)';const r=a.analyze({meta,body});assert.equal(r.metadata.site_url,'https://riverton.example');assert.equal(r.metadata.slug,'sensory-integration-therapy');assert.equal(check(r,'Slug').status,'pass');assert.equal(check(r,'Slug').detail.startsWith('27 characters'),true);assert.equal(check(r,'Internal links').linkGroups.length,1);assert.ok(r.preview.url.startsWith('https://riverton.example/blog/sensory-integration-therapy'));assert.ok(!r.preview.url.includes('?'));
 }
});
test('URL row takes priority over legacy slug/site values and handles homepage and invalid URLs explicitly',()=>{
 const r=a.analyze({meta:{...meta,content_type:'webpage',slug:'/wrong',site_url:'https://wrong.com'},body:table('riverton.example')});assert.equal(r.metadata.slug,'/');assert.equal(check(r,'Slug').status,'pass');assert.equal(r.preview.url,'https://riverton.example/');
 for(const url of ['', '/relative/path','javascript:alert(1)','ftp://site.com/file','a b.com/page']){const result=a.analyze({meta,body:table(url)});assert.equal(check(result,'Metadata table').status,'review');assert.equal(result.metadata.slug,'');}
});
test('metadata table does not satisfy style elements but a separate content table does',()=>{
 const base=table('site.com/blog/sensory-integration-therapy')+'\n\n# Care\n\nPlain prose.';const r=a.analyze({meta,body:base});assert.equal(check(r,'Style elements').status,'review');assert.equal(check(r,'Style elements').detail,'No style elements detected');assert.match(check(a.analyze({meta,body:base+'\n\n| Care | Options |\n|---|---|\n| Short | Long |'}),'Style elements').detail,/table/);
});
test('complex words default to at least two eligible mentions, with adjustable letters/syllables/mentions',()=>{
 const body='Rehabilitation helps communication. Rehabilitation supports recovery.';let r=a.analyze({meta,body});assert.equal(a.DEFAULTS.complexMinMentions,2);assert.deepEqual(check(r,'Complex words').wordGroups.map(g=>[g.label,g.count]),[['Rehabilitation',2]]);
 r=a.analyze({meta,body},{settings:{complexMinMentions:1}});assert.equal(check(r,'Complex words').wordGroups.length,3);
 for(const settings of [{complexMinMentions:3},{complexSyllables:10},{complexMinLetters:30}])assert.equal(check(a.analyze({meta,body},{settings}),'Complex words').wordGroups.length,0);
 assert.equal(a.settingsWithDefaults({complexMinMentions:0}).complexMinMentions,2);
});
test('readability exposes the actual score and benchmark for a bounded graphic without long metric text',()=>{
 const r=a.analyze({meta,body:'We help you find good care. The team can help.'}),c=check(r,'Readability');assert.equal(typeof c.readability.value,'number');assert.equal(c.readability.min,50);assert.equal(c.detail,'');assert.equal(check(a.analyze({meta,body:''}),'Readability').readability.value,null);
});
