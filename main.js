/* Copywriter Checklist 1.3.0 */
const supportModule={exports:{}};
(function(module){
'use strict';
function wordGoal(value,fallback){
 let parts;if(typeof value==='number')parts=[Math.min(fallback[0],value),value];else if(Array.isArray(value)&&value.length===2)parts=value;else if(typeof value==='string'){const text=value.replace(/,/g,'').trim(),match=text.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);if(match)parts=[Number(match[1]),Number(match[2]||match[1])];}
 return parts?.every(n=>Number.isSafeInteger(n)&&n>0)&&parts[0]<=parts[1]?[...parts,fallback[2]||0]:[...fallback];
}
function numericWordGoal(value,fallback){
 const range=wordGoal(value,[fallback,fallback,0]);return range[1];
}
function validRange(value,fallback){return Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&n>=0)&&value[0]<=value[1]?[...value]:[...fallback];}
let labelId=0;const labelPrefix=Math.random().toString(36).slice(2);
function noTooltips(root){
 if(!root?.querySelectorAll)return;
 for(const el of [root,...root.querySelectorAll('[title],[aria-label],[data-tooltip-position]')]){
  el.removeAttribute('title');el.removeAttribute('data-tooltip-position');const text=el.getAttribute('aria-label');
  if(text){const label=root.ownerDocument.createElement('span');label.id=`checklist-label-${labelPrefix}-${++labelId}`;label.className='checklist-sr-only';label.textContent=text;root.append(label);el.setAttribute('aria-labelledby',label.id);el.removeAttribute('aria-label');}
 }
}
function rangeSetting(parent,Setting,name,value,onChange){
 const row=new Setting(parent).setName(name);row.settingEl?.addClass('checklist-range-setting');
 ['Minimum','Maximum','± Tolerance'].forEach((label,i)=>row.addText(input=>{const el=input.inputEl;
  if(el?.ownerDocument&&el.parentElement){const wrap=el.ownerDocument.createElement('label');wrap.className='checklist-range-field';wrap.appendChild(Object.assign(el.ownerDocument.createElement('span'),{textContent:label}));el.parentElement.insertBefore(wrap,el);wrap.appendChild(el);el.type='number';el.min='0';el.setAttribute('aria-label',`${name}: ${label}`);}
  input.setValue(String(value[i])).onChange(v=>{const n=Number(v),next=[...value];next[i]=n;if(!v.trim()||!Number.isFinite(n)||n<0||next[0]>next[1]){el?.setAttribute('aria-invalid','true');return;}el?.setAttribute('aria-invalid','false');value.splice(0,3,...next);onChange([...next]);});
 }));return row;
}
function outline(el,Setting,title,items){el.createEl('h3',{text:title});for(const [name,desc]of items)new Setting(el).setName(name).setDesc(desc);}
class WordCountSync{
 constructor(app,options){this.app=app;this.options=options;this.pending=new Map();this.running=new Map();this.closed=false;}
 request(file){if(this.closed||file?.extension!=='md'||!this.options.eligible(file))return;clearTimeout(this.pending.get(file.path)?.timer);const entry={file,timer:setTimeout(()=>{this.pending.delete(file.path);this.flush(file).catch(e=>console.error('Checklist word_count',e));},900)};this.pending.set(file.path,entry);}
 async flush(file){
  if(this.closed||!this.options.eligible(file)||!this.app.fileManager?.processFrontMatter)return;
  if(this.running.has(file.path)){await this.running.get(file.path);return this.flush(file);}
  const work=(async()=>{const text=await this.app.vault.cachedRead(file);const open=this.options.openText?.(file);if(typeof open==='string'&&open!==text)return;const count=this.options.count(text,file);if(!Number.isSafeInteger(count)||count<0)return;
   let fm={};const match=text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);if(match){try{fm=this.options.parseYaml(match[1]);}catch{return;}}
   if(this.options.validFrontmatter&&!this.options.validFrontmatter(fm))return;
   const needsGoal=this.options.defaultGoal&&(fm?.word_goal!==numericWordGoal(fm?.word_goal??fm?.word_count_goal,this.options.defaultGoal(fm,file))||Object.hasOwn(fm||{},'word_count_goal'));
   if((fm?.word_count===count&&!needsGoal)||this.closed||!this.options.eligible(file))return;
   const current=this.options.openText?.(file);if(typeof current==='string'&&current!==text)return;
   await this.app.fileManager.processFrontMatter(file,frontmatter=>{if(!this.closed&&this.options.eligible(file)&&(!this.options.validFrontmatter||this.options.validFrontmatter(frontmatter))){frontmatter.word_count=count;if(this.options.defaultGoal){frontmatter.word_goal=numericWordGoal(frontmatter.word_goal??frontmatter.word_count_goal,this.options.defaultGoal(frontmatter,file));delete frontmatter.word_count_goal;}}});
  })();this.running.set(file.path,work);try{await work;}finally{this.running.delete(file.path);}
 }
 stop(){this.closed=true;for(const item of this.pending.values())clearTimeout(item.timer);this.pending.clear();}
}

function upperSetting(parent,Setting,name,value,onChange){
 const row=new Setting(parent).setName(name);row.settingEl?.addClass('checklist-range-setting');row.settingEl?.addClass('checklist-upper-setting');
 ['Maximum','± Tolerance'].forEach((label,i)=>row.addText(input=>{const el=input.inputEl;if(el?.ownerDocument&&el.parentElement){const wrap=el.ownerDocument.createElement('label');wrap.className='checklist-range-field';wrap.appendChild(Object.assign(el.ownerDocument.createElement('span'),{textContent:label}));el.parentElement.insertBefore(wrap,el);wrap.appendChild(el);el.type='number';el.min=i?'0':'1';el.setAttribute('aria-label',`${name}: ${label}`);}input.setValue(String(value[i])).onChange(v=>{const n=Number(v);if(!v.trim()||!Number.isFinite(n)||(i?n<0:n<=0)){el?.setAttribute('aria-invalid','true');return;}el?.setAttribute('aria-invalid','false');value[i]=n;onChange([...value]);});}));return row;
}

module.exports={numericWordGoal,upperSetting,wordGoal,validRange,noTooltips,rangeSetting,outline,WordCountSync};

})(supportModule);
const analyzerModule={exports:{}};
(function(module){
'use strict';
const {wordGoal}=supportModule.exports;
const words = s => String(s || '').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
const norm = s => words(s).join(' ').toLocaleLowerCase('en');
const plain = s => s.replace(/!\[[^\]]*\]\([^\n]*?\)/g, '')
 .replace(/!\[\[[^\]]*\]\]/g, '').replace(/\[([^\]]+)\]\([^\n]*?\)/g, '$1')
 .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_,a,b)=>b || a)
 .replace(/<[^>]*>/g,'').replace(/[`*_~]/g,'');
function secondaryKeywords(value) {
 const seen=new Set(), result=[];
 for(const item of Array.isArray(value)?value:[value]) {
  if(typeof item!=='string')continue;
  for(const part of item.split(Array.isArray(value)?/[\n\r]+/:/[,\n\r]+/)) {
   const phrase=part.trim(), key=phrase.toLocaleLowerCase('en');
   if(phrase&&!seen.has(key)){seen.add(key);result.push(phrase);}
  }
 }
 return result;
}

const TABLE_FIELDS={category:'category',category_tags:'category_tags',url:'url',title_tag:'title_tag',meta_description:'meta_description',slug:'slug',website:'site_url',site_url:'site_url',primary_keyword:'primary_keyword',secondary_keywords:'secondary_keywords',local_keywords:'local_keywords',topical_keywords:'topical_keywords'};
function tableCells(line){
 let value=line.trim();if(value.startsWith('|'))value=value.slice(1);let slash=0;for(let i=value.length-2;i>=0&&value[i]==='\\';i--)slash++;if(value.endsWith('|')&&slash%2===0)value=value.slice(0,-1);
 const cells=[];let cell='';
 for(let i=0;i<value.length;i++){if(value[i]==='\\'&&value[i+1]==='|'){cell+='|';i++;}else if(value[i]==='|'){cells.push(cell.trim());cell='';}else cell+=value[i];}
 cells.push(cell.trim());return cells;
}
const tableText=value=>value.replace(/<br\s*\/?\s*>/gi,'\n').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#124;|&vert;/gi,'|').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').trim();
function keywordList(doc,key){
 if(key==='primary_keyword'){const value=doc.meta[key];return secondaryKeywords(Array.isArray(value)?value:typeof value==='string'?value.split(/[\n;]+/):[]);}
 if(doc.tableFields?.includes(key)){const value=doc.meta[key];return Array.isArray(value)?value:[];}
 return secondaryKeywords(doc.meta[key]);
}
function pageUrl(value){
 const raw=typeof value==='string'?value.trim():'';if(!raw)return null;
 try{const url=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw)?raw:raw.startsWith('//')?'https:'+raw:'https://'+raw);if(!['http:','https:'].includes(url.protocol)||!url.hostname||!url.hostname.includes('.')||url.username||url.password||/\s/.test(raw))return null;return {url:url.origin+url.pathname,origin:url.origin,path:url.pathname,slug:url.pathname.split('/').filter(Boolean).at(-1)||'/'};}catch{return null;}
}
function prepareDocument(doc){
 if(doc.prepared||doc.error||doc.meta?.copywriter!==true)return doc;
 const lines=doc.body.split('\n'),visible=visibleSource(doc.body).split('\n'),blocks=[];let offset=0;
 for(let i=0;i<lines.length;){
  if(!/^\s*\|/.test(lines[i])||!/^\s*\|/.test(visible[i])){offset+=lines[i].length+1;i++;continue;}
  const start=i,from=offset,rows=[];
  while(i<lines.length&&/^\s*\|/.test(lines[i])&&/^\s*\|/.test(visible[i])){const cells=tableCells(lines[i]);rows.push({cells,from:offset,to:offset+lines[i].length});offset+=lines[i].length+1;i++;}
  const recognized=rows.map(row=>({...row,key:TABLE_FIELDS[row.cells[0]?.replace(/[*_`]/g,'').trim().toLowerCase().replace(/[\s-]+/g,'_')]}));
  if(recognized.some(r=>r.key==='title_tag')&&recognized.some(r=>r.key==='primary_keyword'))blocks.push({start,end:i,from,to:offset-1,rows:recognized});
 }
 const meta={...doc.meta},tableFields=[],metadataIssues=[],metadataLocations={};
 if(blocks.length>1)metadataIssues.push('Multiple metadata tables found. Keep one metadata table.');
 for(const [index,block]of blocks.entries()){
  for(let i=block.start;i<block.end;i++)lines[i]=mask(lines[i]);
  if(index)continue;
  const seen=new Set();
  for(const row of block.rows){
   if(!row.key)continue;
   if(row.cells.length!==2){metadataIssues.push(`Invalid table row: ${row.cells[0]}. Escape title pipes as \\|.`);continue;}
   if(seen.has(row.key)){metadataIssues.push(`Duplicate metadata field: ${row.cells[0]}.`);continue;}
   seen.add(row.key);if(Object.hasOwn(doc.meta,row.key))continue;tableFields.push(row.key);
   const value=tableText(row.cells[1]);
   if(row.key.endsWith('_keywords')||row.key==='category_tags'){const list=value.split(/[\n;]+/).map(v=>v.replace(/^\s*[-*+]\s+/,'').trim()).filter(Boolean),seenWords=new Set();meta[row.key]=list.filter(v=>{const key=v.toLocaleLowerCase('en');if(seenWords.has(key))return false;seenWords.add(key);return true;});}
   else meta[row.key]=value.replace(/\n+/g,' ');
   metadataLocations[row.key]={label:row.cells[0].replace(/[*_`]/g,''),from:(doc.offset||0)+row.from,to:(doc.offset||0)+row.to};
  }
 }
 if(Object.hasOwn(meta,'url')){
  const parsed=pageUrl(meta.url);meta.site_url=parsed?.origin||'';meta.slug=parsed?.slug||'';meta.page_url=parsed?.url||'';meta.page_path=parsed?.path||'';
  if(!parsed)metadataIssues.push('Enter a full page URL, for example facility.com/page.');
  if(metadataLocations.url){metadataLocations.slug=metadataLocations.url;metadataLocations.site_url=metadataLocations.url;}
 }
 if(typeof meta.site_url==='string'&&meta.site_url.trim()&&!/^[a-z][a-z\d+.-]*:\/\//i.test(meta.site_url))meta.site_url='https://'+meta.site_url.trim();
 return {...doc,meta,body:lines.join('\n'),prepared:true,tableFields,metadataIssues,metadataLocations,metadataTables:blocks.map(b=>({from:b.from+(doc.offset||0),to:b.to+(doc.offset||0)}))};
}
function splitDocument(text, parseYaml) {
 const removed=[];let lost=0;
 text=text.replace(/^\uFEFF|\r\n?/g,(part,index)=>{if(part==='\r')return '\n';const at=index-lost;lost++;removed.push(part==='\r\n'?at+1:at);return part==='\r\n'?'\n':'';});
 const originalOffset=removed.length?(offset=>{let lo=0,hi=removed.length;while(lo<hi){const mid=(lo+hi)>>>1;if(removed[mid]<=offset)lo=mid+1;else hi=mid;}return offset+lo;}):undefined;
 const m=text.match(/^---\n([\s\S]*?)\n(?:---|\.\.\.)\s*(?:\n|$)/);
 if (!m) return {meta:{}, body:text, offset:0,originalOffset};
 try {
  const meta=parseYaml(m[1]);
  if (!meta || typeof meta!=='object' || Array.isArray(meta)) throw Error('Properties must be a YAML mapping.');
  return {meta,body:text.slice(m[0].length),offset:m[0].length,source:text,originalOffset};
 } catch(e) { return {meta:{},body:'',offset:m[0].length,error:'Invalid Properties: '+e.message}; }
}
// Match the exact phrase plus noun plurals of its final word; never stem other words.
function keywordPlurals(word){
 const irregular={child:'children',person:'people',man:'men',woman:'women',foot:'feet',tooth:'teeth',mouse:'mice',goose:'geese',analysis:'analyses',diagnosis:'diagnoses',basis:'bases',crisis:'crises',criterion:'criteria',phenomenon:'phenomena',quiz:'quizzes',life:'lives',wife:'wives',knife:'knives',leaf:'leaves',half:'halves',shelf:'shelves',wolf:'wolves',loaf:'loaves',calf:'calves',thief:'thieves',hero:'heroes',potato:'potatoes',tomato:'tomatoes'};
 if(!/^[a-z]+$/.test(word)||['news','series','species','equipment','information','fish','sheep','deer'].includes(word))return new Set([word]);
 const plural=(Object.hasOwn(irregular,word)?irregular[word]:null)||(/[^aeiou]y$/.test(word)?word.slice(0,-1)+'ies':/(?:s|x|z|ch|sh)$/.test(word)?word+'es':word+'s');
 return new Set([word,plural]);
}
const CONNECTORS=new Set(['a','an','the','in','of','to','for','at','on','with','by']);
const VERB_GROUPS=[['be','am','is','are','was','were','been','being'],['have','has','had','having'],['do','does','did','done','doing'],['go','goes','went','gone','going'],['write','writes','wrote','written','writing'],['take','takes','took','taken','taking'],['give','gives','gave','given','giving'],['make','makes','made','making'],['find','finds','found','finding'],['choose','chooses','chose','chosen','choosing'],['feel','feels','felt','feeling'],['get','gets','got','gotten','getting'],['run','runs','ran','running'],['lead','leads','led','leading'],['build','builds','built','building'],['provide','provides','provided','providing']];
function wordForms(raw){
 const w=raw.toLowerCase(),forms=new Set([w]);if(!/^[a-z]+$/.test(w)||w.length<=2||/^[A-Z]{2,}$/.test(raw))return forms;
 for(const group of VERB_GROUPS)if(group.includes(w))for(const v of group)forms.add(v);
 for(const [singular,plural]of Object.entries({child:'children',person:'people',man:'men',woman:'women',foot:'feet',tooth:'teeth',mouse:'mice',goose:'geese',analysis:'analyses',diagnosis:'diagnoses',basis:'bases',crisis:'crises',criterion:'criteria',phenomenon:'phenomena',life:'lives',wife:'wives',knife:'knives',leaf:'leaves',half:'halves',shelf:'shelves',wolf:'wolves'}))if(w===singular||w===plural){forms.add(singular);forms.add(plural);}
 if(/ies$/.test(w))forms.add(w.slice(0,-3)+'y');
 if(/(?:ches|shes|xes|zes|ses)$/.test(w))forms.add(w.slice(0,-2));
 if(/s$/.test(w)&&!/(?:ss|us|is|news|series|species)$/.test(w))forms.add(w.slice(0,-1));
 if(/ied$/.test(w))forms.add(w.slice(0,-3)+'y');
 for(const suffix of ['ed','ing'])if(w.endsWith(suffix)&&w.length>suffix.length+2){const stem=w.slice(0,-suffix.length);forms.add(stem);forms.add(stem+'e');if(/([b-df-hj-np-tv-z])\1$/.test(stem))forms.add(stem.slice(0,-1));}
 return forms;
}
function ranges(text,phrase){
 const target=[...String(phrase||'').matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];if(!target.length)return [];
 const tokens=[...String(text).matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)],forms=target.map(t=>wordForms(t[0]));
 const same=(token,j)=>{const raw=token[0];if(/^[A-Z]{2,}$/.test(target[j][0]))return raw.toLowerCase()===target[j][0].toLowerCase();const other=wordForms(raw);return [...forms[j]].some(f=>other.has(f));};
 const gapOK=(a,b)=>{const gap=text.slice(a.index+a[0].length,b.index);return /^[\s\p{P}]*$/u.test(gap)&&!/[\n\r.!?;]/.test(gap);};
 const out=[];
 for(let i=0;i<tokens.length;i++){
  if(!same(tokens[i],0))continue;
  let at=i,ok=true;
  for(let j=1;j<target.length;j++){let next=at+1,skipped=0;while(next<tokens.length&&gapOK(tokens[next-1],tokens[next])&&!same(tokens[next],j)&&CONNECTORS.has(tokens[next][0].toLowerCase())&&skipped<2){next++;skipped++;}if(next>=tokens.length||!gapOK(tokens[next-1],tokens[next])||!same(tokens[next],j)){ok=false;break;}at=next;}
  if(ok){out.push({from:tokens[i].index,to:tokens[at].index+tokens[at][0].length});i=at;}
 }
 return out;
}
// Only published metadata counts: never keyword declarations, goals or workflow properties.
function metadataKeywordSpans(doc){
 const source=doc.source||'',spans=[];if(!source)return spans;
 const fields=new Set(['title_tag','meta_description','url','category','category_tags']);
 const prefix=source.slice(0,doc.offset||0);let active=false,offset=0;
 for(const line of prefix.split('\n')){const match=/^([a-z_]+):\s*(.*)$/.exec(line);if(match){active=fields.has(match[1])&&!doc.tableFields?.includes(match[1]);if(active&&match[2]){const start=line.indexOf(':')+1;spans.push({from:offset+start,to:offset+line.length});}}else if(active&&/^\s+/.test(line)&&line.trim()){const start=line.search(/\S/);spans.push({from:offset+start,to:offset+line.length});}else if(!/^\s*$/.test(line))active=false;offset+=line.length+1;}
 for(const key of fields){const loc=doc.metadataLocations?.[key];if(!loc)continue;const row=source.slice(loc.from,loc.to),pipe=row.indexOf('|',row.indexOf('|')+1);if(pipe>=0)spans.push({from:loc.from+pipe+1,to:loc.to});}
 return spans;
}

const occurrences=(s,k)=>ranges(s,k).length;
function parseBody(body) {
 body=body.replace(/<!--[\s\S]*?(?:-->|$)/g, m=>m.replace(/[^\n]/g,' '));
 const lines=body.split('\n'); let fence=null,comment=false; const clean=[]; const headings=[];
 lines.forEach((line,i)=>{
  const f=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if (f) { if(!fence) fence=f[1]; else if(f[1][0]===fence[0]&&f[1].length>=fence.length) fence=null; clean.push(''); return; }
  if(fence) {clean.push('');return;}
  let l=line.replace(/%%.*?%%/g,'');
  if(comment) {const end=l.indexOf('%%'); if(end<0){clean.push('');return;} l=l.slice(end+2);comment=false;}
  if(l.includes('%%')){l=l.slice(0,l.indexOf('%%'));comment=true;}
  l=l.replace(/<!--.*?-->/g,'');
  clean.push(l);
  const h=l.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
  if(h) headings.push({level:h[1].length,text:plain(h[2]),line:i});
  else if(i>0&&/^ {0,3}(=+|-+)\s*$/.test(l)&&clean[i-1].trim()&&!/^\s*[-*+>#]/.test(clean[i-1])) headings.push({level:l.trim()[0]==='='?1:2,text:plain(clean[i-1]),line:i-1});
 });
 const raw=clean.join('\n').replace(/<!--[\s\S]*?-->/g,'');
 const headingLines=new Set(headings.flatMap(h=>[h.line,...(/^\s*(=+|-+)\s*$/.test(clean[h.line+1]||'')?[h.line+1]:[])]));
 const prose=clean.map((l,i)=>headingLines.has(i)?'':l).join('\n');
 const paragraphs=prose.split(/\n\s*\n/).map(p=>p.trim()).filter(p=>p&&!/^(?:[-*+] |\d+[.)] |> |\||!\[|BY\s)/i.test(p));
 const h1=headings.find(h=>h.level===1);
 let lede='';
 if(h1) {
  const after=clean.slice(h1.line+1); if(/^\s*=+\s*$/.test(after[0]||''))after.shift();
  while(after.length&&!after[0].trim())after.shift();
  const p=[];for(const l of after){if(!l.trim()||/^\s*(#|BY\s|>|[-*+] |\d+\. |!\[)/i.test(l))break;p.push(l);}
  lede=plain(p.join(' ')).trim();
 }
 return {raw,headings,paragraphs,lede,text:plain(raw).replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/^\s*(?:=+|-+)\s*$/gm,'').replace(/^\s*[-+>]\s+/gm,'')};
}

const mask=s=>s.replace(/[^\n]/g,' ');
function syllableCount(word){
 const w=word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'');
 return Math.max(1,(w.match(/[aeiouy]+/g)||[]).length);
}
function visibleSource(body){
 let fence=null;
 let text=body.split('\n').map(line=>{
  const f=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;return mask(line);}
  return fence?mask(line):line;
 }).join('\n');
 text=text.replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g,mask)
  .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^\n)]*\)/g,mask)
  .replace(/`[^`\n]*`/g,mask).replace(/\]\([^\n)]*\)/g,mask)
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,(m,a,b)=>mask(m.slice(0,m.indexOf('|')+1))+b+'  ')
  .replace(/https?:\/\/[^\s)]+/g,mask).replace(/<[^>]*>/g,mask);
 return text;
}
function proseSpans(body,headings){
 const visible=visibleSource(body),headingLines=new Set(headings.map(h=>h.line));
 let text=visible.split('\n').map((line,i)=>headingLines.has(i)||/^(?:\s*[-*+] |\s*\d+[.)] |\s*>|\s*\||\s*BY\s|\s*(?:=+|-+)\s*$)/i.test(line)?mask(line):line).join('\n');
 return [...text.matchAll(/\S[\s\S]*?(?=\n[ \t]*\n|$)/g)].filter(m=>words(m[0]).length).map(m=>({text:m[0],from:m.index,to:m.index+m[0].length}));
}
function sentenceSpans(paragraph){
 return [...paragraph.text.matchAll(/[^.!?]+(?:[.!?]+|$)/g)].filter(m=>words(m[0]).length).map(m=>{
  const lead=m[0].search(/\S/),value=m[0].trimEnd();return {text:value.slice(lead),from:paragraph.from+m.index+lead,to:paragraph.from+m.index+value.length};
 });
}
function groupWordLocations(locations){
 const groups=new Map();
 for(const location of locations){const key=location.label.toLocaleLowerCase('en');if(!groups.has(key))groups.set(key,{label:location.label,count:0,occurrences:[]});const group=groups.get(key);group.count++;group.occurrences.push(location);}
 return [...groups.values()];
}

function keywordCategories(checks,total){
 return ['primary','secondary','local','topical'].flatMap(kind=>{
  const items=checks.filter(c=>c.keyword?.kind===kind);if(!items.length)return [];
  const mentions=items.reduce((n,c)=>n+c.keyword.mentions.length,0)/items.length;
  return [{kind,label:kind[0].toUpperCase()+kind.slice(1)+' keywords',items,mentions,density:items.every(c=>Number.isFinite(c.keyword.density))?items.reduce((n,c)=>n+c.keyword.density,0)/items.length:total?mentions/total*100:0,target:items[0].target}];
 });
}
function sectionCounts(items){return {passed:items.filter(c=>c.status==='pass').length,close:items.filter(c=>c.status==='near').length,review:items.filter(c=>c.status==='review'||c.status==='warn').length};}
function h2ParagraphGaps(body,headings){
 const lines=body.replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g,mask).split('\n');
 const headingLines=new Set(headings.map(h=>h.line));
 return headings.filter(h=>h.level===2).filter(h=>{
  let i=h.line+1;if(!/^ {0,3}##\s/.test(lines[h.line]||'')&&/^\s*-+\s*$/.test(lines[i]||''))i++;
  while(i<lines.length&&!lines[i].trim())i++;
  const next=(lines[i]||'').trim();
  return !next||headingLines.has(i)||/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||`{3,}|~{3,}|[-*_]{3,}\s*$|\[[^\]]+\]:)/.test(next)||!words(plain(next)).length;
 });
}
const HIGHLIGHT_COLORS={primary:'#28b455',secondary:'#ebc31e',topical:'#a55fe1',local:'#2d91eb'};
function normalizeColors(saved={}){return Object.fromEntries(Object.entries(HIGHLIGHT_COLORS).map(([kind,color])=>[kind,/^#[0-9a-f]{6}$/i.test(saved?.[kind])?saved[kind]:color]));}
function progressColor(percent){return percent>=100?'#6c9275':percent>=75?'#a6b894':percent>=50?'#c3b578':percent>=25?'#c39977':'#b78181';}
function highlightStyle(color){return `background-color:${color}40`;}

// Source-based keys survive unrelated edits without suppressing changed findings.
function findingKey(check,location,source=''){
 const text=source.slice(location.from,location.to)||location.label||'';
 const before=source.slice(0,location.from),ordinal=text?before.split(text).length-1:0;
 return JSON.stringify([check.group,check.label,text,ordinal]);
}
function rowKey(check,source=''){
 return JSON.stringify(['row',check.group,check.label,check.detail,check.target,(check.locations||[]).map(l=>source.slice(l.from,l.to)||l.label),check.issues||[]]);
}
function clusteringChecks(doc,paragraphs,keywords,config){
 const offset=doc.offset||0,checks=[];
 const clustered=[];
 for(const paragraph of paragraphs)for(const keyword of keywords){const matches=keyword.mentions.filter(l=>l.from>=offset+paragraph.from&&l.to<=offset+paragraph.to);if(matches.length>=config.clusterMentions)clustered.push({label:`${keyword.phrase} · ${matches.length} mentions in one paragraph`,from:offset+paragraph.from,to:offset+paragraph.to});}
 if(clustered.length)checks.push({group:'Keywords',label:'Keyword clustering',status:'review',detail:`${clustered.length} clustered phrases`,target:`Fewer than ${config.clusterMentions} mentions of the same keyword per paragraph`,locations:clustered,findingKind:'cluster'});
 return checks;
}
function applyDismissals(result,source='',dismissed={}){
 if(!result.optedIn||result.error)return result;
 let ignoredCount=0;
 const checks=result.checks.flatMap(original=>{
  const c={...original,locations:(original.locations||[]).map(l=>({...l,id:findingKey(original,l,source)}))};
  c.dismissKey=rowKey(c,source);
  if(dismissed[c.dismissKey]){ignoredCount++;return [];}
  const keep=l=>{if(dismissed[l.id]){ignoredCount++;return false;}return true;};
  c.locations=c.locations.filter(keep);
  if(c.wordGroups){c.wordGroups=c.wordGroups.map(w=>{const occurrences=w.occurrences.map(l=>({...l,id:findingKey(original,l,source)})).filter(l=>!dismissed[l.id]);return {...w,occurrences,count:occurrences.length};}).filter(w=>w.count);c.detail=`${c.wordGroups.length} complex words · ${c.wordGroups.reduce((n,w)=>n+w.count,0)} occurrences`;}
  if(c.cueGroups)c.cueGroups=c.cueGroups.map(g=>{const locations=g.locations.map(l=>({...l,id:findingKey(original,l,source)})).filter(keep);return {...g,locations,count:locations.length};});
  if(c.label==='Heading character counts'&&c.locations.length!==(original.locations||[]).length){const long=c.locations.filter(l=>l.tooLong).length,short=c.locations.length-long;c.detail=`${[long?`${long} too long`:'',short?`${short} too short`:''].filter(Boolean).join(' · ')||'No remaining length findings'} · ${original.detail.split(' · ').at(-1)}`;c.status=c.issues?.length||c.locations.some(l=>l.lengthStatus==='review')?'review':c.locations.some(l=>l.lengthStatus==='near')?'near':'info';if(c.status==='info')c.scored=false;}
  const countable={'Long sentences':'long sentences','Long paragraphs':'long paragraphs','Paragraphs after H2s':'H2 headings without a following paragraph'};
  if(['Long sentences','Long paragraphs'].includes(c.label)&&c.locations.length&&c.locations.length!==(original.locations||[]).length)c.status=c.locations.some(l=>l.lengthStatus==='review')?'review':'near';
  if(c.findingKind||countable[c.label]){
   if(!c.locations.length&&(original.locations||[]).length){if(c.findingKind)return [];c.status='info';c.scored=false;c.detail='No remaining findings';}
   else if(c.findingKind)c.detail=`${c.locations.length} ${c.findingKind==='cluster'?(c.locations.length===1?'clustered phrase':'clustered phrases'):(c.locations.length===1?'finding':'findings')}`;
   else if(countable[c.label]&&(original.locations||[]).length)c.detail=`${c.locations.length} ${countable[c.label]}`;
  }
  return [c];
 });
 return {...result,checks,ignoredCount,score:checklistScore(checks)};
}
const DEFAULTS={
 ranges:{title:[30,60,5],meta:[70,160,10],slug:[20,60,10],h1:[20,70,5],h2:[10,70,5],h2count:[5,15,1],lede:[70,190,10],article:[1000,2500,100],webpage:[500,900,50]},
 maxWords:250,maxSentenceWords:25,maxSentenceTolerance:5,maxParagraphTolerance:25,complexSyllables:4,complexMinLetters:8,complexMinMentions:2,excludeKeywordWords:true,excludeProperNames:true,ignoredWords:[],maxH3:5,minReadability:50,minInternal:2,minExternal:1,maxImageBytes:100000,repeatDensity:3,maxSectionWords:500,clusterMentions:4
};
function settingsWithDefaults(saved={}) {
 const out={...DEFAULTS,ranges:{}};
 for(const [key,base]of Object.entries(DEFAULTS.ranges)){
  const v=saved.ranges?.[key];out.ranges[key]=Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&v[0]<=v[1]?[...v]:[...base];
 }
 for(const key of Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='number'))if(typeof saved[key]==='number'&&Number.isFinite(saved[key])&&(key.endsWith('Tolerance')?saved[key]>=0:saved[key]>0))out[key]=saved[key];
 for(const key of ['excludeKeywordWords','excludeProperNames'])if(typeof saved[key]==='boolean')out[key]=saved[key];
 out.ignoredWords=secondaryKeywords(saved.ignoredWords).map(w=>w.toLowerCase());
 return out;
}
function rangeStatus(value,range,present=true) {
 if(!present)return 'review';
 const [min,max,tolerance]=range;
 return value>=min&&value<=max?'pass':value>=min-tolerance&&value<=max+tolerance?'near':'review';
}
function checklistScore(checks) {
 const counted=checks.filter(c=>c.scored!==false&&['pass','near','review','warn'].includes(c.status));
 if(!counted.length)return {value:null,count:0,pass:0,near:0,review:0};
 const countStatus=status=>counted.filter(c=>c.status===status).length;
 return {value:Math.round(counted.reduce((n,c)=>n+(c.status==='pass'?1:c.status==='near'?0.9:0),0)/counted.length*100),count:counted.length,pass:countStatus('pass'),near:countStatus('near'),review:countStatus('review')+countStatus('warn')};
}
function linkSource(body){
 let fence=null;
 return body.split('\n').map(line=>{const f=line.match(/^\s{0,3}(`{3,}|~{3,})/);if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;return mask(line);}return fence?mask(line):line;}).join('\n').replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g,mask).replace(/(`+)([^`\n]*?)\1/g,mask);
}
function groupLinks(links,offset){
 const groups=new Map();
 for(const link of links){if(!groups.has(link.target))groups.set(link.target,{label:plain(link.text).trim()||link.target,target:link.target,occurrences:[],count:0});const group=groups.get(link.target);group.occurrences.push({label:plain(link.text).trim()||link.target,from:link.from+offset,to:link.to+offset});group.count++;}
 return [...groups.values()];
}
function parseLinks(raw){
 return [...raw.matchAll(/\[([^\]]*)\]\(([^)\n]*)\)|\[\[([^\]]*)\]\]/g)].filter(m=>raw[m.index-1]!=='!').map(m=>{
  const wiki=m[3]!==undefined,parts=wiki?m[3].split('|'):[];
  const target=wiki?parts[0].trim():m[2].trim().replace(/^<([^>]+)>.*$/,'$1').replace(/\s+["'].*$/,'');
  return {text:wiki?(parts[1]||parts[0]):m[1],target,wiki,source:m[0],from:m.index,to:m.index+m[0].length};
 });
}
function analyze(doc, options={}) {
 const config=settingsWithDefaults(options.settings);
 const guide=key=>{const [min,max]=config.ranges[key];return `${min.toLocaleString()}–${max.toLocaleString()}`;};
 if(doc.error)return {error:doc.error};
 doc=prepareDocument(doc);
 const m=doc.meta;
 if(m.copywriter!==true)return {optedIn:false};
 const profile=m.content_type;
 if(!['article','webpage'].includes(profile))return {optedIn:true,error:'Set content_type to article or webpage.'};
 const b=parseBody(doc.body),total=words(b.text).length,checks=[];
 const add=(group,label,ok,detail,target='',issues=[])=>checks.push({group,label,status:typeof ok==='string'?ok:ok?'pass':'review',detail,target,issues});
 const scalar=k=>typeof m[k]==='string'?m[k].trim():'';
 const title=scalar('title_tag'),meta=scalar('meta_description'),slug=scalar('slug'),primaries=keywordList(doc,'primary_keyword'),primary=primaries[0]||'';
 const lists=Object.fromEntries(['secondary','topical','local'].map(kind=>[kind,keywordList(doc,kind+'_keywords')]));
 const h1s=b.headings.filter(h=>h.level===1),h2s=b.headings.filter(h=>h.level===2);
 const primaryPresent=value=>primaries.some(phrase=>occurrences(value,phrase)>0);
 const primaryDetail=value=>!primary?'✕ primary keyword (not set)':primaryPresent(value)?'✓ primary keyword':'✕ primary keyword';
 for(const [label,value,key]of [['Title tag',title,'title'],['Meta description',meta,'meta'],['Slug',slug,'slug']]){
  const n=Array.from(value).length;
  const webpageSlug=key==='slug'&&profile==='webpage';
  const lengthRange=webpageSlug?[0,config.ranges.slug[1],config.ranges.slug[2]]:config.ranges[key];
  add('Metadata',label,webpageSlug?rangeStatus(n,lengthRange,!!value):primaryPresent(value)?rangeStatus(n,lengthRange,!!value):'review',`${n} characters${webpageSlug?'':' · '+primaryDetail(value)}`,webpageSlug?`Up to ${config.ranges.slug[1]} characters`:`${guide(key)} characters · ✓ primary keyword`);
 }
 if(doc.metadataIssues?.length){add('Metadata','Metadata table',false,`${doc.metadataIssues.length} issues`,'One table with one row per field',doc.metadataIssues);checks.at(-1).locations=doc.metadataTables.map(l=>({...l,label:'Metadata table'}));}
 const h1=h1s[0]?.text||'',h1length=Array.from(h1).length;
 add('Structure','H1 heading',h1s.length===1&&primaryPresent(h1)?rangeStatus(h1length,config.ranges.h1,!!h1):'review',
  h1s.length?`${h1length} characters · ${primaryDetail(h1)}${h1s.length>1?` · ${h1s.length} H1 headings found`:''}`:'H1 missing',
  `${guide('h1')} characters · ✓ primary keyword`,h1s.length>1?['Keep one H1 for the page.']:[]);
 add('Structure','Heading count',rangeStatus(h2s.length,config.ranges.h2count,h2s.length>0),`${h2s.length} H2 headings`,`${guide('h2count')} H2 headings`);
 const h2Statuses=h2s.map(h=>rangeStatus(Array.from(h.text).length,config.ranges.h2));
 const h2Long=h2s.filter(h=>Array.from(h.text).length>config.ranges.h2[1]).length, h2Short=h2s.filter(h=>Array.from(h.text).length<config.ranges.h2[0]).length;
 const h2Matches=lists.secondary.filter(k=>h2s.some(h=>occurrences(h.text,k)>0));
 add('Structure','Heading character counts',!h2s.length||!h2Matches.length||h2Statuses.includes('review')?'review':h2Statuses.includes('near')?'near':'pass',
  `${[h2Long?`${h2Long} too long`:'',h2Short?`${h2Short} too short`:''].filter(Boolean).join(' · ')||'Within length range'} · ${h2Matches.length} secondary keyword${h2Matches.length===1?'':'s'}`,
  `H2s: ${guide('h2')} characters each · at least 1 secondary keyword`,
  [...(!h2s.length?['No H2 headings found.']:[]),...(!h2Matches.length?['No configured secondary keyword appears in an H2.']:[])]);
 const paragraphGaps=h2ParagraphGaps(doc.body,b.headings);
 add('Structure','Paragraphs after H2s',h2s.length?paragraphGaps.length===0:'info',`${paragraphGaps.length} H2 headings without a following paragraph`,'Paragraph after every H2');checks.at(-1).scored=h2s.length>0;
 add('Structure','Heading depth',b.headings.every(h=>h.level<=3),`${b.headings.filter(h=>h.level>3).length} headings deeper than H3`,'H1–H3 only');
 let previous=0,h3=0,maxH3=0,skips=0,orphan=0,hasH2=false;
 for(const h of b.headings){if(h.level>previous+1)skips++;previous=h.level;if(h.level<=2){h3=0;hasH2=h.level===2;}if(h.level===3){if(!hasH2)orphan++;maxH3=Math.max(maxH3,++h3);}}
 add('Structure','Heading hierarchy',skips===0&&orphan===0,`${skips} skipped levels · ${orphan} H3s outside H2 sections`,'No skipped heading levels · H3s nested under H2s');
 add('Structure','H3s per H2 section',maxH3<config.maxH3,`Largest section: ${maxH3} H3 headings`,`<${config.maxH3} H3s per H2 section`);
 const ledeLength=Array.from(b.lede).length;
 add('Content','Lede',primaryPresent(b.lede)?rangeStatus(ledeLength,config.ranges.lede,!!b.lede):'review',`${ledeLength} characters · ${primaryDetail(b.lede)}`,`${guide('lede')} characters · ✓ primary keyword`);
 const missing=[];
 for(const [label,value]of [['title tag',title],['meta description',meta],['slug',slug],['H1',h1],['lede',b.lede]])if(!value)missing.push(`Missing ${label}.`);
 if(!h2s.length)missing.push('Missing H2 headings.');
 if(!b.paragraphs.some(p=>plain(p).trim()!==b.lede&&words(plain(p)).length))missing.push('Missing body paragraphs beyond the lede.');
 const duplicates=[];

 if(meta&&b.lede&&norm(meta)===norm(b.lede))duplicates.push('Meta description matches lede.');
 const seen=new Map();
 [...b.headings.map(h=>({text:h.text,label:`H${h.level}: ${h.text}`})),...b.paragraphs.map((p,i)=>({text:plain(p),label:`Paragraph ${i+1}: ${plain(p)}`}))].forEach(e=>{
  const key=norm(e.text);if(!key)return;if(seen.has(key))duplicates.push(`${e.label} · duplicates ${seen.get(key)}`);else seen.set(key,e.label);
 });
 add('Content','Duplicate elements',!missing.length&&!duplicates.length,`${duplicates.length} duplicate matches · ${missing.length} missing elements`,
  'Required elements present · meta ≠ lede · no repeated headings/paragraphs',[...missing,...duplicates]);
 const wordRange=wordGoal(m.word_goal,config.ranges[profile]);
 add('Content','Body word count',rangeStatus(total,wordRange,total>0),`${total} words`,`${wordRange[0].toLocaleString()}–${wordRange[1].toLocaleString()} words · ${profile}`);
 const sentences=s=>(s.match(/[^.!?]+(?:[.!?]+|$)/g)||[]).filter(x=>words(x).length).length;
 const paragraphs=proseSpans(doc.body,b.headings),ps=paragraphs.map(p=>p.text);
 const sentenceList=paragraphs.flatMap(sentenceSpans),longSentences=sentenceList.filter(p=>words(p.text).length>config.maxSentenceWords);
 const longParagraphs=paragraphs.filter(p=>words(p.text).length>config.maxWords);
 const avgSentences=ps.length?sentenceList.length/ps.length:0,avgWords=ps.length?ps.reduce((n,p)=>n+words(p).length,0)/ps.length:0;
 add('Content','Paragraphs','info',`${ps.length} paragraphs · average ${avgSentences.toFixed(1)} sentences · average ${avgWords.toFixed(1)} words`,`~3 sentences, ${config.maxWords} words per paragraph`);
 checks.at(-1).scored=false;
 add('Content','Long sentences',longSentences.length?longSentences.some(p=>words(p.text).length>config.maxSentenceWords+config.maxSentenceTolerance)?'review':'near':'pass',`${longSentences.length} long sentences`,`Up to ${config.maxSentenceWords} words per sentence`);checks.at(-1).scored=sentenceList.length>0;
 add('Content','Long paragraphs',longParagraphs.length?longParagraphs.some(p=>words(p.text).length>config.maxWords+config.maxParagraphTolerance)?'review':'near':'pass',`${longParagraphs.length} long paragraphs`,`Up to ${config.maxWords} words per paragraph`);checks.at(-1).scored=paragraphs.length>0;
 const ignored=new Set(config.ignoredWords);
 if(config.excludeKeywordWords)for(const phrase of [...primaries,...Object.values(lists).flat()])for(const w of words(phrase))ignored.add(w.toLowerCase());
 let complex=paragraphs.flatMap(p=>[...p.text.matchAll(/[\p{L}]+(?:['’][\p{L}]+)*/gu)].filter(m=>{
  const value=m[0],prefix=p.text.slice(0,m.index).replace(/[`*_~"“”'‘’()[\]]/g,'').trimEnd();
  const proper=config.excludeProperNames&&/^\p{Lu}\p{Ll}/u.test(value)&&prefix.length>0&&!/[.!?]$/.test(prefix);
  return [...value.replace(/['’]/g,'')].length>=config.complexMinLetters&&syllableCount(value)>=config.complexSyllables&&!ignored.has(value.toLowerCase())&&!/^\p{Lu}+$/u.test(value)&&!proper;
 }).map(m=>({label:m[0],from:p.from+m.index+(doc.offset||0),to:p.from+m.index+m[0].length+(doc.offset||0)})));
 const eligible=groupWordLocations(complex).filter(g=>g.count>=config.complexMinMentions);
 complex=eligible.flatMap(g=>g.occurrences).sort((a,b)=>a.from-b.from);
 const complexGroups=groupWordLocations(complex);
 add('Content','Complex words','info',`${complexGroups.length} complex words · ${complex.length} occurrences`,`${config.complexSyllables}+ syllables · ${config.complexMinLetters}+ letters · ${config.complexMinMentions}+ mentions`);checks.at(-1).scored=false;checks.at(-1).inline=true;checks.at(-1).wordGroups=complexGroups;
 const styles=[[/^\s*[-*+]\s+/m,'bullets'],[/^\s*\d+[.)]\s+/m,'numbered list'],[/\*\*[^*]+\*\*|__[^_]+__/,'bold'],[/\|.*\|/,'table'],[/!\[/,'image'],[/^\s*>/m,'quote']].filter(([re])=>re.test(parseBody(doc.body).raw)).map(([,name])=>name);
 add('Content','Style elements',styles.length>0,styles.join(', ')||'No style elements detected','Include lists, bold text, tables, images, or quotes');
 const ws=words(b.text),sc=sentences(b.text);
 const syllables=ws.reduce((sum,w)=>sum+syllableCount(w),0);
 const score=total&&sc?206.835-1.015*(total/sc)-84.6*(syllables/total):null;
 add('Content','Readability',score!==null&&score>=config.minReadability,score===null?'Not enough prose':'',`${config.minReadability}–100 readability`);checks.at(-1).readability={value:score,min:config.minReadability};
 const visible=visibleSource(doc.body);
 const pov=[['First person',/\b(?:I|me|my|mine|we|us|our|ours)\b/gi],['Second person',/\b(?:you|your|yours)\b/gi],['Third person',/\b(?:he|she|they|him|her|them|his|their|theirs)\b/gi]].map(([label,re])=>{
  const locations=[...visible.matchAll(re)].map(m=>({label:m[0],from:m.index+(doc.offset||0),to:m.index+m[0].length+(doc.offset||0)}));
  return {label,count:locations.length,locations};
 });
 add('Content','Point of view','info','');checks.at(-1).scored=false;checks.at(-1).cueGroups=pov;
 const keywords=[];
 for(const kind of ['secondary','topical','local']){
  const raw=m[kind+'_keywords'];
  if(raw!==undefined&&((!Array.isArray(raw)&&typeof raw!=='string')||(Array.isArray(raw)&&raw.some(x=>typeof x!=='string'))))add('Keywords',`${kind} keyword format`,false,'Invalid keyword property','Text or list of text · commas/newlines separate phrases');
 }
 if(!primary)add('Keywords','Primary keyword',false,'No primary keyword to count','Set primary_keyword · mention it naturally');
 const keywordSource=visibleSource(doc.body).replace(/[*_~]/g,' '),metadataSpans=metadataKeywordSpans(doc),keywordTotal=total+metadataSpans.reduce((n,span)=>n+words(doc.source.slice(span.from,span.to)).length,0);
 const configured=[...primaries.map(phrase=>({phrase,kind:'primary'})),...Object.entries(lists).flatMap(([kind,list])=>list.map(phrase=>({phrase,kind})))];
 for(const k of configured){
  const mentions=ranges(keywordSource,k.phrase).map(l=>({label:k.phrase,from:l.from+(doc.offset||0),to:l.to+(doc.offset||0)}));
  for(const span of metadataSpans)for(const loc of ranges(doc.source.slice(span.from,span.to),k.phrase))mentions.push({label:k.phrase,from:span.from+loc.from,to:span.from+loc.to});mentions.sort((a,b)=>a.from-b.from);
  const count=mentions.length,density=keywordTotal?count/keywordTotal*100:0;
  const ok=count>0&&density<=config.repeatDensity;
  const densityText=density>0&&density<0.1&&Number(density.toFixed(3))>=0.1?'<0.100':density.toFixed(3);
  add('Keywords',`${k.kind}: ${k.phrase}`,ok,`${count} mentions · ${densityText}% density`,
   k.kind==='primary'?(profile==='webpage'?'At least 4–6 mentions':'At least 8–10 mentions'):'At least 1–2 mentions');
  checks.at(-1).keyword={...k,mentions,density};
  keywords.push({...k,count,density,mentions});
 }
 if(!lists.secondary.length)add('Keywords','Secondary keywords',false,'No secondary keywords configured','Set secondary_keywords · mention each at least once');
 const links=parseLinks(linkSource(doc.body));let hostname='';
 try{hostname=new URL(scalar('site_url')).hostname.toLowerCase();}catch{}
 const internal=new Set(),external=new Set(),internalLinks=[],externalLinks=[],vague=[],self=[];
 let currentUrl=scalar('page_url').replace(/\/$/,'');if(!currentUrl)try{currentUrl=new URL(slug,scalar('site_url')).href.replace(/\/$/,'');}catch{}
 const noteName=(options.notePath||'').replace(/\.md$/i,'');
 for(const l of links){
  const target=l.target;if(!target)continue;
  if(/^(?:click here|here|read more|learn more|link|this link)$/i.test(l.text.trim()))vague.push(l);
  let isSelf=target.startsWith('#');
  if(/^https?:\/\//i.test(target)){
   try{const u=new URL(target);isSelf=isSelf||!!currentUrl&&u.href.split('#')[0].replace(/\/$/,'')===currentUrl;
    if(!isSelf){const own=hostname&&u.hostname.toLowerCase()===hostname;(own?internal:external).add(target);(own?internalLinks:externalLinks).push(l);}
   }catch{}
  }else if(!/^[a-z][a-z\d+.-]*:/i.test(target)){
   const path=target.split('#')[0].replace(/\.md$/i,'');
   isSelf=isSelf||!!noteName&&(path===noteName||path===noteName.split('/').at(-1))||!!slug&&target.replace(/\/$/,'')===slug.replace(/\/$/,'')||!!scalar('page_url')&&target.split('#')[0].replace(/\/$/,'')===scalar('page_path').replace(/\/$/,'');
   if(!isSelf){internal.add(target);internalLinks.push(l);}
  }
  if(isSelf)self.push(l);
 }
 add('Links & images','Internal links',internal.size>=config.minInternal,`${internal.size} distinct destinations`, `At least ${config.minInternal} internal links on this page`);
 checks.at(-1).linkGroups=groupLinks(internalLinks,doc.offset||0);
 add('Links & images','External links',external.size>=config.minExternal,`${external.size} distinct external destinations`,`At least ${config.minExternal} external link${config.minExternal===1?'':'s'} on this page`);
 checks.at(-1).linkGroups=groupLinks(externalLinks,doc.offset||0);
 add('Links & images','Anchor text',vague.length?'info':'pass',`${vague.length} vague link labels`,'Descriptive anchor text',vague.map(l=>l.source));
 checks.at(-1).scored=false;
 const images=[...b.raw.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)|!\[\[([^\]]+)\]\]/g)].map(x=>({alt:x[1]?.trim()||'',target:x[2]||x[3]?.split('|')[0]||'',wiki:!!x[3]}));
 const vagueAlt=images.filter(i=>i.alt&&!i.wiki&&(/^(?:image|photo|picture|graphic|icon|banner|screenshot|img|placeholder|test|alt text)(?:[ _-]*\d+)?(?:\.[a-z0-9]+)?$/i.test(i.alt)||/^(?:image|img|photo|dsc)[-_]?\d+$/i.test(i.alt)||/\.(?:webp|png|jpe?g|gif)$/i.test(i.alt))).length;
 const absentAlt=images.filter(i=>!i.alt||i.wiki).length,notWebp=images.filter(i=>! /\.webp(?:[?#].*)?$/i.test(i.target)).length;
 if(images.length){
 add('Links & images','Image alt text',absentAlt===0&&vagueAlt===0,`${absentAlt} missing · ${vagueAlt} vague alt text`,'Descriptive alt text on every image');
 add('Links & images','WebP images',notWebp===0,`${images.length} images · ${notWebp} not WebP`,'All image files use .webp');
 }else{add('Links & images','Images','info','No images. Add images to see image checks.');checks.at(-1).scored=false;}
 // Exact source ranges let the panel select text without rewriting the note.
 const bodyStart=doc.offset||0,lines=doc.body.split('\n');
 const lineRange=(line,label)=>{const from=bodyStart+lines.slice(0,line).reduce((n,l)=>n+l.length+1,0);return {label,from,to:from+(lines[line]||'').length};};
 const textRanges=(text,label)=>{const out=[];let start=0,index;while(text&&(index=doc.body.indexOf(text,start))>=0){out.push({label,from:bodyStart+index,to:bodyStart+index+text.length});start=index+Math.max(1,text.length);}return out;};
 for(const c of checks){
  c.locations=c.locations||[];
  if(['pass','manual'].includes(c.status))continue;
  if(c.label==='Paragraphs after H2s')c.locations=paragraphGaps.map(h=>lineRange(h.line,h.text));
  else if(c.label==='H1 heading')c.locations=h1s.map(h=>lineRange(h.line,`${h.text} · ${Array.from(h.text).length} characters`));
  else if(['Heading character counts','Heading depth','Heading hierarchy','H3s per H2 section','Heading count'].includes(c.label))c.locations=b.headings.filter(h=>c.label==='Heading count'?h.level===2:c.label!=='Heading character counts'||h.level===2&&rangeStatus(Array.from(h.text).length,config.ranges.h2)!=='pass').map(h=>lineRange(h.line,`${h.text} · ${Array.from(h.text).length} characters`));
  else if(c.label==='Long sentences')c.locations=longSentences.map((p,i)=>({lengthStatus:words(p.text).length>config.maxSentenceWords+config.maxSentenceTolerance?'review':'near',label:`${p.text.replace(/[`*_~]/g,'').trim()} · ${words(p.text).length} words`,from:p.from+bodyStart,to:p.to+bodyStart}));
  else if(c.label==='Long paragraphs')c.locations=longParagraphs.map(p=>({lengthStatus:words(p.text).length>config.maxWords+config.maxParagraphTolerance?'review':'near',label:`Paragraph ${paragraphs.indexOf(p)+1} · ${words(p.text).length} words`,from:p.from+bodyStart,to:p.to+bodyStart}));
  else if(c.label==='Complex words')c.locations=complex;
  else if(c.label==='Duplicate elements')c.locations=[...(meta&&b.lede&&norm(meta)===norm(b.lede)?textRanges(b.paragraphs.find(p=>norm(plain(p))===norm(b.lede))||'','Lede · matches meta description'):[]),...b.headings.filter(h=>b.headings.some(o=>o!==h&&norm(o.text)===norm(h.text))).map(h=>lineRange(h.line,`${h.text} · ${Array.from(h.text).length} characters · duplicate`)),...b.paragraphs.flatMap((p,i)=>b.paragraphs.some((o,j)=>i!==j&&norm(plain(o))===norm(plain(p)))?textRanges(p,`Paragraph ${i+1} · duplicate`):[])];
  else if(['Title tag','Meta description','Slug'].includes(c.label)){const key={'Title tag':'title_tag','Meta description':'meta_description','Slug':'slug'}[c.label];if(doc.metadataLocations?.[key]){c.locations=[doc.metadataLocations[key]];continue;}const whole=doc.source||'';const match=new RegExp('^'+key+':.*$','m').exec(whole);if(match)c.locations=[{label:key,from:match.index,to:match.index+match[0].length}];}
  else if(c.label==='Lede')c.locations=textRanges(b.paragraphs[0]||'',`Lede · ${ledeLength} characters`);
  else if(['Anchor text'].includes(c.label))c.locations=c.issues.flatMap(t=>textRanges(t,t));
  if(c.locations.length&&['Anchor text'].includes(c.label))c.issues=c.issues.filter(issue=>!c.locations.some(l=>l.label===issue));
  if(c.label==='Duplicate elements'&&c.locations.length)c.issues=c.issues.filter(issue=>!issue.includes('duplicates ')&&!issue.includes('Meta description matches lede'));
  if(c.label==='Heading character counts')for(const l of c.locations){const heading=b.headings.find(h=>bodyStart+lines.slice(0,h.line).reduce((n,line)=>n+line.length+1,0)===l.from);if(heading){l.lengthStatus=rangeStatus(Array.from(heading.text).length,config.ranges.h2);l.tooLong=Array.from(heading.text).length>config.ranges.h2[1];}}
  const unique=new Set();c.locations=c.locations.filter(l=>{const key=l.from+':'+l.to;if(unique.has(key))return false;unique.add(key);return true;});
 }
 const toc=h2s.map(h=>{const next=b.headings.find(x=>x.line>h.line&&x.level<=2)?.line??lines.length;const section=lines.slice(h.line+1,next).join('\n').replace(/^ {0,3}#{1,6}\s+.*$/gm,'');return {line:h.line,title:h.text,...lineRange(h.line,h.text),words:words(plain(parseBody(section).raw)).length};});
 checks.push(...clusteringChecks(doc,paragraphs,keywords,config));
 for(const h of toc)h.long=h.words>config.maxSectionWords;
 const preview={title,description:meta,url:scalar('page_url')||currentUrl||slug||scalar('site_url')};
 if(doc.originalOffset){
  const seen=new WeakSet();
  const remap=value=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(Number.isInteger(value.from)&&Number.isInteger(value.to)){value.from=doc.originalOffset(value.from);value.to=doc.originalOffset(value.to);}for(const child of Object.values(value))remap(child);};
  remap(checks);remap(keywords);
 }
 return {optedIn:true,profile,total,checks,keywords,images,body:b,preview,toc,metadata:doc.meta,score:checklistScore(checks)};
}
module.exports={metadataKeywordSpans,wordForms,keywordPlurals,pageUrl,linkSource,groupLinks,keywordCategories,tableCells,prepareDocument,keywordList,findingKey,rowKey,applyDismissals,sectionCounts,h2ParagraphGaps,groupWordLocations,HIGHLIGHT_COLORS,normalizeColors,progressColor,highlightStyle,visibleSource,proseSpans,sentenceSpans,syllableCount,DEFAULTS,settingsWithDefaults,rangeStatus,checklistScore,parseLinks,secondaryKeywords,words,norm,plain,splitDocument,ranges,occurrences,parseBody,analyze};

})(analyzerModule);
const sidebarModule={exports:{}};
(function(module){
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

})(sidebarModule);
const bookmarkModule={exports:{}};
(function(module){
"use strict";
function structuralSource(text) {
 const lines=text.split('\n'); let front=lines[0]?.trim()==='---', fence=null;
 return lines.map((line,i)=>{
  const blank=()=>line.replace(/[^\r]/g,' ');
  if(front){if(i>0 && /^(---|\.\.\.)\s*$/.test(line))front=false;return blank();}
  const m=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if(fence){if(m && m[1][0]===fence[0] && m[1].length>=fence.length && !m[2].trim())fence=null;return blank();}
  if(m){fence=m[1];return blank();} return line;
 }).join('\n');
}
const MARKER='%% manuscript-bookmark %%';
function bookmarks(text){
 const source=structuralSource(text).replace(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g,m=>m===MARKER?m:m.replace(/[^\n\r]/g,' '));
 const result=[];const re=/^ {0,3}%% manuscript-bookmark %%[ \t]*\r?$/gm;let m;
 while((m=re.exec(source))){const from=m.index,to=from+m[0].replace(/\r$/,'').length;result.push({from,to,line:source.slice(0,from).split('\n').length-1});}
 return result;
}
function bookmarkChapter(chapters,line){
 let index=-1;for(let i=0;i<chapters.length;i++)if(chapters[i].line<=line)index=i;return index;
}
// Move the actual marker line. The result can be dispatched as one undoable edit.
function bookmarkEdit(text,targetLine){
 const eol=text.includes('\r\n')?'\r\n':'\n',lines=text.split(/\r?\n/),existing=bookmarks(text),removed=new Set(existing.map(b=>b.line));
 targetLine=Math.max(0,Math.min(lines.length,Math.trunc(targetLine)));
 const before=lines.slice(0,targetLine).filter((_,i)=>!removed.has(i));
 const after=lines.slice(targetLine).filter((_,i)=>!removed.has(i+targetLine));
 const output=[...before,MARKER,...after].join(eol),line=before.length;
 if(bookmarks(output).length!==1||bookmarks(output)[0].line!==line)throw new Error('Place the bookmark on a prose line outside Properties, code blocks, and comments.');
 let from=0;while(from<text.length&&from<output.length&&text[from]===output[from])from++;
 let oldEnd=text.length,newEnd=output.length;while(oldEnd>from&&newEnd>from&&text[oldEnd-1]===output[newEnd-1]){oldEnd--;newEnd--;}
 return {from,to:oldEnd,insert:output.slice(from,newEnd),line,text:output};
}
function legacyBookmark(text){const source=structuralSource(text);const match=/^ {0,3}#{1,6} +BOOKMARK(?:[ \t]+[-–—]+)?[ \t]*\r?$/im.exec(source);if(!match)return null;return {line:source.slice(0,match.index).split('\n').length-1};}
module.exports={legacyBookmark,MARKER,bookmarks,bookmarkChapter,bookmarkEdit};

})(bookmarkModule);
'use strict';
const {Plugin, ItemView, MarkdownView, TFile, Notice, parseYaml, editorInfoField, PluginSettingTab, Setting, setIcon} = require('obsidian');
function pinIcon(el,pinned){setIcon(el,'pin');if(pinned){const svg=el.querySelector?.('svg');if(svg){const slash=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','line');slash.setAttribute('x1','3');slash.setAttribute('y1','3');slash.setAttribute('x2','21');slash.setAttribute('y2','21');svg.append(slash);}}}
const {ViewPlugin, Decoration,WidgetType,EditorView} = require('@codemirror/view');
const {StateEffect} = require('@codemirror/state');
const {metadataKeywordSpans,splitDocument,prepareDocument,keywordList,analyze,applyDismissals,findingKey,rowKey,ranges,parseBody,secondaryKeywords,DEFAULTS,settingsWithDefaults,checklistScore,normalizeColors,progressColor,highlightStyle,sectionCounts,keywordCategories,visibleSource,words} = analyzerModule.exports;
const {normalizeSidebarPins,renameSidebarPins,getChecklistRouter}=sidebarModule.exports;
const {wordGoal,noTooltips,rangeSetting,upperSetting,outline,WordCountSync}=supportModule.exports;
const {MARKER,bookmarks,bookmarkChapter,bookmarkEdit,legacyBookmark}=bookmarkModule.exports;
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
