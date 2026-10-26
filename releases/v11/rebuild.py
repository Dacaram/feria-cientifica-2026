import pathlib,json,hashlib,urllib.request,zipfile,base64,zlib,io
root=pathlib.Path(__file__).parent
plan=json.loads((root/'v11-payload.json').read_text())
with urllib.request.urlopen(plan['base_url'],timeout=120) as response:base=response.read()
assert hashlib.sha256(base).hexdigest()==plan['base_sha256'],'La base no coincide'
archive=zipfile.ZipFile(io.BytesIO(base));out=bytearray()
for op in plan['operations']:
 if 'data' in op:out.extend(base64.b64decode(op['data']))
 elif 'copy' in op:
  start,length=op['copy'];out.extend(base[start:start+length])
 else:
  raw=archive.read(op['entry'])
  if op['method']==0:packed=raw
  else:
   compressor=zlib.compressobj(6,zlib.DEFLATED,-15);packed=compressor.compress(raw)+compressor.flush()
  assert hashlib.sha256(packed).hexdigest()==op['sha256'],'Compresión incompatible'
  out.extend(packed)
assert hashlib.sha256(out).hexdigest()==plan['sha256'],'El APK no coincide con el firmado'
path=pathlib.Path(plan['filename']);path.write_bytes(out)
assert zipfile.ZipFile(path).testzip() is None
print('APK V.11 exacto y verificado:',path)
