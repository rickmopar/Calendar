import http.cookiejar, importlib.util, json, shutil, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
spec=importlib.util.spec_from_file_location('calendar_server',Path(__file__).resolve().parents[1]/'server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ManagerTest(unittest.TestCase):
 def test_management_and_persistent_corrections(self):
  source=m.ROOT
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'scripts').mkdir();(root/'data').mkdir()
   shutil.copy(source/'scripts/publish-managed.js',root/'scripts/publish-managed.js')
   event=dict(id='example',title='Example Show',city='Chesapeake',source='TRAACA',startDate='2027-10-02T13:00:00.000Z',endDate='2027-10-02T13:00:00.000Z',allDay=True)
   (root/'data/imported-events.json').write_text(json.dumps([event]));(root/'data/metadata.json').write_text('{}')
   m.ROOT=root;m.DATA=root/'private';m.setup('testmanager','synthetic-test-password')
   server=m.ThreadingHTTPServer(('127.0.0.1',0),m.Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
   jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
   def post(path,payload,csrf=''):
    return client.open(urllib.request.Request(base+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Origin':base,'X-CSRF-Token':csrf}))
   try:
    with self.assertRaises(urllib.error.HTTPError) as err:client.open(base+'/api/events')
    self.assertEqual(err.exception.code,401)
    with self.assertRaises(urllib.error.HTTPError) as err:client.open(base+'/.calendar-admin/account.json')
    self.assertEqual(err.exception.code,404)
    post('/api/login',dict(username='testmanager',password='synthetic-test-password'))
    session=json.load(client.open(base+'/api/session'));csrf=session['csrf']
    payload=dict(id='example',title='Corrected Show',city='Chesapeake',date='2027-10-02',status='hidden',source='TRAACA')
    with self.assertRaises(urllib.error.HTTPError) as err:post('/api/events',payload)
    self.assertEqual(err.exception.code,403)
    post('/api/events',payload,csrf)
    self.assertEqual(json.loads((root/'data/events-2026.json').read_text()),[])
    import subprocess
    event['id']='example-reordered'
    (root/'data/imported-events.json').write_text(json.dumps([event]))
    subprocess.run(['node',str(root/'scripts/publish-managed.js'),str(m.DATA/'state.json')],check=True,capture_output=True)
    self.assertEqual(json.loads((root/'data/events-2026.json').read_text()),[])
    payload.update(status='confirmed',sourceUrl='https://example.com/organizer')
    post('/api/events',payload,csrf)
    saved=json.loads((root/'data/events-2026.json').read_text());self.assertEqual(saved[0]['title'],'Corrected Show');self.assertTrue(saved[0]['reviewedAt'])
    post('/api/logout',{},csrf)
    with self.assertRaises(urllib.error.HTTPError) as err:client.open(base+'/api/events')
    self.assertEqual(err.exception.code,401)
   finally:server.shutdown();server.server_close();m.ROOT=source
if __name__=='__main__':unittest.main()
