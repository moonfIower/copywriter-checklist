const {test}=require('node:test'),assert=require('node:assert/strict'),a=require('../src/analyzer');
test('keyword plurals match complete final words and retain exact locations',()=>{
 const text='Sensory integration disorder and sensory integration disorders; sensory integrations disorder; sensory integration disorderly.';const ranges=a.ranges(text,'sensory integration disorder');assert.equal(ranges.length,3);assert.deepEqual(ranges.map(r=>text.slice(r.from,r.to)),['Sensory integration disorder','sensory integration disorders','sensory integrations disorder']);
 for(const [word,plural]of [['facility','facilities'],['box','boxes'],['therapy','therapies'],['child','children'],['diagnosis','diagnoses'],['life','lives']])assert.equal(a.ranges(plural,word).length,1);
 assert.equal(a.ranges('caring','care').length,1);assert.equal(a.ranges("disorder’s",'disorder').length,0);assert.equal(a.ranges('disorders','disorders').length,1);
});
test('plural keyword presence and body mentions share one matcher with code/table exclusions',()=>{
 const meta={copywriter:true,content_type:'article',primary_keyword:'sensory integration disorder',title_tag:'Sensory integration disorders explained',meta_description:'Sensory integration disorders can affect daily function. Learn about assessment and support.',slug:'/sensory-integration-disorders',secondary_keywords:['care facility']};
 const body='# Sensory integration disorders explained\n\nSensory integration disorders affect daily function.\n\n## Care facilities offer support\n\nA care facility helps. `sensory integration disorders`';const r=a.analyze({meta,body});assert.equal(r.keywords[0].count,2);assert.equal(r.keywords[1].count,2);for(const label of ['Title tag','Meta description','Slug','H1 heading'])assert.match(r.checks.find(c=>c.label===label).detail,/✓ primary keyword/);assert.match(r.checks.find(c=>c.label==='Heading character counts').detail,/1 secondary keyword/);
 for(const keyword of r.keywords)for(const l of keyword.mentions)assert.ok(body.slice(l.from,l.to).length>=keyword.phrase.length);
});
test('punctuation remains inside the entire matched phrase and acronyms do not gain false plurals',()=>{
 const text='Riverton, OH and Riverton, Ohio; uses in the US.';const found=a.ranges(text,'Riverton, OH');assert.equal(found.length,1);assert.equal(text.slice(found[0].from,found[0].to),'Riverton, OH');assert.equal(a.ranges(text,'US').length,1);assert.equal(a.ranges('constructors','constructor').length,1);
});
