// Meta user connections are owner-scoped and encrypted at rest. Tokens never reach the client.
const META_VERSION='v26.0';
const metaKey=user=>'meta-connections/'+encodeURIComponent(user)+'/connection';
const metaConfigured=env=>!!(env.BUCKET&&env.META_APP_ID&&env.META_APP_SECRET);
const metaBytes=s=>new TextEncoder().encode(s);
const metaHex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
async function metaCipherKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',metaBytes(env.META_APP_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function metaSeal(env,user,data){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await metaCipherKey(env);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:metaBytes(user)},key,metaBytes(JSON.stringify(data)));return JSON.stringify({iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))})}
async function metaStoredConnections(env,user){if(!metaConfigured(env))return null;const o=await env.BUCKET.get(metaKey(user));if(!o)return null;const d=await o.json();try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(d.iv),additionalData:metaBytes(user)},await metaCipherKey(env),new Uint8Array(d.cipher));return JSON.parse(new TextDecoder().decode(plain))}catch{throw Error('META_RECONNECT')}}
// One encrypted owner document preserves the legacy connection when adding profiles.
async function metaConnections(env,user){const d=await metaStoredConnections(env,user);if(!d)return {version:2,active:null,connections:[]};return d.version===2?d:{version:2,active:d.id,connections:[d]}}
async function metaConnection(env,user,id){const d=await metaConnections(env,user);return d.connections.find(c=>c.id===(id||d.active))||null}
function metaPublicStatus(env,d,callback){const c=d.connections.find(c=>c.id===d.active);return {success:true,configured:metaConfigured(env),connected:!!c,expired:!!c&&c.expires_at<=Date.now(),name:c?.name||null,meta_user_id:c?.id||null,connections:d.connections.map(c=>({id:c.id,name:c.name,expired:c.expires_at<=Date.now()})),redirect_uri:callback,legacy_available:!!env.N8N_WEBHOOK_KEY&&!!env.N8N_MONITOR_URL}}
async function metaProof(env,token){const k=await crypto.subtle.importKey('raw',metaBytes(env.META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return metaHex(await crypto.subtle.sign('HMAC',k,metaBytes(token)))}
async function metaGraph(env,token,path,params={}){const url=new URL('https://graph.facebook.com/'+META_VERSION+'/'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));url.searchParams.set('appsecret_proof',await metaProof(env,token));const r=await fetch(url,{headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||d.error)throw Error(d.error?.code===190?'META_RECONNECT':'META_ASSET_ACCESS');return d}
async function metaList(env,token,path,fields){let after,items=[],incomplete=false;for(let n=0;n<10;n++){const d=await metaGraph(env,token,path,{fields,limit:100,...(after?{after}:{})});if(!Array.isArray(d.data))throw Error('META_ASSET_ACCESS');items.push(...d.data);after=d.paging?.next?d.paging?.cursors?.after:null;if(!after)return {items,incomplete};incomplete=true}return {items,incomplete}}
function metaRedirect(url,cookie){return new Response(null,{status:303,headers:{location:url,'cache-control':'no-store','referrer-policy':'no-referrer',...(cookie?{'set-cookie':cookie}:{})}})}
function metaDiagnostic(stage,status,error){console.error(JSON.stringify({event:'meta_oauth_failed',stage,status:Number(status)||0,provider_code:Number(error?.code)||0,provider_subcode:Number(error?.error_subcode)||0}))}
async function handleMetaAuth(request,env,user,u){
let stage='initial';
if(!user)return json({success:false,error:'UNAUTHENTICATED'},401);
const callback=u.origin+'/api/meta/callback',cookieName='__Host-codpilot-meta-state',clear=cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
try{
if(u.pathname==='/api/meta/status'&&request.method==='GET')return json(metaPublicStatus(env,await metaConnections(env,user),callback));
if(u.pathname==='/api/meta/select'&&request.method==='POST'){
if(request.headers.get('origin')!==u.origin)return json({success:false,error:'FORBIDDEN'},403);
const b=await request.json(),d=await metaConnections(env,user);if(typeof b.id!=='string'||!d.connections.some(c=>c.id===b.id))return json({success:false,error:'META_ASSET_ACCESS'},403);
d.active=b.id;await env.BUCKET.put(metaKey(user),await metaSeal(env,user,d));return json(metaPublicStatus(env,d,callback))
}
if(u.pathname==='/api/meta/start'&&request.method==='POST'){
if(request.headers.get('origin')!==u.origin)return json({success:false,error:'FORBIDDEN'},403);
if(!metaConfigured(env))return json({success:false,error:'META_SETUP_REQUIRED'},503);
const b=await request.json();const current=await metaConnections(env,user);const refresh=b.mode==='refresh'?current.active:null;if(b.mode==='refresh'&&!refresh)return json({success:false,error:'META_RECONNECT'},409);if(!refresh&&current.connections.length>=20)return json({success:false,error:'META_CONNECTION_LIMIT'},409);
const state=crypto.randomUUID(),cookie=crypto.randomUUID();await env.BUCKET.put('meta-oauth/'+state,JSON.stringify({user,cookie,created_at:Date.now(),redirect_uri:callback,refresh}));
const auth=new URL('https://www.facebook.com/'+META_VERSION+'/dialog/oauth');auth.searchParams.set('client_id',env.META_APP_ID);auth.searchParams.set('redirect_uri',callback);auth.searchParams.set('state',state);auth.searchParams.set('response_type','code');
if(env.META_LOGIN_CONFIG_ID){auth.searchParams.set('config_id',env.META_LOGIN_CONFIG_ID);auth.searchParams.set('override_default_response_type','true')}else{auth.searchParams.set('scope','ads_read,pages_show_list,pages_read_engagement,instagram_basic,business_management')}
return new Response(JSON.stringify({success:true,url:auth.toString()}),{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':cookieName+'='+cookie+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'}})
}
if(u.pathname==='/api/meta/callback'&&request.method==='GET'){
const state=u.searchParams.get('state')||'';if(!/^[a-f0-9-]{36}$/.test(state))return metaRedirect('/?meta_result=state_error',clear);
const obj=await env.BUCKET?.get('meta-oauth/'+state),s=obj?await obj.json():null;const cookie=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
if(!s||s.user!==user||s.cookie!==cookie||s.redirect_uri!==callback||Date.now()-s.created_at>600000)return metaRedirect('/?meta_result=state_error',clear);
await env.BUCKET.delete('meta-oauth/'+state);
if(u.searchParams.has('error'))return metaRedirect('/?meta_result=cancelled',clear);
const code=u.searchParams.get('code');if(!code||code.length>4096||!metaConfigured(env))return metaRedirect('/?meta_result=failed',clear);
stage='token_exchange';
const form=new URLSearchParams({client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,redirect_uri:callback,code});
const exchange=await fetch('https://graph.facebook.com/'+META_VERSION+'/oauth/access_token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form,redirect:'manual',signal:AbortSignal.timeout(20000)});stage='token_response_'+exchange.status;const d=await exchange.json();if(!exchange.ok||!d.access_token){metaDiagnostic(stage,exchange.status,d.error);throw Error('META_RECONNECT')}
stage='identity';
const me=await metaGraph(env,d.access_token,'me',{fields:'id,name'});if(!/^\d+$/.test(String(me.id)))throw Error('META_RECONNECT');
// Bound local lifetime if the provider does not return one; reconnect rather than assume indefinite access.
const connection={id:String(me.id),name:String(me.name||'Facebook').slice(0,250),token:d.access_token,expires_at:Date.now()+Math.min(Number(d.expires_in)||3600,60*86400)*1000};
stage='save_connection';
const connections=await metaConnections(env,user);if(s.refresh&&connection.id!==s.refresh)return metaRedirect('/?meta_result=identity_mismatch',clear);const i=connections.connections.findIndex(c=>c.id===connection.id);if(i<0){if(connections.connections.length>=20)return metaRedirect('/?meta_result=failed',clear);connections.connections.push(connection)}else connections.connections[i]=connection;connections.active=connection.id;await env.BUCKET.put(metaKey(user),await metaSeal(env,user,connections));return metaRedirect('/?meta_result=connected',clear)
}
return json({success:false,error:'NOT_FOUND'},404)
}catch{if(u.pathname==='/api/meta/callback')metaDiagnostic(stage,0,null);return u.pathname==='/api/meta/callback'?metaRedirect('/?meta_result=failed',clear):json({success:false,error:'META_RECONNECT'},502)}
}
async function personalMetaAssets(request,env,user){
if(request.method!=='POST')return json({success:false,error:'METHOD_NOT_ALLOWED'},405);
if(request.headers.get('origin')!==new URL(request.url).origin)return json({success:false,error:'FORBIDDEN'},403);
if(Number(request.headers.get('content-length')||0)>2048)return json({success:false,error:'INVALID_BRIEF'},400);
let b;try{b=await request.clone().json()}catch{return json({success:false,error:'INVALID_BRIEF'},400)}
let c,d;try{d=await metaConnections(env,user);if(b.connection_id!==undefined&&(typeof b.connection_id!=='string'||!/^\d+$/.test(b.connection_id)))return json({success:false,error:'INVALID_BRIEF'},400);c=d.connections.find(c=>c.id===(b.connection_id||d.active))}catch{return json({success:false,error:'META_RECONNECT'},401)}
if(!c)return d.connections.length||b.connection_id?json({success:false,error:'META_ASSET_ACCESS'},403):null;
if(c.expires_at<=Date.now())return json({success:false,error:'META_RECONNECT'},401);
try{const op=b.operation,account=String(b.account||'').replace(/^act_/,'');if(!['accounts','pages','pixels','instagram'].includes(op)||op!=='accounts'&&!/^\d+$/.test(account)||op==='instagram'&&!/^\d+$/.test(String(b.page||'')))return json({success:false,error:'INVALID_BRIEF'},400);
let result;if(op==='accounts')result=await metaList(env,c.token,'me/adaccounts','id,name,currency,account_status,timezone_name');
else{
const accounts=await metaList(env,c.token,'me/adaccounts','id');if(!accounts.items.some(x=>String(x.id).replace(/^act_/,'')===account))return json({success:false,error:'META_ASSET_ACCESS'},403);
if(op==='pixels')result=await metaList(env,c.token,'act_'+account+'/adspixels','id,name');
else if(op==='pages')result=await metaList(env,c.token,'me/accounts','id,name');
else{const pages=await metaList(env,c.token,'me/accounts','id');if(!pages.items.some(x=>String(x.id)===String(b.page)))return json({success:false,error:'META_ASSET_ACCESS'},403);const d=await metaGraph(env,c.token,String(b.page),{fields:'instagram_business_account{id,username,name}'});const ig=d.instagram_business_account;result={items:ig?[{id:ig.id,name:ig.username?'@'+ig.username:ig.name}]:[],incomplete:false}}
}
return json({success:true,read_only:true,source:'facebook_login',connection_id:c.id,operation:op,account_id:account||null,incomplete:result.incomplete,items:result.items.filter(x=>/^(act_)?\d+$/.test(String(x.id))).map(x=>({id:String(x.id),name:String(x.name||x.id).slice(0,250),currency:x.currency||null,account_status:x.account_status??null,timezone:x.timezone_name||null}))})
}catch(e){return json({success:false,error:e.message==='META_RECONNECT'?'META_RECONNECT':'META_ASSET_ACCESS'},502)}
}
