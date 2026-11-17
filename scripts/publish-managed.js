const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function importKey(e){return [e.source||"",e.title.trim().toLowerCase(),e.startDate.slice(0,10)].join("|");}
function mergeEvents(imported,state={}){
 const result=new Map(imported.map(e=>[e.id,{...e}]));
 for(const [id,patch] of Object.entries(state.events||{})){
  const match=patch._importKey && [...result.values()].find(e=>importKey(e)===patch._importKey);
  if(match)result.delete(match.id);
  if(['hidden','review'].includes(patch.status)){result.delete(id);continue;}
  result.set(id,{...(result.get(id)||{}),...patch,id});
 }
 return [...result.values()].map(e=>Object.fromEntries(Object.entries(e).filter(([k])=>!k.startsWith("_")))).sort((a,b)=>a.startDate.localeCompare(b.startDate));
}
function publish(stateFile=process.env.CALENDAR_STATE || path.join(root,'.calendar-admin','state.json')){
 const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{};
 const events=mergeEvents(JSON.parse(fs.readFileSync(path.join(root,'data/imported-events.json'))),state);
 const meta=JSON.parse(fs.readFileSync(path.join(root,'data/metadata.json')));
 meta.totalEvents=events.length;meta.publishedAt=new Date().toISOString();
 meta.sourceCounts={};for(const e of events)meta.sourceCounts[e.source]=(meta.sourceCounts[e.source]||0)+1;
 const files={'events-2026.json':JSON.stringify(events,null,2),'metadata.json':JSON.stringify(meta,null,2),'events-2026.js':`window.CCCHR_EVENTS_2026 = ${JSON.stringify(events,null,2)};\nwindow.CCCHR_METADATA = ${JSON.stringify(meta,null,2)};\n`};
 for(const [name,data] of Object.entries(files)){const target=path.join(root,'data',name);fs.writeFileSync(target+'.tmp',data);fs.renameSync(target+'.tmp',target);}
 // The public iCloud/Apple subscription feed must match the published catalogue.
 require('./build-calendar-feed').publish(events,meta);
 return events;
}
module.exports={mergeEvents,publish};if(require.main===module)console.log(`Published ${publish(process.argv[2]).length} events locally.`);
