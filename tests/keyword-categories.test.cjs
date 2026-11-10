const {test}=require('node:test'),assert=require('node:assert/strict');const {keywordCategories}=require('../src/analyzer');
const item=(kind,n)=>({keyword:{kind,mentions:Array(n).fill({})},target:'Benchmark'});
test('category summaries average mentions and density including zero-count phrases and omit absent categories',()=>{
 const groups=keywordCategories([item('secondary',4),item('secondary',2),item('secondary',0),item('local',1),{label:'Other keyword check'}],200);
 assert.equal(groups.length,2);assert.equal(groups[0].kind,'secondary');assert.equal(groups[0].mentions,2);assert.equal(groups[0].density,1);assert.equal(groups[1].mentions,1);assert.equal(groups[1].density,.5);assert.equal(keywordCategories([item('primary',0)],0)[0].density,0);assert.deepEqual(keywordCategories([],100),[]);
});
