#!/usr/bin/env python3
"""Private calendar management. Python 3.9+ and Node.js; binds to loopback only."""
import argparse, datetime, getpass, hashlib, hmac, json, os, secrets, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get('CALENDAR_ADMIN_DATA',ROOT/'.calendar-admin'))
LOCK=threading.RLock()
SESSIONS={}
HOSTS={'localhost','127.0.0.1','ricks-mac-mini.tail04cf30.ts.net'}
HOSTS.update(os.environ.get('CALENDAR_ALLOWED_HOSTS','').split(','))

def read_json(path,default=None):
    return json.loads(path.read_text()) if path.exists() else default

def atomic(path,value):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,indent=2));temp.chmod(0o600);temp.replace(path)

def password_hash(password,salt):
    return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()

def setup(username,password):
    if len(password)<12: raise ValueError('Use a password with at least 12 characters.')
    salt=secrets.token_hex(16)
    atomic(DATA/'account.json',dict(username=username,salt=salt,hash=password_hash(password,salt)))

def import_key(e):
    return "|".join([e.get("source",""),e["title"].strip().lower(),e["startDate"][:10]])

def catalogue():
    base=read_json(ROOT/'data/imported-events.json',[])
    edits=read_json(DATA/'state.json',{}).get('events',{})
    events={e['id']:{**e,'status':'imported'} for e in base}
    for key,patch in edits.items():
        match=next((e for e in events.values() if import_key(e)==patch.get('_importKey')),None)
        original=events.pop(match['id']) if match else events.get(key,{})
        events[key]={**original,**patch,'id':key}
    return sorted(events.values(),key=lambda e:e['startDate'])

def normalize(payload):
    title=str(payload.get('title','')).strip();city=str(payload.get('city','')).strip()
    if not title or not city:raise ValueError('Event name and city are required.')
    if len(title)>240:raise ValueError('Event name is too long.')
    date=datetime.date.fromisoformat(payload['date'])
    clock=str(payload.get('time','')).strip()
    value=datetime.time.fromisoformat(clock) if clock else datetime.time(9)
    start=datetime.datetime.combine(date,value,tzinfo=ZoneInfo('America/New_York'))
    status=payload.get('status','review')
    if status not in {'imported','confirmed','review','hidden'}:raise ValueError('Invalid publication status.')
    url=str(payload.get('sourceUrl','')).strip()
    if url and (urlparse(url).scheme not in {'http','https'} or not urlparse(url).netloc):raise ValueError('Enter a complete http or https source link.')
    if status=='confirmed' and not url:raise ValueError('Add a source link before marking an event reviewed.')
    stamp=start.astimezone(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    return dict(title=title,city=city,startDate=stamp,endDate=stamp,allDay=not bool(clock),month=date.strftime('%B'),weekday=date.strftime('%a'),dateLabel=date.strftime('%b %d, %Y'),timeLabel=start.strftime('%-I:%M %p') if clock else 'All day',type=str(payload.get('type','Car show')),source=str(payload.get('source','Manual')),sourceUrl=url,url=url,venue=str(payload.get('venue','')),address=str(payload.get('address','')),description=str(payload.get('description',''))[:20000],status=status,reviewedAt=datetime.datetime.now(datetime.timezone.utc).isoformat() if status=='confirmed' else None)

class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):pass
    def reply(self,status,value,cookie=None):
        data=json.dumps(value).encode();self.send_response(status)
        self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie:self.send_header('Set-Cookie',cookie)
        self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def host_ok(self):
        return self.headers.get('Host','').split(':')[0] in HOSTS
    def session(self):
        try:
            cookies=SimpleCookie();cookies.load(self.headers.get('Cookie',''))
            value=SESSIONS.get(cookies['calendar_session'].value,{})
            return value if value.get('expires',0)>time.time() else None
        except (KeyError,ValueError):return None
    def do_GET(self):
        if not self.host_ok():return self.reply(403,{'error':'Host not allowed.'})
        route=urlparse(self.path).path
        if route.startswith('/api/'):
            session=self.session()
            if not session:return self.reply(401,{'error':'Sign in to manage events.'})
            if route=='/api/session':return self.reply(200,{'username':session['username'],'csrf':session['csrf']})
            if route=='/api/events':
                with LOCK:return self.reply(200,catalogue())
            return self.reply(404,{'error':'Not found.'})
        allowed={'/':'index.html','/manage.html':'manage.html','/styles.css':'styles.css','/app.js':'app.js','/manager.js':'manager.js','/favicon.svg':'favicon.svg','/manifest.webmanifest':'manifest.webmanifest','/service-worker.js':'service-worker.js','/data/events-2026.js':'data/events-2026.js'}
        if route not in allowed:return self.reply(404,{'error':'Not found.'})
        path=ROOT/allowed[route]
        import mimetypes
        data=path.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(path.name)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Frame-Options','DENY');self.end_headers();self.wfile.write(data)
    def do_POST(self):
        origin=urlparse(self.headers.get('Origin',''))
        if not self.host_ok() or origin.netloc!=self.headers.get('Host') or origin.scheme not in {'http','https'}:return self.reply(403,{'error':'Use the management website to make changes.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=50000:raise ValueError('Request is too large or empty.')
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload,dict):raise ValueError('Invalid request.')
            route=urlparse(self.path).path
            if route=='/api/login':
                now=time.time();attempts=getattr(self.server,'attempts',[])
                self.server.attempts=[t for t in attempts if t>now-900]
                if len(self.server.attempts)>=10:return self.reply(429,{'error':'Too many attempts. Try again in 15 minutes.'})
                self.server.attempts.append(now)
                config=read_json(DATA/'account.json')
                digest=password_hash(str(payload.get('password','')),config['salt'])
                if payload.get('username')!=config['username'] or not hmac.compare_digest(digest,config['hash']):return self.reply(401,{'error':'Username or password is incorrect.'})
                self.server.attempts=[]
                SESSIONS.update({k:v for k,v in SESSIONS.items() if v['expires']>now})
                token=secrets.token_urlsafe(32);SESSIONS[token]=dict(username=config['username'],csrf=secrets.token_urlsafe(24),expires=now+43200)
                secure='; Secure' if origin.scheme=='https' else ''
                return self.reply(200,{'ok':True},f'calendar_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+secure)
            session=self.session()
            if not session:return self.reply(401,{'error':'Please sign in.'})
            if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),session['csrf']):return self.reply(403,{'error':'Please reload the page.'})
            if route=='/api/logout':
                for key,value in list(SESSIONS.items()):
                    if value is session:del SESSIONS[key]
                return self.reply(200,{'ok':True},'calendar_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if route!='/api/events':return self.reply(404,{'error':'Not found.'})
            with LOCK:
                key=str(payload.get('id') or 'managed-'+secrets.token_hex(12))
                old=next((e for e in catalogue() if e['id']==key),{})
                updated=normalize(payload)
                # Keep multi-day imports intact when only title, location or review status changes.
                old_date=datetime.datetime.fromisoformat(old['startDate'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat() if old else None
                if old_date==payload.get('date') and old['endDate']>=updated['startDate']:updated['endDate']=old['endDate']
                patch={**old,**updated,'id':key}
                if old and not key.startswith('managed-'):patch['_importKey']=old.get('_importKey') or import_key(old)
                state=read_json(DATA/'state.json',{'events':{}});previous=json.loads(json.dumps(state))
                state['events'][key]=patch;atomic(DATA/'state.json',state)
                try:subprocess.run(['node',str(ROOT/'scripts/publish-managed.js'),str(DATA/'state.json')],cwd=ROOT,check=True,capture_output=True)
                except (subprocess.CalledProcessError,OSError):
                    atomic(DATA/'state.json',previous)
                    return self.reply(500,{'error':'Could not publish locally; the edit was rolled back.'})
                return self.reply(200,{'ok':True,'event':patch})
        except (ValueError,KeyError,TypeError) as error:return self.reply(400,{'error':str(error)})

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--setup',action='store_true');parser.add_argument('--port',type=int,default=8770);args=parser.parse_args()
    if args.setup:
        username=input('Manager username: ').strip();password=getpass.getpass('Password (12+ characters): ')
        if password!=getpass.getpass('Confirm password: '):raise SystemExit('Passwords did not match.')
        setup(username,password);print('Account saved locally.');raise SystemExit()
    if not (DATA/'account.json').exists():raise SystemExit('First run: python3 server.py --setup')
    print(f'Calendar: http://127.0.0.1:{args.port}/\nManagement: http://127.0.0.1:{args.port}/manage.html',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
