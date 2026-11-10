const {test}=require('node:test');const assert=require('node:assert/strict');
const {ChecklistSidebarRouter,normalizeSidebarPins,renameSidebarPins,getChecklistRouter}=require('../src/sidebar');
class MarkdownView{}
function harness(){
 const leaves=[],events=new Map(),states=[],revealed=[],focus=[],core={enabled:true};let editor=null;
 const app={internalPlugins:{getPluginById:()=>core,enablePlugin:async()=>core.enabled=true}};
 const makeLeaf=type=>{const leaf={type,detached:false,view:{getViewType:()=>leaf.type},setViewState:async({type})=>{leaf.type=type;states.push(type);},detach:()=>leaf.detached=true};leaves.push(leaf);return leaf;};
 app.workspace={on:(name,fn)=>{const ref={name,fn};if(!events.has(name))events.set(name,[]);events.get(name).push(ref);return ref;},offref:ref=>events.set(ref.name,events.get(ref.name).filter(x=>x!==ref)),getActiveViewOfType:()=>editor,getLeavesOfType:type=>leaves.filter(l=>!l.detached&&l.type===type),getRightLeaf:()=>makeLeaf('empty'),revealLeaf:async leaf=>revealed.push(leaf),setActiveLeaf:(leaf,opts)=>focus.push({leaf,opts})};
 const router=new ChecklistSidebarRouter(app,MarkdownView),entries={};
 function register(id,viewType,pins={}){const entry={id,viewType,pins:normalizeSidebarPins(pins),saves:0,getPins:()=>entry.pins,persist:async()=>entry.saves++};router.register(entry);entries[id]=entry;return entry;}
 function active(path){if(!path){editor=null;return;}editor=Object.assign(new MarkdownView(),{file:{path,extension:'md'}});editor.leaf={view:editor};}
 async function navigate(path){active(path);for(const ref of events.get('active-leaf-change')||[])ref.fn(editor?.leaf);await router.pending;}
 return {app,router,entries,register,active,navigate,leaves,events,states,revealed,focus,core,makeLeaf};
}
test('article → manuscript → ordinary note switches one sidebar slot to copywriter/manuscript without opening Outline',async()=>{
 const h=harness();h.register('copywriter','cw',{'Articles/A.md':1});h.register('manuscript','mc',{'Books/B.md':2});
 await h.navigate('Articles/A.md');const leaf=h.revealed.at(-1);assert.equal(leaf.type,'cw');await h.navigate('Books/B.md');assert.equal(h.revealed.at(-1),leaf);assert.equal(leaf.type,'mc');await h.navigate('Notes/C.md');assert.equal(leaf.detached,true);assert.equal(h.app.workspace.getLeavesOfType('outline').length,0);await h.navigate('Articles/A.md');assert.equal(h.revealed.at(-1).type,'cw');
 assert.equal(h.leaves.filter(l=>!l.detached).length,1);assert.ok(h.focus.every(f=>f.opts.focus===false));
});
test('pinning many notes remembers all associations and reassignment gives only one owner',async()=>{
 const h=harness(),c=h.register('copywriter','cw'),m=h.register('manuscript','mc');h.active('A.md');await h.router.remember('copywriter','A.md',true);h.active('B.md');await h.router.remember('copywriter','B.md',true);
 assert.ok(Object.hasOwn(c.pins,'A.md')&&Object.hasOwn(c.pins,'B.md'));h.active('A.md');await h.router.remember('manuscript','A.md',true);assert.ok(!Object.hasOwn(c.pins,'A.md'));assert.ok(Object.hasOwn(m.pins,'A.md'));assert.ok(Object.hasOwn(c.pins,'B.md'));assert.equal(h.revealed.at(-1).type,'mc');
 await h.router.remember('manuscript','A.md',false);assert.equal(h.revealed.at(-1).detached,true);assert.ok(c.saves>0&&m.saves>0);
});
test('unassigned note does not open or enable Outline or disturb other panels',async()=>{
 const h=harness();h.core.enabled=false;h.register('copywriter','cw');const search=h.makeLeaf('search'),outline=h.makeLeaf('outline');await h.navigate('Other.md');assert.equal(h.core.enabled,false);assert.equal(h.revealed.length,0);assert.equal(h.states.length,0);assert.equal(search.detached,false);assert.equal(outline.detached,false);
});
test('sidebar focus and repeated same-note events do not steal a manually selected panel',async()=>{
 const h=harness();h.register('copywriter','cw',{'A.md':1});await h.navigate('A.md');const count=h.revealed.length;h.active(null);for(const ref of h.events.get('active-leaf-change'))ref.fn({view:{getViewType:()=> 'search'}});await h.router.pending;assert.equal(h.revealed.length,count);
 h.active('A.md');await h.router.routeActive();assert.equal(h.revealed.length,count);
});
test('stale asynchronous routing cannot replace the newly selected note sidebar',async()=>{
 const h=harness();h.register('copywriter','cw',{'A.md':1});h.register('manuscript','mc',{'B.md':1});const leaf=h.makeLeaf('mc');let release,started;const entered=new Promise(r=>started=r);const original=leaf.setViewState;leaf.setViewState=async state=>{await original(state);if(state.type==='cw'){started();await new Promise(r=>release=r);}};
 h.active('A.md');const first=h.router.routeActive();await entered;h.active('B.md');const second=h.router.routeActive();release();await Promise.all([first,second]);assert.equal(h.revealed.at(-1).type,'mc');
});
test('redundant checklist panels are removed; unrelated sidebars are retained',async()=>{
 const h=harness();h.register('copywriter','cw',{'A.md':1});h.register('manuscript','mc');const c=h.makeLeaf('cw'),m=h.makeLeaf('mc'),search=h.makeLeaf('search');await h.navigate('A.md');assert.equal(c.detached,false);assert.equal(m.detached,true);assert.equal(search.detached,false);
});
test('remembered paths migrate/rename without conflating same basenames or touching profiles',()=>{
 const pins=normalizeSidebarPins({'One/A.md':123,'Two/A.md':456},'Old.md');assert.equal(pins['Old.md'],0);const moved=renameSidebarPins(pins,'One','New');assert.equal(moved['New/A.md'],123);assert.equal(moved['Two/A.md'],456);assert.equal(moved['One/A.md'],undefined);
});
test('two separately bundled helper copies share one router per app',()=>{
 const h=harness();const sandbox={module:{exports:{}},console};require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../src/sidebar'),'utf8'),sandbox);const other=sandbox.module.exports;assert.equal(getChecklistRouter(h.app,MarkdownView),other.getChecklistRouter(h.app,MarkdownView));
});
test('latest persisted association wins conflicts and disabling an owner retains remaining assignments',async()=>{
 const h=harness();h.register('copywriter','cw',{'A.md':1});h.register('manuscript','mc',{'A.md':2});await h.navigate('A.md');assert.equal(h.revealed.at(-1).type,'mc');h.router.unregister('manuscript');await h.router.pending;assert.equal(h.revealed.at(-1).type,'cw');h.router.unregister('copywriter');assert.equal([...h.events.values()].flat().length,0);
});

test('unpin from a focused sidebar closes its checklist without stealing editor focus',async()=>{
 const h=harness();h.register('copywriter','cw',{'A.md':1});await h.navigate('A.md');const count=h.focus.length;h.active(null);await h.router.remember('copywriter','A.md',false);assert.equal(h.revealed.at(-1).detached,true);assert.equal(h.app.workspace.getLeavesOfType('outline').length,0);assert.equal(h.focus.length,count);
});

test('new router upgrades an existing companion router in place without losing pins or listeners',async()=>{
 const h=harness();const oldCode=require('node:fs').readFileSync(require.resolve('../src/sidebar'),'utf8').replace('this.behaviorVersion=2;','').replace('if(!owner){for(const leaf of checklistLeaves)leaf.detach();return;}',"if(!owner)return;");const sandbox={module:{exports:{}},console};require('node:vm').runInNewContext(oldCode,sandbox);const old=sandbox.module.exports.getChecklistRouter(h.app,MarkdownView);const pins={'A.md':1};old.register({id:'copywriter',viewType:'cw',getPins:()=>pins,persist:async()=>{}});const upgraded=getChecklistRouter(h.app,MarkdownView);assert.equal(upgraded,old);assert.equal(upgraded.behaviorVersion,2);h.active('A.md');await upgraded.routeActive();assert.equal(h.revealed.at(-1).type,'cw');h.active('B.md');await upgraded.routeActive();assert.equal(h.revealed.at(-1).detached,true);assert.equal(h.app.workspace.getLeavesOfType('outline').length,0);assert.equal(sandbox.module.exports.getChecklistRouter(h.app,MarkdownView),upgraded);
});
