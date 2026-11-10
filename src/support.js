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
