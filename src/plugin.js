'use strict';
const {Plugin, ItemView, MarkdownView, TFile, Notice, parseYaml, editorInfoField, PluginSettingTab, Setting, setIcon} = require('obsidian');
function pinIcon(el,pinned){setIcon(el,'pin');if(pinned){const svg=el.querySelector?.('svg');if(svg){const slash=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','line');slash.setAttribute('x1','3');slash.setAttribute('y1','3');slash.setAttribute('x2','21');slash.setAttribute('y2','21');svg.append(slash);}}}
const {ViewPlugin, Decoration,WidgetType,EditorView} = require('@codemirror/view');
const {StateEffect} = require('@codemirror/state');
const {metadataKeywordSpans,splitDocument,prepareDocument,keywordList,analyze,applyDismissals,findingKey,rowKey,ranges,parseBody,secondaryKeywords,DEFAULTS,settingsWithDefaults,checklistScore,normalizeColors,progressColor,highlightStyle,sectionCounts,keywordCategories,visibleSource,words} = require('./analyzer');
const {normalizeSidebarPins,renameSidebarPins,getChecklistRouter}=require('./sidebar');
const {wordGoal,noTooltips,rangeSetting,upperSetting,outline,WordCountSync}=require('./support');
const {MARKER,bookmarks,bookmarkChapter,bookmarkEdit,legacyBookmark}=require('./bookmark');
const PLUGIN_ID='copywriter-checklist';
const isDraft=meta=>['article','webpage'].includes(meta?.content_type);
const VIEW='copywriter-checklist-view';
const refreshHighlight=StateEffect.define();
function benchmark(parent,text){parent.createDiv({cls:'cw-target'}).createSpan({text});}
class BookmarkWidget extends WidgetType {
 constructor(plugin,from){super();this.plugin=plugin;this.from=from;}
 eq(other){return other.from===this.from;}
 toDOM(view){
  const document=view.dom.ownerDocument;const row=document.createElement('span');row.className='cw-bookmark-marker';row.setAttribute('contenteditable','false');
  const handle=document.createElement('span');handle.className='cw-bookmark-handle';handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label','Bookmark: drag to another line');
  const icon=document.createElement('span');icon.className='cw-bookmark-icon';icon.setAttribute('aria-hidden','true');setIcon(icon,'bookmark');handle.append(icon,document.createTextNode('Bookmark'));
  handle.addEventListener('mousedown',event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();
   const drag={view,from:this.from,x:event.clientX,y:event.clientY};this.plugin.bookmarkDrag=drag;row.classList.add('is-dragging');
   const doc=handle.ownerDocument,win=doc.defaultView;
   const preview=doc.createElement('div');preview.className='cw-bookmark-drop-preview';preview.hidden=true;preview.setAttribute('aria-hidden','true');doc.body.append(preview);
   let frame=null,lastPoint=null,cached=null;
   const resolveDrop=point=>{
    const bounds=view.scrollDOM.getBoundingClientRect();
    if(point.clientX<bounds.left||point.clientX>bounds.right||point.clientY<bounds.top||point.clientY>bounds.bottom)return null;
    const pos=view.posAtCoords({x:point.clientX,y:point.clientY});if(pos===null)return null;
    const line=view.state.doc.lineAt(pos);
    if(!cached||cached.doc!==view.state.doc||cached.line!==line.number){
     try{cached={doc:view.state.doc,line:line.number,edit:bookmarkEdit(view.state.doc.toString(),line.number-1)};}
     catch(_){cached={doc:view.state.doc,line:line.number,edit:null};}
    }
    if(!cached.edit)return null;
    const coords=view.coordsAtPos(line.from);if(!coords||coords.top<bounds.top||coords.top>bounds.bottom)return null;
    return {edit:cached.edit,coords,bounds};
   };
   const paint=()=>{
    frame=null;const target=lastPoint&&resolveDrop(lastPoint);
    if(!target||Math.hypot(lastPoint.clientX-drag.x,lastPoint.clientY-drag.y)<4){preview.hidden=true;return;}
    const content=view.contentDOM.getBoundingClientRect(),left=Math.max(content.left,target.bounds.left)+2,right=Math.min(content.right,target.bounds.right)-4;
    preview.hidden=false;preview.style.left=`${left}px`;preview.style.top=`${target.coords.top-2}px`;preview.style.width=`${Math.max(0,right-left)}px`;
   };
   const move=event=>{event.preventDefault();lastPoint={clientX:event.clientX,clientY:event.clientY};if(frame===null)frame=win.requestAnimationFrame(paint);};
   const scroll=()=>{if(lastPoint&&frame===null)frame=win.requestAnimationFrame(paint);};
   const finish=event=>{
    win.removeEventListener('mousemove',move,true);win.removeEventListener('mouseup',finish,true);win.removeEventListener('keydown',cancel,true);win.removeEventListener('scroll',scroll,true);
    if(frame!==null)win.cancelAnimationFrame(frame);preview.remove();
    const current=this.plugin.bookmarkDrag;this.plugin.bookmarkDrag=null;row.classList.remove('is-dragging');
    if(!current||event.type!=='mouseup'||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4)return;
    event.preventDefault();event.stopPropagation();const target=resolveDrop(event);if(!target)return;
    const text=view.state.doc.toString();if(!bookmarks(text).some(b=>b.from===current.from)){new Notice('The bookmark changed during dragging. Please try again.');return;}
    this.plugin.applyBookmark(view,target.edit);
   };
   const cancel=event=>{if(event.key==='Escape')finish(event);};
   drag.cancel=()=>finish({type:'cancel'});win.addEventListener('scroll',scroll,true);
   win.addEventListener('mousemove',move,true);win.addEventListener('mouseup',finish,true);win.addEventListener('keydown',cancel,true);
  });
  const line=document.createElement('span');line.className='cw-bookmark-divider';row.append(handle,line);noTooltips(row);return row;
 }
 ignoreEvent(){return true;}
}
class ChecklistView extends ItemView {
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;this.wordCycle=new Map();this.wordSnapshot=null;this.wordPath=null;}
 getViewType(){return VIEW;}
 getDisplayText(){return 'Copywriter Checklist';}
 getIcon(){return 'pencil';}
 async onOpen(){this.plugin.schedule();}
 async onClose(){this.contentEl.empty();}

 renderKeywordCategories(parent,file,result,items){
  const colors=normalizeColors(this.plugin.colors),number=(value,places)=>String(Number(value.toFixed(places)));
  for(const category of keywordCategories(items,result.total)){
   const block=parent.createDiv({cls:`cw-keyword-category cw-category-${category.kind}`});
   block.createEl('h4',{text:category.label,cls:'cw-keyword-category-title'});
   const density=category.density>0&&category.density<0.001?'<0.001':number(category.density,3);
   block.createEl('p',{text:`${number(category.mentions,1)} mentions · ${density}% density`,cls:'cw-keyword-category-metric'});
   if(category.target)benchmark(block,category.target);
   const chips=block.createDiv({cls:'cw-keyword-chips'});
   for(const c of category.items){
    const k=c.keyword,count=k.mentions.length,review=['review','warn'].includes(c.status);
    const pair=chips.createSpan({cls:'cw-keyword-chip-wrap'});
    const button=pair.createEl('button',{type:'button',cls:`cw-keyword-chip${review?' cw-keyword-chip-review':''}`});
    button.style.setProperty('--cw-chip-fill',colors[k.kind]+'26');
    button.style.setProperty('--cw-chip-border',colors[k.kind]+'55');
    button.createSpan({text:k.phrase,cls:'cw-keyword-chip-label'});
    button.createSpan({text:String(count),cls:'cw-keyword-chip-count'});
    const reason=count===0?'not mentioned':review?'high density':'';
    if(review)button.createSpan({text:'!',cls:'cw-keyword-chip-warning'});
    button.disabled=!count;
    button.setAttribute('aria-label',`${k.phrase}, ${count} mentions${reason?', '+reason:''}`);
    if(count)button.addEventListener('click',async()=>{const key=`keyword:${k.kind}:${k.phrase.toLowerCase()}`,index=(this.wordCycle.get(key)||0)%count;this.wordCycle.set(key,(index+1)%count);await this.plugin.jumpTo(file.path,k.mentions[index],result.docText);});
    if(review){const ignore=pair.createEl('button',{type:'button',text:'×',cls:'cw-ignore-finding cw-ignore-keyword'});ignore.setAttribute('aria-label',`Ignore ${k.phrase}`);ignore.addEventListener('click',()=>this.plugin.dismissFindings(file.path,[c.dismissKey]));}
   }
  }
 }
 show(message){this.contentEl.empty();this.contentEl.addClass('cw-panel');this.contentEl.createEl('h2',{text:'Copywriter Checklist'});this.contentEl.createEl('p',{text:message});}
 renderPin(file){const pinned=this.isPinned(file);const pin=this.contentEl.createEl('button',{cls:'cw-pin'});const icon=pin.createSpan({cls:'cw-pin-icon',attr:{'aria-hidden':'true'}});pinIcon(icon,pinned);pin.createSpan({text:pinned?'Unpin sidebar':'Pin sidebar'});pin.addEventListener('click',()=>this.plugin.setPinned(pinned?'':file?.path));noTooltips(this.contentEl);}
 isPinned(file){return this.plugin.isSidebarPinned(file?.path);}

 render(file,result,imageChecks){
  const scroll=this.contentEl.scrollTop;
  if(result.error||!result.optedIn){this.show(file.path);if(this.isPinned(file))this.renderPin(file);}else{this.contentEl.empty();this.contentEl.addClass('cw-panel');this.contentEl.createEl('h2',{text:'Copywriter Checklist'});this.contentEl.createDiv({text:file.path,cls:'cw-profile-path'});}
  if(result.error){this.contentEl.createEl('p',{text:result.error,cls:'cw-review'});return;}
  if(!result.optedIn){this.contentEl.createEl('p',{text:'Set content_type to article or webpage'});return;}
  if(this.wordSnapshot!==result.docText||this.wordPath!==file.path){this.wordCycle.clear();this.wordSnapshot=result.docText;this.wordPath=file.path;}
  const raw={...result,checks:[...result.checks,...imageChecks]};result=applyDismissals(raw,result.docText,this.plugin.dismissed?.[file.path]||{});
  const allChecks=result.checks,score=checklistScore(allChecks);
  const gauge=this.contentEl.createDiv({cls:'cw-score-card'});
  const ring=gauge.createDiv({cls:'cw-gauge'});ring.style.setProperty('--cw-score',String(score.value||0));
  ring.style.setProperty('--cw-score-color',score.value===null?'var(--text-muted)':progressColor(score.value));
  ring.setAttribute('role','img');ring.setAttribute('aria-label',`Checklist score ${score.value??'not available'} out of 100`);
  ring.createSpan({text:score.value===null?'—':`${score.value}%`});
  const explanation=gauge.createDiv();explanation.createEl('strong',{text:'Checklist score'});
  explanation.createEl('p',{text:`${score.pass} pass · ${score.near} close · ${score.review} review`,cls:'cw-help'});
  explanation.createEl('p',{text:`${result.total} words · ${result.keywords.length} keywords`,cls:'cw-summary'});
  const preview=this.contentEl.createDiv({cls:'cw-preview'});preview.createEl('h3',{text:'SERP preview'});
  preview.createDiv({text:result.preview?.url||'Your page URL',cls:'cw-preview-url'});
  preview.createDiv({text:result.preview?.title||'Add a title tag',cls:'cw-preview-title'});
  preview.createDiv({text:result.preview?.description||'Add a meta description',cls:'cw-preview-description'});
  this.renderPin(file);
  if(Object.keys(this.plugin.dismissed?.[file.path]||{}).length){const restore=this.contentEl.createEl('button',{text:'Restore ignored findings',cls:'cw-restore'});restore.addEventListener('click',()=>this.plugin.restoreFindings(file.path));}
  const groups=new Map([['Table of contents',[]]]);
  for(const c of result.checks){if(!groups.has(c.group))groups.set(c.group,[]);groups.get(c.group).push(c);}
  for(const [group,items] of groups){
   const section=this.contentEl.createEl('details',{cls:'cw-section'});section.open=!this.plugin.collapsed?.[group];
   const summary=section.createEl('summary');const arrow=summary.createSpan({cls:'cw-section-chevron',attr:{'aria-hidden':'true'}});setIcon(arrow,'chevron-right');summary.createSpan({text:group});
   const quick=sectionCounts(items);summary.createSpan({text:group==='Table of contents'?`${result.toc?.length||0} ${(result.toc?.length||0)===1?'heading':'headings'}`:`${quick.passed} passed · ${quick.close} close · ${quick.review} review`,cls:'cw-section-counts'});
   if(group==='Keywords'){
    const toggle=summary.createEl('button',{type:'button',cls:'cw-highlight-switch'});
    toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Highlight keywords in editor');toggle.setAttribute('aria-checked',String(!!this.plugin.highlight));
    toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const value=!this.plugin.highlight;toggle.setAttribute('aria-checked',String(value));this.plugin.setHighlight(value);});
   }
   section.addEventListener('toggle',()=>{if(section.isConnected)this.plugin.setCollapsed(group,!section.open);});
   const contents=section.createDiv({cls:'cw-section-body'});
   if(group==='Table of contents'){const mark=result.bookmarks?.[0],owner=mark?bookmarkChapter(result.toc||[],mark.line):-1;const showBookmark=()=>{const jump=contents.createEl('button',{cls:'cw-bookmark-link'});const icon=jump.createSpan({cls:'cw-bookmark-icon',attr:{'aria-hidden':'true'}});setIcon(icon,'bookmark');jump.createSpan({text:'Bookmark'});jump.onclick=()=>this.plugin.jumpToBookmark(file);};if(mark&&owner===-1)showBookmark();
for(const heading of result.toc||[]){const row=contents.createDiv({cls:'cw-toc-row'});const button=row.createEl('button',{text:heading.title});button.addEventListener('click',()=>this.plugin.jumpTo(file.path,heading,result.docText));const count=row.createSpan({text:`${heading.words} words${heading.long?' · long':''}`,cls:`cw-toc-count${heading.long?' cw-long-section':''}`});if(mark&&result.toc.indexOf(heading)===owner)showBookmark(); }if(!result.toc?.length)contents.createEl('p',{text:'No H2 headings.',cls:'cw-help'});const place=contents.createEl('button',{type:'button',cls:'cw-bookmark-place'});const icon=place.createSpan({cls:'cw-bookmark-icon',attr:{'aria-hidden':'true'}});setIcon(icon,'bookmark');place.createSpan({text:mark?'Move bookmark to cursor':'Place bookmark at cursor'});place.onclick=()=>this.plugin.placeBookmarkFor(file);}
  if(group==='Keywords')this.renderKeywordCategories(contents,file,result,items);
  for(const c of items){
   if(c.keyword)continue;
   const row=contents.createDiv({cls:`cw-check cw-${c.status}`});
   const ignore=(parent,ids,label)=>{if(c.status==='info')return;const button=parent.createEl('button',{text:'×',cls:'cw-ignore-finding'});button.setAttribute('aria-label',`Ignore ${label}`);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.plugin.dismissFindings(file.path,ids);});};
   if(['review','near','warn'].includes(c.status))ignore(row,[c.dismissKey],c.label);

   row.createEl('strong',{text:`${{pass:'✓ Pass',near:'✓ Pass · close',review:'! Review',warn:'! Warning',manual:'○ Manual',info:'☆ Info'}[c.status]} · ${c.label}`});
   if(c.readability?.value!==null&&c.readability?.value!==undefined){
    const value=c.readability.value,position=Math.max(0,Math.min(100,value));
    const graphic=row.createDiv({cls:'cw-readability'});graphic.setAttribute('role','meter');graphic.setAttribute('aria-label','Readability');graphic.setAttribute('aria-valuemin','0');graphic.setAttribute('aria-valuemax','100');graphic.setAttribute('aria-valuenow',String(position));graphic.setAttribute('aria-valuetext',`${value.toFixed(1)} Flesch Reading Ease; benchmark ${c.readability.min}–100`);
    const track=graphic.createDiv({cls:'cw-readability-track'});track.style.setProperty('--cw-readability',`${position}%`);track.style.setProperty('--cw-readability-min',`${Math.max(0,Math.min(100,c.readability.min))}%`);
    track.createSpan({cls:'cw-readability-threshold'});const marker=track.createSpan({cls:'cw-readability-marker'});marker.createSpan({text:value.toFixed(1),cls:'cw-readability-value'});
    const scale=graphic.createDiv({cls:'cw-readability-scale'});scale.createSpan({text:'0'});scale.createSpan({text:'100'});
   }
   if(c.detail)row.createEl('p',{text:c.detail,cls:'cw-metric'});
   if(c.target)benchmark(row,c.target);
   const buttons=(parent,locations,inline=false)=>{const wrap=parent.createDiv({cls:inline?'cw-cues cw-inline':'cw-findings'});for(const location of locations){const pair=wrap.createSpan({cls:'cw-finding-pair'});const button=pair.createEl('button',{text:location.label,cls:'cw-find'});button.addEventListener('click',()=>this.plugin.jumpTo(file.path,location,result.docText));if(c.findingKind||c.cueGroups||['Long sentences','Long paragraphs','Paragraphs after H2s','Heading character counts'].includes(c.label))ignore(pair,[location.id||findingKey(c,location,result.docText)],location.label);}};
   for(const group of c.cueGroups||[]){const block=row.createDiv({cls:'cw-pov-group'});block.createEl('div',{text:`${group.label} · ${group.count}`,cls:'cw-cue-heading'});if(group.locations.length)buttons(block,group.locations,true);}
   if(c.linkGroups?.length){
    const wrap=row.createDiv({cls:'cw-cues cw-inline'});
    for(const link of c.linkGroups){
     const button=wrap.createEl('button',{type:'button',cls:'cw-find cw-word-group cw-link-group'});button.createSpan({text:link.label});button.createSpan({text:String(link.count),cls:'cw-word-count'});
     button.title=link.target;button.setAttribute('aria-label',`${link.label}, ${link.count} occurrence${link.count===1?'':'s'}, ${link.target}`);
     button.addEventListener('click',async()=>{const key=`link:${c.label}:${link.target}`,index=(this.wordCycle.get(key)||0)%link.occurrences.length;this.wordCycle.set(key,(index+1)%link.occurrences.length);await this.plugin.jumpTo(file.path,link.occurrences[index],result.docText);});
    }
   }else if(c.wordGroups?.length){
    const wrap=row.createDiv({cls:'cw-cues cw-inline'});
    for(const word of c.wordGroups){
     const pair=wrap.createSpan({cls:'cw-finding-pair'});
     const button=pair.createEl('button',{cls:'cw-find cw-word-group'});button.createSpan({text:word.label});button.createSpan({text:String(word.count),cls:'cw-word-count'});
     ignore(pair,word.occurrences.map(l=>l.id||findingKey(c,l,result.docText)),word.label);
     
     button.setAttribute('aria-label',`${word.label}, ${word.count} occurrence${word.count===1?'':'s'}`);
     button.addEventListener('click',async()=>{const key=word.label.toLocaleLowerCase('en');const index=(this.wordCycle.get(key)||0)%word.occurrences.length;this.wordCycle.set(key,(index+1)%word.occurrences.length);await this.plugin.jumpTo(file.path,word.occurrences[index],result.docText);});
    }
   }else if(!c.wordGroups&&c.locations?.length)buttons(row,c.locations,c.inline);

   if(c.issues?.length){const list=row.createEl('ul',{cls:'cw-issues'});for(const issue of c.issues)list.createEl('li',{text:issue});}
  }
  }
  const edit=this.contentEl.createEl('button',{text:'Edit benchmarks',cls:'checklist-edit-settings'});edit.onclick=()=>this.plugin.openSettings();
  noTooltips(this.contentEl);this.contentEl.scrollTop=scroll;
 }
}
const NOTE_PROPERTIES=[
 ['content_type','article','Selects the article or webpage checklist.'],
 ['title_tag','""','Page title for search results.'],
 ['meta_description','""','Page description for search results.'],
 ['url','""','Full page URL. Supplies the slug and site hostname.'],
 ['primary_keyword','[]','Main keyword phrases.'],
 ['secondary_keywords','[]','Supporting keyword phrases.'],
 ['local_keywords','[]','Location names and phrases.'],
 ['topical_keywords','[]','Related topics and phrases to cover.'],
 ['category','""','Page or article category.'],
 ['category_tags','[]','Additional category tags, such as WordPress tags.'],
 ['word_goal','','Optional word goal. Defaults to the content type’s maximum benchmark.'],
 ['word_count','','Word count filled in by the plugin.'],
];
function renderNoteProperties(el){
 el.createEl('h3',{text:'Copywriter Note Properties'});
 const table=el.createEl('table',{cls:'cw-property-table'});
 const header=table.createEl('thead').createEl('tr');
 for(const text of ['Property','Purpose'])header.createEl('th',{text,attr:{scope:'col'}});
 const body=table.createEl('tbody');
 for(const [key,,purpose]of NOTE_PROPERTIES){const row=body.createEl('tr');row.createEl('td').createEl('code',{text:key});row.createEl('td',{text:purpose});}
 const copy=el.createEl('button',{type:'button',cls:'cw-copy-properties'});
 const icon=copy.createSpan({cls:'cw-copy-properties-icon',attr:{'aria-hidden':'true'}});setIcon(icon,'copy');copy.createSpan({text:'Copy note properties'});
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(['---',...NOTE_PROPERTIES.map(([key,value])=>value?key+': '+value:key+':'),'---',''].join('\n'));new Notice('Note properties copied.');}catch{new Notice('Could not copy note properties.');}};
}
class ChecklistSettings extends PluginSettingTab {
 constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
 display(){const el=this.containerEl;el.empty();el.addClass('cw-settings');const p=this.plugin,save=()=>{p.savePreferences();p.schedule();};
 const range=(key,label)=>rangeSetting(el,Setting,label,p.benchmarks.ranges[key],value=>{p.benchmarks.ranges[key]=value;save();});
 const number=(key,label)=>new Setting(el).setName(label).addText(input=>input.setValue(String(p.benchmarks[key])).onChange(v=>{const n=Number(v);if(!v.trim()||!Number.isFinite(n)||(key.endsWith('Tolerance')?n<0:n<=0))return;p.benchmarks[key]=n;save();}));
 renderNoteProperties(el);
 new Setting(el).setName('Update word count properties').setDesc('Automatically write word_count and word_goal to drafts you check or pin.').addToggle(t=>t.setValue(p.syncWordProperties).onChange(v=>{p.syncWordProperties=v;save();}));
 outline(el,Setting,'Table of contents',[['H2 sections & bookmark','H2 word counts, long sections, a movable bookmark and jump buttons.']]);number('maxSectionWords','Long H2 section above this many words');
 outline(el,Setting,'Metadata',[['Title tag, description & slug','Length and primary keyword checks. Webpage slugs have no minimum or keyword requirement; URL uses its final path segment.'],['Legacy metadata table','Note properties take priority over table values.']]);range('title','Title tag characters');range('meta','Meta description characters');range('slug','Slug characters');
 outline(el,Setting,'Structure',[['H1 heading','Character count, primary keyword and a single H1.'],['Heading depth & hierarchy','H1–H3, no skipped levels, H3s under H2s.'],['Paragraphs after H2s','Each H2 needs a following paragraph.'],['Secondary keywords in H2s','At least one configured secondary keyword.']]);range('h1','H1 characters');range('h2count','H2 heading count');range('h2','H2 characters');number('maxH3','H3s per H2 (fewer than)');
 outline(el,Setting,'Content',[['Lede','Character count and primary keyword.'],['Duplicate elements','Missing elements, repeated headings/paragraphs and meta description matching the lede.'],['Word count properties','When enabled, word_count updates on eligible drafts. word_goal is a number, starting at the content type’s maximum benchmark; edit it for this note.'],['Style elements','Lists, bold, content tables, images and quotes; metadata is excluded.'],['Paragraphs','Paragraph count and average words/sentences; separate long sentence and long paragraph findings.'],['Readability','Flesch Reading Ease range and configured minimum.'],['Point of view','First-, second- and third-person cue counts and jumps.']]);range('lede','Lede characters');range('article','Article words');range('webpage','Webpage words');for(const [maximum,tolerance,label]of [['maxSentenceWords','maxSentenceTolerance','Words per sentence'],['maxWords','maxParagraphTolerance','Words per paragraph']])upperSetting(el,Setting,label,[p.benchmarks[maximum],p.benchmarks[tolerance]],value=>{p.benchmarks[maximum]=value[0];p.benchmarks[tolerance]=value[1];save();});number('minReadability','Minimum readability');
 el.createEl('h4',{text:'Complex words',cls:'cw-settings-subheading'});number('complexSyllables','Complex word syllables (minimum)');number('complexMinLetters','Complex word letters (minimum)');number('complexMinMentions','Complex word mentions (minimum)');
 new Setting(el).setName('Ignore these words').addTextArea(t=>t.setValue(p.benchmarks.ignoredWords.join('\n')).onChange(v=>{p.benchmarks.ignoredWords=secondaryKeywords(v).map(w=>w.toLowerCase());save();}));for(const [key,label]of [['excludeKeywordWords','Exclude keyword words'],['excludeProperNames','Exclude likely proper names']])new Setting(el).setName(label).addToggle(t=>t.setValue(p.benchmarks[key]).onChange(v=>{p.benchmarks[key]=v;save();}));
 outline(el,Setting,'Keywords',[['Keyword groups','Mentions, density, plural variants, average category summaries and counted jump bubbles. Zero-count bubbles are neutral.'],['Mention guidance','Primary: webpages 4–6, articles 8–10; other categories 1–2. Only absent or heavily repeated phrases flag.']]);number('repeatDensity','Keyword overuse above this density (%)');number('clusterMentions','Keyword clustering at this many mentions per paragraph');for(const kind of ['primary','secondary','local','topical']){const row=new Setting(el).setName(kind[0].toUpperCase()+kind.slice(1)+' highlight color'),input=row.controlEl.createEl('input',{type:'color'});input.value=p.colors[kind];input.oninput=()=>p.setColor(kind,input.value);}
 outline(el,Setting,'Links & images',[['Internal & external links','Distinct destinations; counted jump buttons.'],['Anchor text','Vague labels need review.'],['Images','Descriptive alt text, WebP type and local file size. Image rows appear only when an image is present; remote sizes remain manual.']]);number('minInternal','Minimum internal links');number('minExternal','Minimum external links');number('maxImageBytes','Maximum image bytes (exclusive)');
 el.createEl('hr',{cls:'cw-restore-divider'});
 const reset=new Setting(el);reset.settingEl?.addClass('cw-restore-benchmarks');reset.setName('Restore default benchmarks').addButton(b=>b.setButtonText('Restore defaults').onClick(()=>{const {ignoredWords}=p.benchmarks;p.benchmarks=settingsWithDefaults();Object.assign(p.benchmarks,{ignoredWords});save();this.display();}));noTooltips(el);
 }
}
class CopywriterChecklist extends Plugin {
 async onload(){
  const saved=await this.loadData();
  this.dismissed=saved?.dismissed&&typeof saved.dismissed==='object'?saved.dismissed:{};
  this.highlight=!!saved?.highlight;
  this.colors=normalizeColors(saved?.colors);
  this.assigned=Object.assign(Object.create(null),saved?.assigned||{});
  this.sidebarPins=normalizeSidebarPins(saved?.sidebarPins,saved?.sidebarPinVersion?'':saved?.pinnedPath);
  this.router=getChecklistRouter(this.app,MarkdownView);
  for(const path of Object.keys(this.sidebarPins))this.assigned[path]=true;
  this.router.register({id:PLUGIN_ID,viewType:VIEW,getPins:()=>this.sidebarPins,persist:()=>this.savePreferences(),changed:()=>{this.refreshEditors();this.schedule();}});
  this.register(()=>this.router.unregister(PLUGIN_ID));
  this.benchmarks=settingsWithDefaults(saved?.benchmarks);
  if(!saved?.metadataTableVersion&&JSON.stringify(saved?.benchmarks?.ranges?.slug)===JSON.stringify([30,60,5]))this.benchmarks.ranges.slug=[20,60,10];
  if(!saved?.minimalUIVersion&&JSON.stringify(saved?.benchmarks?.ranges?.h2)===JSON.stringify([20,70,5]))this.benchmarks.ranges.h2=[10,70,5];
  if(!saved?.contentUIVersion&&saved?.benchmarks?.maxWords===100)this.benchmarks.maxWords=250;
  if(!saved?.complexFilterVersion&&saved?.benchmarks?.complexSyllables===3)this.benchmarks.complexSyllables=4;
  this.syncWordProperties=saved?.syncWordProperties===true;
  this.wordCounts=new WordCountSync(this.app,{parseYaml,validFrontmatter:isDraft,defaultGoal:fm=>this.benchmarks.ranges[fm.content_type][1],eligible:file=>{if(!this.syncWordProperties)return false;const fm=this.app.metadataCache.getFileCache?.(file)?.frontmatter,owner=this.router.owner(file.path);return isDraft(fm)&&(this.isAssigned(file.path)||(this.getTargetFile()?.path===file.path&&this.app.workspace.getLeavesOfType(VIEW).length>0))&&(!owner||owner.id===PLUGIN_ID);},count:(text,file)=>{const doc=this.document(text,file.path);return doc.error?null:words(parseBody(doc.body).text).length;},openText:file=>this.findView(file.path)?.editor?.getValue()});this.register(()=>this.wordCounts.stop());
  this.addSettingTab(new ChecklistSettings(this.app,this));
  this.collapsed=saved?.collapsed&&typeof saved.collapsed==='object'?saved.collapsed:{};
  this.generation=0;this.target=null;
  this.registerView(VIEW,leaf=>new ChecklistView(leaf,this));
  this.addRibbonIcon('pencil','Open Copywriter Checklist',()=>this.openPanel());
  this.addCommand({id:'open-panel',name:'Open sidebar',callback:()=>this.openPanel()});
  this.addCommand({id:'pin-draft',name:'Pin active draft',editorCallback:(_editor,view)=>this.setPinned(view.file.path)});
  this.addCommand({id:'follow-active-note',name:'Unpin sidebar for active note',callback:()=>this.setPinned('')});
  this.addCommand({id:'toggle-highlight',name:'Toggle keyword highlighting',callback:()=>this.setHighlight(!this.highlight)});
  this.addCommand({id:'convert-bookmark-heading',name:'Convert existing BOOKMARK heading to marker',editorCallback:(editor,view)=>{if(!view?.file||!isDraft(this.document(editor.getValue()).meta)){new Notice('Set content_type to article or webpage');return;}const existing=legacyBookmark(editor.getValue());if(!existing){new Notice('No standalone BOOKMARK heading found.');return;}editor.replaceRange(MARKER,{line:existing.line,ch:0},{line:existing.line,ch:editor.getLine(existing.line).length});this.schedule();}});
  this.addCommand({id:'place-bookmark',name:'Place bookmark at cursor',editorCallback:(editor,view)=>this.placeBookmark(editor,view.file)});
  this.addCommand({id:'jump-to-bookmark',name:'Jump to bookmark',callback:()=>{const file=this.getTargetFile();if(file)this.jumpToBookmark(file);}});
  const plugin=this;
  this.registerEditorExtension(ViewPlugin.fromClass(class {
   constructor(view){
    this.view=view;this.decorations=this.build(view);
    this.over=event=>{if(plugin.bookmarkDrag?.view!==view)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';};
    this.drop=event=>{const drag=plugin.bookmarkDrag;if(!drag)return;event.preventDefault();event.stopImmediatePropagation();plugin.bookmarkDrag=null;
     if(drag.view!==view){new Notice('Move the bookmark within the same editor pane.');return;}
     const pos=view.posAtCoords({x:event.clientX,y:event.clientY});if(pos===null)return;
     const text=view.state.doc.toString();if(!bookmarks(text).some(b=>b.from===drag.from)){new Notice('The bookmark changed during dragging. Please try again.');return;}
     try{plugin.applyBookmark(view,bookmarkEdit(text,view.state.doc.lineAt(pos).number-1));}catch(error){new Notice(error.message);}
    };
    view.dom.addEventListener('dragover',this.over,true);view.dom.addEventListener('drop',this.drop,true);
   }
   destroy(){this.view.dom.removeEventListener('dragover',this.over,true);this.view.dom.removeEventListener('drop',this.drop,true);if(plugin.bookmarkDrag?.view===this.view){plugin.bookmarkDrag.cancel?.();plugin.bookmarkDrag=null;}}
   build(view){const info=view.state.field(editorInfoField,false),doc=splitDocument(view.state.doc.toString(),parseYaml);if(!info?.file||!isDraft(doc.meta))return Decoration.none;return Decoration.set(bookmarks(view.state.doc.toString()).map(b=>Decoration.replace({widget:new BookmarkWidget(plugin,b.from),inclusive:false}).range(b.from,b.to)),true);}
   update(update){if(update.docChanged){if(plugin.bookmarkDrag?.view===update.view)for(const transaction of update.transactions)plugin.bookmarkDrag.from=transaction.changes.mapPos(plugin.bookmarkDrag.from,1);this.decorations=this.build(update.view);}}
  },{decorations:value=>value.decorations}));

  this.registerEditorExtension(ViewPlugin.fromClass(class {
   constructor(view){this.decorations=this.build(view);}
   update(update){if(update.docChanged||update.viewportChanged||update.transactions.some(t=>t.effects.some(e=>e.is(refreshHighlight))))this.decorations=this.build(update.view);}
   build(view){
    if(!plugin.highlight)return Decoration.none;
    const info=view.state.field(editorInfoField,false);
    if(!info?.file||info.file.path!==plugin.getTargetFile()?.path)return Decoration.none;
    const text=view.state.doc.toString(),doc=plugin.document(text,info.file.path);
    if(doc.error||!isDraft(doc.meta))return Decoration.none;
    const keywords=[...keywordList(doc,'primary_keyword').map(phrase=>({phrase,kind:'primary'})),...['secondary','topical','local'].flatMap(kind=>keywordList(doc,kind+'_keywords').map(phrase=>({phrase,kind})))].filter(k=>typeof k.phrase==='string'&&k.phrase.trim());
    const valid=visibleSource(doc.body).replace(/[*_~]/g,' ').split('\n'); // preserve line offsets when excluding fences/comments
    const candidates=[];let offset=doc.offset;
    for(const line of doc.body.split('\n')){const index=valid.shift();if(index){for(const k of keywords)for(const r of ranges(index,k.phrase))candidates.push({...r,from:r.from+offset,to:r.to+offset,kind:k.kind});}offset+=line.length+1;}
    for(const span of metadataKeywordSpans(doc))for(const k of keywords)for(const r of ranges(doc.source.slice(span.from,span.to),k.phrase))candidates.push({...r,from:span.from+r.from,to:span.from+r.to,kind:k.kind});
    candidates.sort((a,b)=>a.from-b.from||b.to-a.to);
    let end=-1;const marks=[];
    for(const r of candidates){if(r.from<end)continue;marks.push(Decoration.mark({class:`cw-keyword-${r.kind}`,attributes:{style:highlightStyle(plugin.colors[r.kind])}}).range(doc.originalOffset?.(r.from)??r.from,doc.originalOffset?.(r.to)??r.to));end=r.to;}
    return Decoration.set(marks,true);
   }
  },{decorations:v=>v.decorations}));
  this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{
   if(leaf?.view instanceof MarkdownView)this.target=leaf.view;
   else if(leaf?.view?.getViewType()!==VIEW)this.target=null;
   this.refreshEditors();this.schedule();
  }));
  this.registerEvent(this.app.workspace.on('file-open',()=>{const v=this.app.workspace.getActiveViewOfType(MarkdownView);if(v)this.target=v;this.schedule();}));
  this.registerEvent(this.app.workspace.on('editor-change',(_editor,info)=>{if(info.file?.path===this.getTargetFile()?.path)this.schedule();}));
  this.registerEvent(this.app.vault.on('modify',file=>{this.wordCounts.request(file);this.schedule();}));
  this.registerEvent(this.app.metadataCache.on('changed',file=>{this.wordCounts.request(file);this.schedule();}));
  this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
   for(const map of [this.assigned,this.dismissed])for(const path of Object.keys(map)){if(path===oldPath||path.startsWith(oldPath+'/')){map[file.path+path.slice(oldPath.length)]=map[path];delete map[path];}}
   this.sidebarPins=renameSidebarPins(this.sidebarPins,oldPath,file.path);this.savePreferences();this.router.routeActive(true).catch(console.error);
   this.refreshEditors();this.schedule();
  }));
  this.registerEvent(this.app.vault.on('delete',file=>{for(const map of [this.assigned,this.dismissed])for(const path of Object.keys(map))if(path===file.path||path.startsWith(file.path+'/'))delete map[path];for(const path of Object.keys(this.sidebarPins))if(path===file.path||path.startsWith(file.path+'/'))delete this.sidebarPins[path];this.savePreferences();this.router.routeActive(true).catch(console.error);this.refreshEditors();this.schedule();}));
  this.app.workspace.onLayoutReady(()=>{for(const file of this.app.vault.getMarkdownFiles?.()||[])this.wordCounts.request(file);this.target=this.app.workspace.getActiveViewOfType(MarkdownView);this.schedule();this.router.routeActive(true).catch(console.error);});
  this.register(()=>{clearTimeout(this.timer);this.generation++;});
 }
 openSettings(){const settings=this.app.setting;if(typeof settings?.open!=='function'||typeof settings.openTabById!=='function'){new Notice('Open Settings → Copywriter Checklist to edit benchmarks.');return;}settings.open();settings.openTabById(PLUGIN_ID);}
 async savePreferences(){await this.saveData({syncWordProperties:this.syncWordProperties,assigned:this.assigned,dismissed:this.dismissed,highlight:this.highlight,collapsed:this.collapsed,benchmarks:this.benchmarks,colors:this.colors,pinnedPath:'',sidebarPins:this.sidebarPins,sidebarPinVersion:1,minimalUIVersion:1,contentUIVersion:1,complexFilterVersion:1,metadataTableVersion:1});}
 async dismissFindings(path,ids){this.dismissed??={};this.dismissed[path]??={};for(const id of ids)this.dismissed[path][id]=true;await this.savePreferences();this.schedule();}
 async restoreFindings(path){delete this.dismissed[path];await this.savePreferences();this.schedule();}
 isAssigned(path){return !!path&&(this.assigned?.[path]===true||this.isSidebarPinned(path)||this.app?.metadataCache?.getFileCache?.({path})?.frontmatter?.copywriter===true);}
 document(text){const doc=splitDocument(text,parseYaml);if(!doc.error)doc.meta={...doc.meta,copywriter:isDraft(doc.meta)};return prepareDocument(doc);}
 getTargetFile(){return this.target?.file;}
 isSidebarPinned(path){return !!path&&Object.hasOwn(this.sidebarPins||{},path);}
 findView(path){let view=null;this.app.workspace.iterateAllLeaves?.(leaf=>{if(leaf.view instanceof MarkdownView&&leaf.view.file?.path===path)view=leaf.view;});return view||(!this.app.workspace.iterateAllLeaves&&this.target?.file?.path===path?this.target:null);}
 async setColor(kind,color){const next=normalizeColors({[kind]:color});if(!Object.hasOwn(this.colors,kind)||next[kind]!==color)return;this.colors[kind]=color;await this.savePreferences();this.refreshEditors();}
 async setPinned(path){
  const file=path?(this.app.vault.getFileByPath?.(path)||this.app.vault.getAbstractFileByPath?.(path)||this.target?.file):this.getTargetFile();
  if(!file||file.extension&&file.extension!=='md'){new Notice('Open a Markdown draft to pin its sidebar.');return;}
  if(path){this.assigned[file.path]=true;await this.savePreferences();this.wordCounts?.request(file);}
  await this.router.remember(PLUGIN_ID,file.path,!!path);
 }

 async jumpTo(path,location,snapshot){
  if(this.getTargetFile()?.path!==path){new Notice('Open the original draft to use this link.');return;}
  let view=this.findView(path);
  if(!view){const file=this.getTargetFile();const leaf=this.app.workspace.getLeaf(false);await leaf.openFile(file);view=leaf.view;}
  if(!(view instanceof MarkdownView)&&!view?.editor){new Notice('The draft could not be opened.');return;}

  if(view.getMode()!=='source')await view.setState({...view.getState(),mode:'source'},{history:false});
  const editorText=view.editor.getValue(),normalize=value=>value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(snapshot!==undefined&&normalize(editorText)!==normalize(snapshot)){new Notice('The draft changed. Select the refreshed finding.');this.schedule();return;}
  this.app.workspace.setActiveLeaf(view.leaf,{focus:true});
  const position=offset=>{if(snapshot===undefined||editorText===snapshot)return view.editor.offsetToPos(offset);const lines=normalize(snapshot.slice(0,offset)).split('\n');return {line:lines.length-1,ch:lines.at(-1).length};};
  const from=position(location.from),to=position(location.to);
  view.editor.setSelection(from,to);view.editor.scrollIntoView({from,to},true);view.editor.focus();
 }
 async setCollapsed(group,value){if(this.collapsed[group]===value)return;this.collapsed[group]=value;await this.savePreferences();}
 async setHighlight(value){this.highlight=value;await this.savePreferences();this.refreshEditors();this.schedule();}
 applyBookmark(view,edit){
  if(edit.from===edit.to&&!edit.insert)return;
  view.dispatch({changes:{from:edit.from,to:edit.to,insert:edit.insert},userEvent:'input.move.bookmark'});
  const line=view.state.doc.line(Math.min(view.state.doc.lines,edit.line+1));view.dispatch({selection:{anchor:line.from},effects:EditorView.scrollIntoView(line.from,{y:'center'})});view.focus();this.schedule();
 }
 placeBookmark(editor,file){
  const doc=this.document(editor.getValue(),file?.path);if(!file||!isDraft(doc.meta)){new Notice('Set content_type to article or webpage');return;}const line=editor.getCursor().line,from=editor.getValue().split('\n').slice(0,line).reduce((n,l)=>n+l.length+1,0);if(doc.metadataTables?.some(t=>from>=t.from&&from<=t.to)){new Notice('Place the bookmark outside the metadata table.');return;}
  let edit;try{edit=bookmarkEdit(editor.getValue(),editor.getCursor().line);}catch(error){new Notice(error.message);return;}
  if(editor.cm)this.applyBookmark(editor.cm,edit);else{editor.replaceRange(edit.insert,editor.offsetToPos(edit.from),editor.offsetToPos(edit.to));editor.setCursor({line:edit.line,ch:0});}
 }
 async placeBookmarkFor(file){
  let view;this.app.workspace.iterateAllLeaves(leaf=>{if(leaf.view instanceof MarkdownView&&leaf.view.file?.path===file.path)view=leaf.view;});
  if(!view){const leaf=this.app.workspace.getLeaf(false);await leaf.openFile(file);view=leaf.view;}
  if(view instanceof MarkdownView)this.placeBookmark(view.editor,file);
 }
 async jumpToBookmark(file){
  let leaf;this.app.workspace.iterateAllLeaves(candidate=>{if(candidate.view instanceof MarkdownView&&candidate.view.file?.path===file.path)leaf=candidate;});
  if(!leaf){leaf=this.app.workspace.getLeaf(false);await leaf.openFile(file);}await this.app.workspace.revealLeaf(leaf);
  if(!(leaf.view instanceof MarkdownView))return;const editor=leaf.view.editor,b=bookmarks(editor.getValue())[0];if(!b){new Notice('This manuscript has no bookmark.');this.schedule();return;}
  editor.setCursor({line:b.line,ch:0});editor.scrollIntoView({from:{line:b.line,ch:0},to:{line:b.line,ch:0}},true);editor.focus();
 }
 refreshEditors(){this.app.workspace.iterateAllLeaves(leaf=>{if(leaf.view instanceof MarkdownView){const cm=leaf.view.editor?.cm;if(cm)cm.dispatch({effects:refreshHighlight.of(null)});}});}
 schedule(){clearTimeout(this.timer);this.generation++;this.timer=setTimeout(()=>this.updatePanel().catch(e=>{console.error('Copywriter Checklist',e);for(const l of this.app.workspace.getLeavesOfType(VIEW))l.view.show('Analysis could not finish. Check note Properties and reopen the sidebar.');}),250);}
 async openPanel(){
  const current=this.app.workspace.getActiveViewOfType(MarkdownView);if(current)this.target=current;
  let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];
  if(!leaf){leaf=this.app.workspace.getRightLeaf(false);if(!leaf){new Notice('No sidebar available.');return;}await leaf.setViewState({type:VIEW,active:true});}
  await this.app.workspace.revealLeaf(leaf);this.schedule();
 }
 async updatePanel(){
  const views=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view);if(!views.length)return;
  const generation=this.generation,file=this.getTargetFile();
  const view=file?this.findView(file.path):null;
  if(!file||file.extension&&file.extension!=='md'){for(const panel of views){panel.show('Open a Markdown note to begin.');}return;}
  const text=view?.getMode()==='source'?view.editor.getValue():await this.app.vault.cachedRead(file);
  const doc=this.document(text,file.path),result=analyze(doc,{settings:this.benchmarks,notePath:file.path,resolveLink:path=>{try{path=decodeURIComponent(path);}catch{}return this.app.metadataCache.getFirstLinkpathDest(path,file.path);}}),imageChecks=[];
  result.docText=text;result.bookmarks=bookmarks(text);if(result.optedIn&&!result.error)this.wordCounts?.request(file);
  if(result.optedIn&&!result.error){
   for(const image of result.images){
    if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(image.target)){imageChecks.push({group:'Links & images',label:'Image size: '+image.target,status:'manual',detail:'Remote image size not checked',target:`Under ${this.benchmarks?.maxImageBytes||100000} bytes · remote files are not fetched`});continue;}
    let path=image.target.split(/[?#]/)[0];try{path=decodeURIComponent(path);}catch{}
    const asset=this.app.metadataCache.getFirstLinkpathDest(path,file.path);
    imageChecks.push({group:'Links & images',label:'Image size: '+image.target,status:asset instanceof TFile?(asset.stat.size<(this.benchmarks?.maxImageBytes||100000)?'pass':'review'):'review',detail:asset instanceof TFile?`${asset.stat.size.toLocaleString()} bytes`:'Local image not found.',target:`Under ${(this.benchmarks?.maxImageBytes||100000).toLocaleString()} bytes`});
   }
  }
  if(generation!==this.generation||file.path!==this.getTargetFile()?.path)return;
  for(const panel of views)panel.render(file,result,imageChecks);
 }
 onunload(){this.wordCounts?.stop();clearTimeout(this.timer);this.generation++;this.app.workspace.detachLeavesOfType(VIEW);}
}
module.exports=CopywriterChecklist;
