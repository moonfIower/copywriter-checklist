'use strict';
const KEY=Symbol.for('kimber.checklist-sidebar-router.v1');
function normalizeSidebarPins(saved,legacy=''){
 const pins=Object.create(null);
 for(const [path,time]of Object.entries(saved&&typeof saved==='object'?saved:{}))if(path.endsWith('.md')&&Number.isFinite(time)&&time>=0)pins[path]=time;
 if(legacy&&legacy.endsWith('.md')&&!Object.hasOwn(pins,legacy))pins[legacy]=0;
 return pins;
}
function renameSidebarPins(pins,oldPath,newPath){
 const out=Object.create(null);
 for(const [path,time]of Object.entries(pins||{}))out[path===oldPath||path.startsWith(oldPath+'/')?newPath+path.slice(oldPath.length):path]=time;
 return out;
}
class ChecklistSidebarRouter {
 constructor(app,MarkdownView){this.behaviorVersion=2;this.app=app;this.MarkdownView=MarkdownView;this.entries=new Map();this.refs=[];this.revision=0;this.lastPath=null;this.lastEditor=null;this.pending=Promise.resolve();}
 register(entry){
  this.entries.set(entry.id,entry);
  if(!this.refs.length){
   this.refs.push(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf?.view instanceof this.MarkdownView)this.routeActive().catch(console.error);}));
   this.refs.push(this.app.workspace.on('file-open',()=>this.routeActive().catch(console.error)));
  }
 }
 unregister(id){this.entries.delete(id);if(!this.entries.size){for(const ref of this.refs)this.app.workspace.offref?.(ref);this.refs=[];this.revision++;this.lastPath=null;}else this.routeActive(true).catch(console.error);}
 owner(path){return [...this.entries.values()].filter(e=>Object.hasOwn(e.getPins(),path)).sort((a,b)=>b.getPins()[path]-a.getPins()[path]||a.id.localeCompare(b.id))[0]||null;}
 async remember(id,path,enabled){
  const entry=this.entries.get(id);if(!entry||!path?.endsWith('.md'))return;
  if(enabled){for(const other of this.entries.values())if(other.id!==id&&Object.hasOwn(other.getPins(),path)){delete other.getPins()[path];await other.persist();}entry.getPins()[path]=Date.now();}
  else delete entry.getPins()[path];
  await entry.persist();entry.changed?.();await this.routeActive(true);
 }
 routeActive(force=false){
  const active=this.app.workspace.getActiveViewOfType?.(this.MarkdownView),editor=active||(force?this.lastEditor:null),file=editor?.file;
  if(!file||file.extension&&file.extension!=='md')return this.pending;
  if(active)this.lastEditor=active;
  if(this.lastPath===file.path&&!force)return this.pending;
  this.lastPath=file.path;const path=file.path,ticket=++this.revision;
  this.pending=this.pending.catch(()=>{}).then(async()=>{
   if(ticket!==this.revision||!this.entries.size)return;
   const owner=this.owner(path),ws=this.app.workspace;
   const checklistLeaves=[...this.entries.values()].flatMap(e=>ws.getLeavesOfType(e.viewType));
   // No assigned checklist: remove checklist panels without selecting another tool.
   if(!owner){for(const leaf of checklistLeaves)leaf.detach();return;}
   const type=owner.viewType;
   let leaf=ws.getLeavesOfType(type)[0]||checklistLeaves[0]||ws.getRightLeaf(false);
   if(!leaf)return;
   if(ticket!==this.revision)return;
   if(leaf.view?.getViewType?.()!==type)await leaf.setViewState({type,active:false});
   if(ticket!==this.revision)return;
   for(const other of checklistLeaves)if(other!==leaf)other.detach();
   await ws.revealLeaf(leaf);
   if(ticket===this.revision&&active&&editor.leaf)ws.setActiveLeaf?.(editor.leaf,{focus:false});
   this.entries.get(owner?.id)?.changed?.();
  });
  return this.pending;
 }
}
function getChecklistRouter(app,MarkdownView){
 if(!app[KEY])app[KEY]=new ChecklistSidebarRouter(app,MarkdownView);
 else if((app[KEY].behaviorVersion||1)<2){
  // A companion plugin may have created the shared router first, including before reload.
  Object.setPrototypeOf(app[KEY],ChecklistSidebarRouter.prototype);app[KEY].behaviorVersion=2;
 }
 return app[KEY];
}
module.exports={normalizeSidebarPins,renameSidebarPins,ChecklistSidebarRouter,getChecklistRouter};
