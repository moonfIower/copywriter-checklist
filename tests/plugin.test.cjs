const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const analyzer=require('../src/analyzer');
const sidebar=require('../src/sidebar');
class Element {
 constructor(tag='div',opts={}){this.tag=tag;this.text=opts.text||'';this.cls=opts.cls||'';this.children=[];this.listeners={};this.scrollTop=0;this.isConnected=true;this.style={values:{},setProperty(k,v){this.values[k]=v;}};}
 createEl(tag,opts={}){const child=new Element(tag,opts);this.children.push(child);return child;}
 createDiv(opts={}){return this.createEl('div',opts);}
 createSpan(opts={}){return this.createEl('span',opts);}
 setAttribute(name,value){this[name]=value;}
 addClass(c){this.cls+=' '+c;}
 empty(){this.children=[];}
 addEventListener(name,fn){this.listeners[name]=fn;}
 all(){return [this,...this.children.flatMap(c=>c.all())];}
}
class MarkdownView {}
class TFile {constructor(path,size=0){this.path=path;this.basename=path;this.stat={size};}}
const effect={define:()=>({of:x=>x})};
const settingsRows=[];
const obsidian={setIcon:()=>{},PluginSettingTab:class {constructor(){this.containerEl=new Element();}},Setting:class {constructor(){this.inputs=[];this.buttons=[];this.controlEl=new Element();settingsRows.push(this);}setName(n){this.name=n;return this;}setDesc(){return this;}addText(fn){const input={inputEl:{setAttribute:()=>{}},setValue(v){this.value=v;return this;},setPlaceholder(){return this;},onChange(cb){this.change=cb;return this;}};fn(input);this.inputs.push(input);return this;}addDropdown(fn){const d={addOption(){return this;},setValue(v){this.value=v;return this;},onChange(cb){this.change=cb;return this;}};fn(d);this.inputs.push(d);return this;}addTextArea(fn){return this.addText(fn);}addToggle(fn){return this.addText(fn);}addButton(fn){const button={setButtonText(){return this;},onClick(cb){this.click=cb;return this;}};fn(button);this.buttons.push(button);return this;}},Plugin:class {},ItemView:class {constructor(){this.contentEl=new Element();}},MarkdownView,TFile,Notice:class {},parseYaml:input=>input.includes('fixture_no_profile: true')?{}:input.includes('test_table_fixture: true')?({copywriter:true,content_type:'article'}):({copywriter:true,'content_type':'article',primary_keyword:'cash flow',secondary_keywords:['Northfield Care Center','Brownsville','Tennessee'],topical_keywords:['rehabilitation'],local_keywords:['Northfield County']}),editorInfoField:{}};
const sandbox={module:{exports:{}},require:id=>id==='obsidian'?obsidian:id==='@codemirror/view'?{WidgetType:class{},EditorView:{},ViewPlugin:{fromClass:c=>c},Decoration:{none:[],set:x=>x,mark:opts=>({range:(from,to)=>({from,to,cls:opts.class})})}}:id==='@codemirror/state'?{StateEffect:effect}:id==='./support'?require('../src/support'):id==='./bookmark'?require('../src/bookmark'):id==='./sidebar'?sidebar:analyzer,console,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/plugin'),'utf8'),sandbox);
const Plugin=sandbox.module.exports;
function setup(text){
 const plugin=new Plugin();plugin.addSettingTab=()=>{};const file=new TFile('Draft.md');let rendered;
 plugin.generation=1;plugin.target={file,getMode:()=>'source',editor:{getValue:()=>text}};
 plugin.app={workspace:{getLeavesOfType:()=>[{view:{render:(...args)=>rendered=args}}]},metadataCache:{getFirstLinkpathDest:p=>p==='small.webp'?new TFile(p,99999):p==='large.webp'?new TFile(p,100000):null},vault:{cachedRead:()=>{throw Error('Should use unsaved editor buffer');}}};
 return {plugin,get:()=>rendered};
}
test('panel analyzes unsaved buffer and local image size threshold without network',async()=>{
 const {plugin,get}=setup('---\ncopywriter: true\n---\n![A](small.webp) ![B](large.webp) ![C](https://remote/image.webp)');
 await plugin.updatePanel();
 const checks=get()[2];assert.equal(checks[0].status,'pass');assert.equal(checks[1].status,'review');assert.equal(checks[2].status,'manual');
});
test('ordinary notes are read without mutation and produce opt-out result',async()=>{
 const {plugin,get}=setup('# Ordinary note');await plugin.updatePanel();assert.equal(get()[1].optedIn,false);
});
test('outdated reading-mode analysis is discarded after active note changes',async()=>{
 const {plugin,get}=setup('');let resolve;
 plugin.target.getMode=()=>'preview';plugin.app.vault.cachedRead=()=>new Promise(r=>resolve=r);
 const pending=plugin.updatePanel();plugin.generation++;resolve('# Old note');await pending;assert.equal(get(),undefined);
});
test('registered editor extension checks opt-in and clears when toggle is disabled',async()=>{
 const plugin=new Plugin();plugin.addSettingTab=()=>{};let Extension;
 plugin.loadData=async()=>({highlight:true});plugin.registerView=()=>{};plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=e=>Extension=e;
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};
 await plugin.onload();plugin.target={file:{path:'Draft.md'}};
 const view=text=>({state:{field:()=>({file:{path:'Draft.md'}}),doc:{toString:()=>text}}});
 assert.equal(new Extension(view('# Ordinary')).decorations.length,0);
 assert.equal(new Extension(view('---\ncopywriter: true\n---\ncash flow')).decorations.length,1);
 plugin.target.file.path='Other.md';assert.equal(new Extension(view('---\ncopywriter: true\n---\ncash flow')).decorations.length,0);
 plugin.target.file.path='Draft.md';
 const marks=new Extension(view('---\ncopywriter: true\n---\nNorthfield Care Center in Brownsville, Tennessee')).decorations;assert.equal(marks.length,3);
 const colored=new Extension(view('---\ncopywriter: true\n---\ncash flow rehabilitation Northfield County')).decorations;assert.deepEqual(Array.from(colored,m=>m.cls),['cw-keyword-primary','cw-keyword-topical','cw-keyword-local']);
 plugin.highlight=false;assert.equal(new Extension(view('---\ncopywriter: true\n---\ncash flow')).decorations.length,0);
});

test('collapsible section state survives refresh and saving highlight preferences',async()=>{
 const plugin=new Plugin();plugin.addSettingTab=()=>{};let factory,saved;
 plugin.loadData=async()=>({highlight:false,collapsed:{Content:true}});plugin.saveData=async d=>saved=structuredClone(d);
 plugin.registerView=(_name,f)=>factory=f;plugin.addRibbonIcon=icon=>assert.equal(icon,'pencil');plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};
 await plugin.onload();plugin.refreshEditors=()=>{};plugin.schedule=()=>{};
 const panel=factory({});const r=analyzer.analyze({meta:{copywriter:true,content_type:'article'},body:'# A heading\n\nA lede.\n\n## A section\n\nBody.'});
 panel.render({basename:'Draft'},r,[]);
 const groups=panel.contentEl.all().filter(e=>e.cls==='cw-section');assert.equal(groups.length,6);
 const content=groups.find(e=>e.children[0].all().some(c=>c.text==='Content'));assert.equal(content.open,false);
 content.open=true;content.listeners.toggle();await Promise.resolve();assert.equal(plugin.collapsed.Content,false);
 await plugin.setHighlight(true);assert.equal(saved.highlight,true);assert.equal(saved.collapsed.Content,false);
 panel.render({basename:'Draft'},r,[]);assert.equal(panel.contentEl.all().find(e=>e.tag==='details'&&e.children[0].all().some(c=>c.text==='Content')).open,true);
 const actuals=panel.contentEl.all().filter(e=>e.cls==='cw-metric'),targets=panel.contentEl.all().filter(e=>e.cls==='cw-target');
 assert.equal(actuals.length,r.checks.filter(c=>c.detail).length);assert.equal(targets.length,r.checks.filter(c=>c.target).length);
 assert.ok(targets.every(e=>e.children.length===1&&e.children[0].text.length>0));
});

test('find diagnostic selects and scrolls without modifying editor text; stale snapshot rejected',async()=>{
 const plugin=new Plugin();let selected,scrolled;const text='# Heading\n\nBody';
 plugin.app={workspace:{setActiveLeaf:()=>{}}};plugin.schedule=()=>{};
 plugin.target={file:{path:'Draft.md'},leaf:{},getMode:()=>'source',editor:{getValue:()=>text,offsetToPos:n=>n,setSelection:(...v)=>selected=v,scrollIntoView:r=>scrolled=r,focus:()=>{}}};
 await plugin.jumpTo('Draft.md',{from:0,to:9},text);assert.deepEqual(selected,[0,9]);assert.equal(scrolled.from,0);
 selected=null;await plugin.jumpTo('Draft.md',{from:0,to:9},'old text');assert.equal(selected,null);
});

test('settings controls persist valid benchmarks, reject reversed ranges and reset without losing preferences',async()=>{
 const plugin=new Plugin();let tab,saved;
 plugin.addSettingTab=t=>tab=t;plugin.loadData=async()=>({highlight:true,collapsed:{Content:true}});plugin.saveData=async d=>saved=structuredClone(d);
 plugin.registerView=()=>{};plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await plugin.onload();plugin.schedule=()=>{};
 settingsRows.length=0;tab.display();const title=settingsRows.find(r=>r.name==='Title tag characters');
 title.inputs[1].change('80');await Promise.resolve();assert.equal(saved.benchmarks.ranges.title[1],80);
 title.inputs[0].change('90');assert.equal(plugin.benchmarks.ranges.title[0],30);
 const reset=settingsRows.find(r=>r.name==='Restore default benchmarks');await reset.buttons[0].click();assert.equal(saved.benchmarks.ranges.title[1],60);assert.equal(saved.highlight,true);assert.equal(saved.collapsed.Content,true);
});

test('minimal panel has fixed SERP preview, no explanatory blocks, and score-dependent colors',async()=>{
 const plugin=new Plugin();let factory;plugin.addSettingTab=()=>{};plugin.loadData=async()=>({});plugin.registerView=(_t,f)=>factory=f;plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await plugin.onload();
 const panel=factory({}),base=analyzer.analyze({meta:{copywriter:true,content_type:'article'},body:'Text'});
 for(const [checks,color]of [[[{status:'pass'}],'#6c9275'],[[{status:'pass'},{status:'review'}],'#c3b578'],[[{status:'review'}],'#b78181']]){
  panel.render({basename:'Draft'},{...base,checks},[]);const all=panel.contentEl.all();assert.equal(all.find(e=>e.cls==='cw-gauge').style.values['--cw-score-color'],color);
  assert.equal(all.find(e=>e.cls==='cw-preview').tag,'div');assert.ok(all.some(e=>e.text==='SERP preview'));
  assert.ok(!all.some(e=>/How scoring works|not a search ranking|Approximation only|Pass = local rule|local analysis/.test(e.text)));
 }
});

test('POV renders three counted groups and complex words render inline buttons',async()=>{
 const plugin=new Plugin();let factory;plugin.addSettingTab=()=>{};plugin.loadData=async()=>({});plugin.registerView=(_t,f)=>factory=f;plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await plugin.onload();
 const panel=factory({}),r=analyzer.analyze({meta:{copywriter:true,content_type:'article'},body:'We help you. They provide rehabilitation and rehabilitation.'});panel.render({basename:'Draft'},r,[]);
 const all=panel.contentEl.all(),groups=all.filter(e=>e.cls==='cw-pov-group');assert.equal(groups.length,3);
 assert.deepEqual(groups.map(e=>e.children[0].text),['First person · 1','Second person · 1','Third person · 1']);
 const complex=all.find(e=>e.cls==='cw-check cw-info'&&e.children.some(c=>c.text.includes('Complex words')));assert.ok(complex.all().some(e=>e.cls==='cw-cues cw-inline'));assert.ok(complex.all().some(e=>e.tag==='button'&&e.all().some(c=>c.text==='rehabilitation')));
});
test('old paragraph default migrates to 250 while custom/post-update choices remain',async()=>{
 for(const [saved,expected]of [[{benchmarks:{maxWords:100}},250],[{benchmarks:{maxWords:200}},200],[{benchmarks:{maxWords:100},contentUIVersion:1},100]]){
  const plugin=new Plugin();plugin.addSettingTab=()=>{};plugin.loadData=async()=>saved;plugin.registerView=()=>{};plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
  plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await plugin.onload();assert.equal(plugin.benchmarks.maxWords,expected);
 }
});

test('ignore vocabulary saves and survives restoring benchmark defaults',async()=>{
 const plugin=new Plugin();let tab,saved;plugin.addSettingTab=t=>tab=t;plugin.loadData=async()=>({});plugin.saveData=async d=>saved=structuredClone(d);
 plugin.registerView=()=>{};plugin.addRibbonIcon=()=>{};plugin.addCommand=()=>{};plugin.registerEvent=()=>{};plugin.register=()=>{};plugin.registerEditorExtension=()=>{};
 plugin.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await plugin.onload();plugin.schedule=()=>{};settingsRows.length=0;tab.display();
 settingsRows.find(r=>r.name==='Ignore these words').inputs[0].change('Rehabilitation\nCommunication');await Promise.resolve();assert.deepEqual(saved.benchmarks.ignoredWords,['rehabilitation','communication']);
 await settingsRows.find(r=>r.name==='Restore default benchmarks').buttons[0].click();assert.deepEqual(saved.benchmarks.ignoredWords,['rehabilitation','communication']);
});

test('pin is restored on startup and follows parent-folder renames',async()=>{
 const p=new Plugin();const events={};let saved;p.loadData=async()=>({pinnedPath:'old/A.md'});p.saveData=async d=>saved=structuredClone(d);p.addSettingTab=()=>{};p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};
 p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:(name,fn)=>events[name]=fn},metadataCache:{on:()=>{}}};await p.onload();assert.ok(p.isSidebarPinned('old/A.md'));p.refreshEditors=()=>{};p.schedule=()=>{};events.rename({path:'new'},'old');await Promise.resolve();assert.ok(p.isSidebarPinned('new/A.md'));assert.ok(Object.hasOwn(saved.sidebarPins,'new/A.md'));
});
test('highlight colors save independently with refresh and invalid values are rejected',async()=>{
 const p=new Plugin();let saved,refresh=0;p.colors=analyzer.normalizeColors();p.sidebarPins={'A.md':1};p.benchmarks=analyzer.settingsWithDefaults({ignoredWords:['rehabilitation']});p.collapsed={};p.saveData=async d=>saved=structuredClone(d);p.refreshEditors=()=>refresh++;
 await p.setColor('primary','#123456');assert.equal(saved.colors.primary,'#123456');assert.equal(saved.sidebarPins['A.md'],1);assert.deepEqual(saved.benchmarks.ignoredWords,['rehabilitation']);assert.equal(refresh,1);
 await p.setColor('primary','invalid');assert.equal(p.colors.primary,'#123456');assert.equal(refresh,1);
});

test('scorecard contains counts and Keywords switch changes highlighting without collapsing section',async()=>{
 const p=new Plugin();let factory;p.addSettingTab=()=>{};p.loadData=async()=>({});p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();
 const panel=factory({}),result=analyzer.analyze({body:'Some text.',meta:{copywriter:true,content_type:'article'}});panel.render({path:'Draft.md',basename:'Draft'},result,[]);
 const all=panel.contentEl.all(),card=all.find(e=>e.cls==='cw-score-card');assert.ok(card.all().some(e=>e.cls==='cw-summary'&&e.text===`${result.total} words · ${result.keywords.length} keywords`));assert.ok(!all.some(e=>e.cls==='cw-toggle'));
 const section=all.find(e=>e.cls==='cw-section'&&e.children[0].all().some(c=>c.text==='Keywords')),toggle=section.all().find(e=>e.cls==='cw-highlight-switch');let prevented=false,stopped=false;
 p.setHighlight=value=>p.highlight=value;const open=section.open;toggle.listeners.click({preventDefault:()=>prevented=true,stopPropagation:()=>stopped=true});assert.equal(p.highlight,true);assert.equal(section.open,open);assert.ok(prevented&&stopped);assert.equal(toggle['aria-checked'],'true');
});

test('one complex-word button cycles occurrences and preserves position across refreshes',async()=>{
 const p=new Plugin();let factory;const selections=[];p.addSettingTab=()=>{};p.loadData=async()=>({});p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.jumpTo=async(_path,l)=>selections.push(l.from);
 const panel=factory({}),body='Rehabilitation helps rehabilitation.',r=analyzer.analyze({body,meta:{copywriter:true,content_type:'article'}});r.docText=body;
 const file={path:'Draft.md',basename:'Draft'};panel.render(file,r,[]);
 let buttons=panel.contentEl.all().filter(e=>e.cls==='cw-find cw-word-group');assert.equal(buttons.length,1);assert.ok(buttons[0].all().some(e=>e.cls==='cw-word-count'&&e.text==='2'));
 await buttons[0].listeners.click();panel.render(file,r,[]);buttons=panel.contentEl.all().filter(e=>e.cls==='cw-find cw-word-group');await buttons[0].listeners.click();await buttons[0].listeners.click();assert.deepEqual(selections,[0,21,0]);
});

test('keyword titles cycle mentions, section headings have quick counts and TOC buttons navigate',async()=>{
 const p=new Plugin();let factory;const selections=[];p.addSettingTab=()=>{};p.loadData=async()=>({});p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.jumpTo=async(_path,l)=>selections.push(l.from);
 const body='## A useful section\n\nKeyword here. Another keyword.',r=analyzer.analyze({body,meta:{copywriter:true,content_type:'article',primary_keyword:'keyword'}});r.docText=body;const panel=factory({}),file={path:'Draft.md',basename:'Draft'};panel.render(file,r,[]);
 const all=panel.contentEl.all(),button=all.find(e=>e.cls.startsWith('cw-keyword-chip')&&e.tag==='button');await button.listeners.click();panel.render(file,r,[]);const next=panel.contentEl.all().find(e=>e.cls.startsWith('cw-keyword-chip')&&e.tag==='button');await next.listeners.click();await next.listeners.click();assert.deepEqual(selections,r.keywords[0].mentions.map(l=>l.from).concat(r.keywords[0].mentions[0].from));
 assert.equal(all.filter(e=>e.cls==='cw-section-counts').length,6);assert.ok(all.some(e=>e.cls==='cw-section-counts'&&/passed.*close.*review/.test(e.text)));
 const toc=all.find(e=>e.cls==='cw-toc-row');assert.ok(toc);await toc.children[0].listeners.click();assert.equal(selections.at(-1),0);
});

test('dismissals persist per note, survive rename, and clear on deletion',async()=>{
 const p=new Plugin(),events={};let saved;p.loadData=async()=>({dismissed:{'old/A.md':{finding:true}},briefCoverage:{'old/A.md':{Costs:true}}});p.saveData=async d=>saved=structuredClone(d);p.addSettingTab=()=>{};p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:(name,fn)=>events[name]=fn},metadataCache:{on:()=>{}}};await p.onload();p.schedule=()=>{};p.refreshEditors=()=>{};
 await p.dismissFindings('Other.md',['other']);assert.equal(saved.dismissed['old/A.md'].finding,true);
 events.rename({path:'new'},'old');await Promise.resolve();assert.equal(saved.dismissed['new/A.md'].finding,true);assert.equal(saved.dismissed['old/A.md'],undefined);
 await p.restoreFindings('Other.md');assert.equal(saved.dismissed['Other.md'],undefined);
 events.delete({path:'new'});await Promise.resolve();assert.equal(saved.dismissed['new/A.md'],undefined);
});
test('sidebar dismiss buttons hide and restore findings',async()=>{
 const p=new Plugin();let factory;p.loadData=async()=>({});p.saveData=async()=>{};p.addSettingTab=()=>{};p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.schedule=()=>{};
 const panel=factory({}),file={path:'Draft.md'},body='The the team. TODO',r=analyzer.analyze({meta:{copywriter:true,content_type:'article',content_brief:['Costs?']},body});r.docText=body;panel.render(file,r,[]);const initialScore=panel.contentEl.all().find(e=>e.cls==='cw-gauge').children[0].text;
 const ignore=panel.contentEl.all().find(e=>e['aria-label']==='Ignore Body word count');await ignore.listeners.click({preventDefault(){},stopPropagation(){}});panel.render(file,r,[]);assert.ok(!panel.contentEl.all().some(e=>e.tag==='strong'&&/Body word count/.test(e.text)));const restore=panel.contentEl.all().find(e=>e.cls==='cw-restore');await restore.listeners.click();panel.render(file,r,[]);assert.ok(panel.contentEl.all().some(e=>e.tag==='strong'&&/Body word count/.test(e.text)));
});

test('word-limit tolerances save, accept zero and reject invalid values; old slug default migrates once',async()=>{
 for(const [saved,expected]of [[{benchmarks:{ranges:{slug:[30,60,5]}}},[20,60,10]],[{benchmarks:{ranges:{slug:[25,65,7]}}},[25,65,7]],[{metadataTableVersion:1,benchmarks:{ranges:{slug:[30,60,5]}}},[30,60,5]]]){
 const p=new Plugin();let tab,persisted;p.loadData=async()=>saved;p.saveData=async d=>persisted=structuredClone(d);p.addSettingTab=t=>tab=t;p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.schedule=()=>{};assert.deepEqual(Array.from(p.benchmarks.ranges.slug),expected);settingsRows.length=0;tab.display();const sentence=settingsRows.find(r=>r.name==='Words per sentence'),paragraph=settingsRows.find(r=>r.name==='Words per paragraph');assert.equal(sentence.inputs.length,2);assert.equal(paragraph.inputs.length,2);
 sentence.inputs[1].change('0');await Promise.resolve();assert.equal(persisted.benchmarks.maxSentenceTolerance,0);paragraph.inputs[1].change('12');await Promise.resolve();assert.equal(persisted.benchmarks.maxParagraphTolerance,12);paragraph.inputs[1].change('-1');assert.equal(p.benchmarks.maxParagraphTolerance,12);sentence.inputs[0].change('0');assert.equal(p.benchmarks.maxSentenceWords,25);assert.equal(persisted.metadataTableVersion,1);
 }
});
test('editor highlights body and published table metadata with exact source offsets',async()=>{
 const parseBefore=obsidian.parseYaml;obsidian.parseYaml=()=>({copywriter:true,content_type:'article'});
 const p=new Plugin();let Extension;p.loadData=async()=>({highlight:true});p.addSettingTab=()=>{};p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=e=>Extension=e;p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.target={file:{path:'Draft.md'}};
 const text='---\ntest_table_fixture: true\ncopywriter: true\ncontent_type: article\n---\n| **Title Tag** | Care in Riverton |\n|---|---|\n| **Primary Keyword** | care |\n| **Local Keywords** | Riverton, Ohio |\n\nCare in Riverton, Ohio. `care` [Our care](https://care.example)';
 const marks=new Extension({state:{field:()=>({file:{path:'Draft.md'}}),doc:{toString:()=>text}}}).decorations;assert.equal(marks.length,4);assert.deepEqual(Array.from(marks,m=>text.slice(m.from,m.to)),['Care','Care','Riverton, Ohio','care']);assert.ok(marks.slice(1).every(m=>m.from>text.lastIndexOf('|')));
 obsidian.parseYaml=parseBefore;
});

test('keyword categories render once each, average zero mentions, use custom category colors, and retain review cues',async()=>{
 const p=new Plugin();let factory;p.loadData=async()=>({colors:{secondary:'#d0b040'}});p.addSettingTab=()=>{};p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();
 const body='Care care. Helpful choice.',r=analyzer.analyze({body,meta:{copywriter:true,content_type:'article',primary_keyword:'care',secondary_keywords:['helpful','missing'],local_keywords:['choice'],topical_keywords:['care choice']}},{settings:{repeatDensity:100}});r.docText=body;const panel=factory({});panel.render({path:'Draft.md'},r,[]);const all=panel.contentEl.all(),categories=all.filter(e=>e.cls.startsWith('cw-keyword-category cw-category-'));
 assert.equal(categories.length,4);assert.deepEqual(categories.map(e=>e.children[0].text),['Primary keywords','Secondary keywords','Local keywords','Topical keywords']);assert.ok(!all.some(e=>e.tag==='strong'&&/secondary:/.test(e.text)));
 const secondary=categories[1],mean=secondary.all().find(e=>e.cls==='cw-keyword-category-metric');assert.equal(mean.text,`0.5 mentions · ${Number((50/r.total).toFixed(3))}% density`);assert.ok(!mean.text.includes('average'));
 const chips=secondary.all().filter(e=>e.tag==='button'&&e.cls.startsWith('cw-keyword-chip'));assert.equal(chips.length,2);assert.equal(chips[0].style.values['--cw-chip-fill'],'#d0b04026');assert.equal(chips[0].children[1].text,'1');assert.equal(chips[1].children[1].text,'0');assert.equal(chips[1].disabled,true);assert.ok(chips[1].children.some(e=>e.cls==='cw-keyword-chip-warning'));assert.equal(chips[1].listeners.click,undefined);assert.ok(secondary.all().some(e=>e['aria-label']==='Ignore missing'));
 assert.equal(secondary.all().filter(e=>e.cls==='cw-target').length,1);
});

test('link buttons appear on passing rows, cycle occurrences and reset after a note or text change',async()=>{
 const p=new Plugin();let factory;const selected=[];p.loadData=async()=>({});p.addSettingTab=()=>{};p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.jumpTo=async(path,l)=>selected.push({path,from:l.from});
 const body='[Care](/care) [Again](/care) [Other](/other) [Study](https://source.org)';const r=analyzer.analyze({meta:{copywriter:true,content_type:'article'},body});r.docText=body;const panel=factory({}),file={path:'A.md'};panel.render(file,r,[]);let buttons=panel.contentEl.all().filter(e=>e.cls==='cw-find cw-word-group cw-link-group');assert.equal(buttons.length,3);assert.equal(buttons[0].children[1].text,'2');assert.equal(buttons[0].title,'/care');await buttons[0].listeners.click();panel.render(file,r,[]);buttons=panel.contentEl.all().filter(e=>e.cls==='cw-find cw-word-group cw-link-group');await buttons[0].listeners.click();await buttons[0].listeners.click();assert.deepEqual(selected.map(l=>l.from),[0,14,0]);panel.render({path:'B.md'},r,[]);await panel.contentEl.all().find(e=>e.cls==='cw-find cw-word-group cw-link-group').listeners.click();assert.equal(selected.at(-1).from,0);assert.equal(selected.at(-1).path,'B.md');
});

test('Info findings have no remove controls, benchmarks contain only text and readability renders an accessible meter',async()=>{
 const p=new Plugin();let factory,tab,saved;p.loadData=async()=>({});p.saveData=async d=>saved=structuredClone(d);p.addSettingTab=t=>tab=t;p.registerView=(_t,f)=>factory=f;p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=()=>{};p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.schedule=()=>{};
 const r=analyzer.analyze({meta:{copywriter:true,content_type:'article'},body:'We help rehabilitation. Rehabilitation can help you.'});const panel=factory({});panel.render({path:'Draft.md'},r,[]);const all=panel.contentEl.all();for(const row of all.filter(e=>e.cls==='cw-check cw-info'))assert.ok(!row.all().some(e=>e.cls==='cw-ignore-finding'));assert.ok(!all.some(e=>e.cls==='cw-target-icon'));assert.ok(!all.some(e=>e.text==='Benchmark'));const meter=all.find(e=>e.role==='meter');assert.ok(meter);assert.ok(Number(meter['aria-valuenow'])>=0&&Number(meter['aria-valuenow'])<=100);
 settingsRows.length=0;tab.display();settingsRows.find(r=>r.name==='Complex word mentions (minimum)').inputs[0].change('3');await Promise.resolve();assert.equal(saved.benchmarks.complexMinMentions,3);settingsRows.find(r=>r.name==='Complex word mentions (minimum)').inputs[0].change('0');assert.equal(p.benchmarks.complexMinMentions,3);
});


test('editor marks include a full pluralized phrase and punctuation inside local keywords',async()=>{
 const parseBefore=obsidian.parseYaml;obsidian.parseYaml=()=>({copywriter:true,content_type:'article'});
 const p=new Plugin();let Extension;p.loadData=async()=>({highlight:true});p.addSettingTab=()=>{};p.registerView=()=>{};p.addRibbonIcon=()=>{};p.addCommand=()=>{};p.registerEvent=()=>{};p.register=()=>{};p.registerEditorExtension=e=>Extension=e;p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};await p.onload();p.target={file:{path:'Draft.md'}};
 const text='---\ntest_table_fixture: true\ncopywriter: true\n---\n| Title Tag | Care |\n|---|---|\n| Primary Keyword | sensory integration disorder |\n| Local Keywords | Riverton, OH |\n\nSensory integration disorders in Riverton, OH. Riverton, Ohio is nearby.';const marks=new Extension({state:{field:()=>({file:{path:'Draft.md'}}),doc:{toString:()=>text}}}).decorations;assert.deepEqual(Array.from(marks,m=>text.slice(m.from,m.to)),['Sensory integration disorders','Riverton, OH']);
 obsidian.parseYaml=parseBefore;
});

test('pinned Copywriter notes work without the checkbox, keep their source unchanged, and retain assignment after unpin',async()=>{
 const original=obsidian.parseYaml;obsidian.parseYaml=()=>({content_type:'article',primary_keyword:'care'});
 try{const text='---\ncontent_type: article\n---\n# Care\n\nCare for residents.';const {plugin,get}=setup(text);plugin.sidebarPins={'Draft.md':123};plugin.assigned={'Draft.md':true};await plugin.updatePanel();assert.equal(get()[1].optedIn,true);assert.equal(plugin.document(text,'Draft.md').meta.copywriter,true);assert.equal(plugin.target.editor.getValue(),text);delete plugin.sidebarPins['Draft.md'];assert.equal(plugin.isAssigned('Draft.md'),true);const restored=new Plugin();restored.assigned=JSON.parse(JSON.stringify(plugin.assigned));assert.equal(restored.isAssigned('Draft.md'),true);assert.equal(restored.isAssigned('Other.md'),false);}
 finally{obsidian.parseYaml=original;}
});

test('an unpinned article populates the checklist; a note with no content type does not',async()=>{
 const draft=setup('---\ncontent_type: article\n---\n# Care');await draft.plugin.updatePanel();assert.ok(draft.get()[1].checks.length);assert.equal(draft.plugin.isSidebarPinned('Draft.md'),false);
 const ordinary=setup('---\nfixture_no_profile: true\n---\n# Care');await ordinary.plugin.updatePanel();assert.equal(ordinary.get()[1].optedIn,false);
});

test('note properties copy as paste-ready frontmatter without the retired content brief',async()=>{
 const p=new Plugin();let tab,clipboard;
 sandbox.navigator={clipboard:{writeText:async value=>{clipboard=value;}}};
 p.loadData=async()=>({benchmarks:{briefTopics:['Old topic']}});p.addSettingTab=t=>tab=t;
 for(const name of ['registerView','addRibbonIcon','addCommand','registerEvent','register','registerEditorExtension'])p[name]=()=>{};
 p.app={workspace:{on:()=>{},onLayoutReady:()=>{}},vault:{on:()=>{}},metadataCache:{on:()=>{}}};
 await p.onload();tab.display();
 const elements=tab.containerEl.all();assert.equal(elements.find(e=>e.tag==='h3').text,'Copywriter Note Properties');
 await elements.find(e=>e.tag==='button'&&e.cls==='cw-copy-properties').onclick();
 assert.match(clipboard,/^---\ncontent_type: article\n/);
 assert.match(clipboard,/^primary_keyword: \[\]$/m);
 assert.match(clipboard,/\nword_goal:\nword_count:\n---\n$/);
 assert.doesNotMatch(clipboard,/content_brief|copywriter: true/);
 assert.equal(analyzer.analyze({meta:{copywriter:true,content_type:'article',content_brief:['Old topic']},body:'A draft.'}).brief,undefined);
 delete sandbox.navigator;
});
