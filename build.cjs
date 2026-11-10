const fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const wrap=(name,source)=>`const ${name}={exports:{}};\n(function(module){\n${source}\n})(${name});\n`;
const replace=s=>s.replaceAll("require('./support')",'supportModule.exports').replaceAll("require('./analyzer')",'analyzerModule.exports').replaceAll("require('./sidebar')",'sidebarModule.exports').replaceAll("require('./bookmark')",'bookmarkModule.exports');
fs.writeFileSync(path.join(__dirname,'main.js'),'/* Copywriter Checklist 1.3.0 */\n'+wrap('supportModule',read('src/support.js'))+wrap('analyzerModule',replace(read('src/analyzer.js')))+wrap('sidebarModule',read('src/sidebar.js'))+wrap('bookmarkModule',read('src/bookmark.js'))+replace(read('src/plugin.js')));
