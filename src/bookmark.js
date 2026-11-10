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
