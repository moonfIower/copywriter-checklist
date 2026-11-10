const {test}=require('node:test'),assert=require('node:assert/strict'),a=require('../src/analyzer');
test('near mentions match ordered words, inflections, connectors and punctuation with exact source ranges',()=>{
 for(const [phrase,text]of [['skilled nursing lexington tn','Skilled nursing in Lexington, TN'],['provide care','provided care; providing care; provides care'],['care facilities','care facility'],['care facility','care facilities'],['choose nursing homes','choosing a nursing home'],['write care plans','wrote care plans; writing care plans'],['Riverton, OH','Riverton OH'],['support veterans','supports the veterans']]){const found=a.ranges(text,phrase);assert.ok(found.length,phrase);for(const r of found)assert.ok(text.slice(r.from,r.to).length);}
 for(const [phrase,text]of [['skilled nursing','unskilled nursing'],['care facility','care wonderful facility'],['care facility','care. Facility'],['care facility','care\nfacility'],['care plan','plan care'],['care facility','care in a the facility'],['Riverton OH','Riverton Ohio'],['US','uses'],['care','scare'],['care facility','care and facility']])assert.equal(a.ranges(text,phrase).length,0,phrase+' / '+text);
 const text='Skilled nursing in Lexington, TN';assert.equal(text.slice(a.ranges(text,'skilled nursing lexington tn')[0].from,a.ranges(text,'skilled nursing lexington tn')[0].to),text);
});
test('multiple primary keywords count published metadata, exclude declarations, share presence checks and keep body counts separate',()=>{
 const meta={copywriter:true,content_type:'article',title_tag:'Skilled nursing in Lexington, TN',meta_description:'We provided care in Lexington, TN.',url:'example.com/blog/skilled-nursing-lexington-tn',primary_keyword:['skilled nursing lexington tn','provide care'],secondary_keywords:['unmentioned phrase'],local_keywords:['Lexington, TN'],category:'Care',category_tags:['Rehabilitation']};
 const header=Object.entries(meta).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n'),body='# Skilled nursing in Lexington, TN\n\nWe are providing care.\n\n## Options\n\nSkilled nursing in Lexington, TN is available.';const source='---\n'+header+'\n---\n'+body,r=a.analyze(a.splitDocument(source,()=>meta));
 const main=r.keywords.find(k=>k.phrase==='skilled nursing lexington tn'),verb=r.keywords.find(k=>k.phrase==='provide care');assert.equal(r.keywords.filter(k=>k.kind==='primary').length,2);assert.equal(main.count,4);assert.equal(verb.count,2);assert.equal(r.keywords.find(k=>k.phrase==='unmentioned phrase').count,0);assert.equal(r.total,a.words(a.parseBody(body).text).length);assert.match(r.checks.find(c=>c.label==='Title tag').detail,/✓ primary keyword/);assert.match(r.checks.find(c=>c.label==='Lede').detail,/✓ primary keyword/);
 for(const k of r.keywords)for(const loc of k.mentions){assert.ok(!source.slice(0,loc.from).split('\n').at(-1).startsWith('primary_keyword:'));assert.equal(a.ranges(source.slice(loc.from,loc.to),k.phrase).length,1);}
 const category=a.keywordCategories(r.checks,r.total).find(g=>g.kind==='primary');assert.equal(category.mentions,3);assert.equal(category.density,(main.density+verb.density)/2);
});
test('a primary keyword containing a comma remains a whole phrase even as a single text property',()=>{const r=a.analyze({meta:{copywriter:true,content_type:'article',primary_keyword:'skilled nursing in Lexington, TN'},body:'Skilled nursing in Lexington, TN.'});assert.equal(r.keywords.length,1);assert.equal(r.keywords[0].count,1);});

test('keyword and link selections use original offsets with BOM and CRLF',()=>{
 const meta={copywriter:true,content_type:'article',title_tag:'Care guide',primary_keyword:['care']};
 const raw='\uFEFF---\r\ncontent_type: article\r\ntitle_tag: Care guide\r\n---\r\n# Heading\r\n\r\nCare matters. [Guide](https://example.org/guide)';
 const r=a.analyze(a.splitDocument(raw,()=>meta));
 assert.deepEqual(r.keywords[0].mentions.map(hit=>raw.slice(hit.from,hit.to)),['Care','Care']);
 const link=r.checks.find(c=>c.label==='External links').linkGroups[0].occurrences[0];
 assert.equal(raw.slice(link.from,link.to),'[Guide](https://example.org/guide)');
});
