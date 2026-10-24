import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
const worker=fs.readFileSync('worker/index.js','utf8');
const page=JSON.parse(worker.match(/^const page = (.*);\n/)[1]);
for (const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
const objects=new Map(),bucket={async get(k){const v=objects.get(k);return v?{json:async()=>JSON.parse(v)}:null},async put(k,v){objects.set(k,v)},async delete(k){objects.delete(k)}};
let outbound=[],failExchange=false,diagnostics=[],identity={id:'42',name:'Test Owner'},token='test-token';
const context=vm.createContext({console:{error:s=>diagnostics.push(s)},crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,Request,Date,Uint8Array,AbortSignal,json:(d,s=200)=>new Response(JSON.stringify(d),{status:s}),fetch:async(url,opt)=>{outbound.push({url:String(url),opt});if(String(url).endsWith('/oauth/access_token'))return failExchange?Response.json({error:{code:190,error_subcode:123,message:'must-not-log-sensitive-provider-message'}},{status:400}):Response.json({access_token:token,expires_in:3600});if(String(url).includes('/me?'))return Response.json(identity);return Response.json({data:[]})}});
vm.runInContext(fs.readFileSync('meta-auth-server.js','utf8')+'\nglobalThis.api={handleMetaAuth,personalMetaAssets,metaConnection,metaSeal,metaConnections};',context);
const {api}=context,origin='https://test.chatgpt.site',env={BUCKET:bucket,META_APP_ID:'123',META_APP_SECRET:'test-only-app-secret'};
const req=(path,method='GET',extra={})=>new Request(origin+path,{method,headers:{...(method==='POST'?{origin,'content-type':'application/json'}:{}),...extra},...(method==='POST'?{body:'{}'}:{})});
let r=await api.handleMetaAuth(req('/api/meta/status'),env,null,new URL(origin+'/api/meta/status'));assert.equal(r.status,401);
r=await api.handleMetaAuth(req('/api/meta/status'),{BUCKET:bucket},'owner',new URL(origin+'/api/meta/status'));assert.equal((await r.json()).configured,false);
r=await api.handleMetaAuth(req('/api/meta/start','POST',{origin:'https://evil.test'}),env,'owner',new URL(origin+'/api/meta/start'));assert.equal(r.status,403);
r=await api.handleMetaAuth(req('/api/meta/start','POST'),env,'owner',new URL(origin+'/api/meta/start'));const start=await r.json(),auth=new URL(start.url),state=auth.searchParams.get('state'),cookie=r.headers.get('set-cookie').split(';')[0];assert.equal(auth.origin,'https://www.facebook.com');assert.equal(auth.searchParams.get('redirect_uri'),origin+'/api/meta/callback');assert(!start.url.includes('test-only-app-secret'));
const callback='/api/meta/callback?state='+state+'&code=test-code';
r=await api.handleMetaAuth(req(callback,'GET',{cookie}),env,'other',new URL(origin+callback));assert.match(r.headers.get('location'),/state_error/);assert.equal(outbound.length,0);
r=await api.handleMetaAuth(req(callback),env,'owner',new URL(origin+callback));assert.match(r.headers.get('location'),/state_error/);
r=await api.handleMetaAuth(req(callback,'GET',{cookie}),env,'owner',new URL(origin+callback));assert.equal(r.headers.get('location'),'/?meta_result=connected');assert.equal(objects.has('meta-oauth/'+state),false);assert(!objects.get('meta-connections/owner/connection').includes('test-token'));
assert.equal((await api.metaConnection(env,'owner')).token,'test-token');assert.equal(await api.metaConnection(env,'other'),null);
r=await api.handleMetaAuth(req('/api/meta/status'),env,'owner',new URL(origin+'/api/meta/status'));const status=await r.json();assert.equal(status.connected,true);assert(!JSON.stringify(status).includes('test-token'));
const count=outbound.length;r=await api.handleMetaAuth(req(callback,'GET',{cookie}),env,'owner',new URL(origin+callback));assert.match(r.headers.get('location'),/state_error/);assert.equal(outbound.length,count);
r=await api.personalMetaAssets(new Request(origin+'/api/assets',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({operation:'pixels',account:'999'})}),env,'owner');assert.equal(r.status,403);assert(!outbound.some(x=>x.url.includes('act_999')));
console.log('PASS: client syntax, configuration, CSRF, owner isolation, encrypted tokens, callback replay, unauthorized asset guard');

failExchange=true;
r=await api.handleMetaAuth(req('/api/meta/start','POST'),env,'owner',new URL(origin+'/api/meta/start'));const retry=new URL((await r.json()).url),retryCookie=r.headers.get('set-cookie').split(';')[0];const retryPath='/api/meta/callback?state='+retry.searchParams.get('state')+'&code=secret-code';
r=await api.handleMetaAuth(req(retryPath,'GET',{cookie:retryCookie}),env,'owner',new URL(origin+retryPath));assert.equal(r.headers.get('location'),'/?meta_result=failed');assert(diagnostics.some(s=>JSON.parse(s).provider_code===190));assert(!diagnostics.join('').match(/secret-code|must-not-log|test-token|test-only-app-secret/));assert.equal((await api.metaConnection(env,'owner')).token,'test-token');
console.log('PASS: failed exchange preserves connection and diagnostics exclude credentials/provider text');

const post=(path,body,who='owner',requestOrigin=origin)=>api.handleMetaAuth(new Request(origin+path,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json'},body:JSON.stringify(body)}),env,who,new URL(origin+path));
async function connect(mode='add'){const r=await post('/api/meta/start',{mode});assert.equal(r.status,200);const d=await r.json(),path='/api/meta/callback?state='+new URL(d.url).searchParams.get('state')+'&code=test-code';return api.handleMetaAuth(req(path,'GET',{cookie:r.headers.get('set-cookie').split(';')[0]}),env,'owner',new URL(origin+path))}
// Model a deployed v1 record, then add a genuinely different provider identity.
await bucket.put('meta-connections/owner/connection',await api.metaSeal(env,'owner',{id:'42',name:'Legacy Owner',token:'test-token',expires_at:Date.now()+3600000}));
failExchange=false;identity={id:'84',name:'Second Profile'};token='second-token';
r=await connect();assert.equal(r.headers.get('location'),'/?meta_result=connected');
let all=await api.metaConnections(env,'owner');assert.deepEqual(Array.from(all.connections,c=>c.id),['42','84']);assert.equal(all.active,'84');assert.equal((await api.metaConnection(env,'owner','42')).token,'test-token');assert(!objects.get('meta-connections/owner/connection').match(/test-token|second-token/));
r=await api.handleMetaAuth(req('/api/meta/status'),env,'owner',new URL(origin+'/api/meta/status'));let multiStatus=await r.json();assert.equal(multiStatus.connections.length,2);assert(!JSON.stringify(multiStatus).includes('token'));
assert.equal((await post('/api/meta/select',{id:'42'},'owner','https://evil.test')).status,403);
assert.equal((await post('/api/meta/select',{id:'84'},'other')).status,403);
assert.equal((await post('/api/meta/select',{id:'999'})).status,403);
r=await post('/api/meta/select',{id:'42'});assert.equal((await r.json()).meta_user_id,'42');
// Refresh cannot silently replace one selected identity with a different one.
r=await connect('refresh');assert.match(r.headers.get('location'),/identity_mismatch/);assert.equal((await api.metaConnections(env,'owner')).active,'42');assert.equal((await api.metaConnection(env,'owner','42')).token,'test-token');
const assets=(id,who='owner')=>api.personalMetaAssets(new Request(origin+'/api/assets',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({operation:'accounts',connection_id:id})}),env,who);
outbound=[];r=await assets('84');assert.equal(r.status,200);assert.equal((await r.json()).connection_id,'84');assert(outbound.every(x=>x.opt.headers.Authorization==='Bearer second-token'));
assert.equal((await assets('84','other')).status,403);assert.equal((await assets('999')).status,403);
identity={id:'84',name:'Second Profile Renamed'};await connect();assert.equal((await api.metaConnections(env,'owner')).connections.length,2);
all=await api.metaConnections(env,'owner');all.connections.find(c=>c.id==='84').expires_at=0;await bucket.put('meta-connections/owner/connection',await api.metaSeal(env,'owner',all));outbound=[];assert.equal((await assets('84')).status,401);assert.equal(outbound.length,0);assert.equal((await assets('42')).status,200);
console.log('PASS: legacy preservation, multiple profiles, selection authorization, refresh identity guard, pinned requests, expired profile isolation');
