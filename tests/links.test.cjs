const {test}=require('node:test'),assert=require('node:assert/strict');const a=require('../src/analyzer');
const meta={copywriter:true,content_type:'webpage',site_url:'https://facility.example',slug:'/current'};
const check=(r,label)=>r.checks.find(c=>c.label===label);
test('distinct internal/external buttons group repeated destinations and retain exact occurrence ranges',()=>{
 const body='😀 Intro. [Services](/services) [More services](/services) [Therapy](https://facility.example/therapy) [[Other note|Planning]] [Source](https://source.org/report) [Evidence](https://source.org/report)';const prefix='---\ncopywriter: true\n---\n';const r=a.analyze({meta,body,offset:prefix.length});
 const inside=check(r,'Internal links'),outside=check(r,'External links');assert.equal(inside.detail,'3 distinct destinations');assert.equal(outside.detail,'1 distinct external destinations');assert.equal(inside.linkGroups.length,3);assert.equal(inside.linkGroups[0].count,2);assert.equal(inside.linkGroups[0].label,'Services');assert.equal(outside.linkGroups[0].count,2);
 const source=prefix+body;assert.deepEqual(inside.linkGroups[0].occurrences.map(l=>source.slice(l.from,l.to)),['[Services](/services)','[More services](/services)']);assert.equal(source.slice(inside.linkGroups[2].occurrences[0].from,inside.linkGroups[2].occurrences[0].to),'[[Other note|Planning]]');assert.equal(outside.status,'pass');
});
test('navigation excludes self links, email, image embeds, code, comments and metadata without shifting offsets',()=>{
 const table='| Title Tag | [Fake](https://fake.org) |\n|---|---|\n| Primary Keyword | care |';const body=table+'\n\n```\n[Fake](https://fake.org)\n```\n\n`[Fake](https://fake.org)` <!-- [Fake](https://fake.org) --> %% [Fake](https://fake.org) %%\n![Alt](https://fake.org/image.webp) ![[image.webp]]\n[Self](#h) [Home](/current) [Self URL](https://facility.example/current#h) [Mail](mailto:a@b.com)\n\n[Real](https://source.org)';const r=a.analyze({meta,body});assert.equal(check(r,'Internal links').linkGroups.length,0);const external=check(r,'External links');assert.equal(external.linkGroups.length,1);const l=external.linkGroups[0].occurrences[0];assert.equal(body.slice(l.from,l.to),'[Real](https://source.org)');
});
test('empty labels fall back to the destination and different URLs with the same label remain separate',()=>{
 const r=a.analyze({meta,body:'[](/empty) [Read](/a) [Read](/b)'}),groups=check(r,'Internal links').linkGroups;assert.deepEqual(groups.map(g=>g.label),['/empty','Read','Read']);assert.deepEqual(groups.map(g=>g.target),['/empty','/a','/b']);
});
