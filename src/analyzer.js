'use strict';
const {wordGoal}=require('./support');
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
