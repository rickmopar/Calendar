let managerEvents=[],session=null,selectedId='';
const $=s=>document.querySelector(s),form=$('#eventForm');
const labels={imported:'Imported · not reviewed',confirmed:'Reviewed',review:'Draft / needs review',hidden:'Hidden'};
async function api(path,payload){
 const response=await fetch(path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''}:{},...(payload?{body:JSON.stringify(payload)}:{}),cache:'no-store'});
 const type=response.headers.get('content-type')||'';
 if(!type.includes('application/json'))throw Error('Management server is not connected.');
 const result=await response.json();if(!response.ok){if(response.status===401&&path!='/api/login')signedOut();throw Error(result.error||'Request failed.');}return result;
}
function message(text){$('#message').textContent=text;}
function signedOut(){session=null;$('#workspace').hidden=true;$('#logout').hidden=true;$('#loginPanel').hidden=false;}
async function connect(){try{session=await api('/api/session');$('#loginPanel').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;await reload();}catch(error){if(error.message.includes('not connected')){$('#setupNote').hidden=false;$('#loginPanel').hidden=true;}else message(error.message);}}
async function reload(){managerEvents=await api('/api/events');renderList();}
function renderList(){
 const q=$('#manageSearch').value.toLowerCase(),status=$('#statusFilter').value,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const items=managerEvents.filter(e=>(status==='all'||e.status===status)&&(!q||`${e.title} ${e.city} ${e.source}`.toLowerCase().includes(q))&&($('#manageDates').value==='all'||new Date(e.endDate||e.startDate).toLocaleDateString('en-CA',{timeZone:'America/New_York'})>=today));
 $('#manageCount').textContent=`${items.length} matching events`;
 $('#manageList').replaceChildren(...items.map(e=>{const b=document.createElement('button');b.className='manager-item';b.type='button';b.setAttribute('aria-pressed',String(e.id===selectedId));const title=document.createElement('strong');title.textContent=e.title;const meta=document.createElement('small');meta.textContent=`${e.dateLabel} · ${e.city} · ${labels[e.status]}`;b.append(title,meta);b.onclick=()=>edit(e);return b;}));
 if(!items.length)$('#manageList').textContent='No events match. Try another search or show all dates.';
}
function edit(e){
 form.reset();selectedId=e?.id||'';$('#editorHeading').textContent=e?'Edit event':'Add an event';
 for(const name of ['id','title','city','type','source','status','venue','address','sourceUrl','description']){if(e&&form.elements[name]){if(name==='type'&&![...form.elements.type.options].some(o=>o.value===e.type))form.elements.type.add(new Option(e.type,e.type));form.elements[name].value=e[name]??'';}}
 if(e){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(e.startDate)).map(p=>[p.type,p.value]));form.elements.date.value=`${parts.year}-${parts.month}-${parts.day}`;form.elements.time.value=e.allDay?'':`${parts.hour}:${parts.minute}`;form.elements.sourceUrl.value=e.sourceUrl||e.url||'';}renderList();
}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/login',Object.fromEntries(new FormData(e.target)));e.target.reset();message('Signed in.');await connect();}catch(error){message(error.message);}};
$('#logout').onclick=async()=>{try{await api('/api/logout',{});signedOut();message('Signed out.');}catch(error){message(error.message);}};
for(const name of ['manageSearch','statusFilter','manageDates'])$('#'+name).addEventListener('input',renderList);
$('#newEvent').onclick=()=>edit(null);
form.onsubmit=async e=>{e.preventDefault();$('#saveEvent').disabled=true;try{const r=await api('/api/events',Object.fromEntries(new FormData(form)));await reload();edit(r.event);message('Saved on this server. The public calendar here is updated.');}catch(error){message(error.message);}finally{$('#saveEvent').disabled=false;}};
connect();
