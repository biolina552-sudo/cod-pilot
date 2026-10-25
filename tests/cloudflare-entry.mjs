import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';

// Run after `npm run build`: the wrapper imports dist/server/index.js.
const team='team.cloudflareaccess.com',aud='test-aud';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
let jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'k1'};
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{assert.equal(String(url),'https://'+team+'/cdn-cgi/access/certs');return new Response(JSON.stringify({keys:[jwk]}))};
const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
async function token(claims,key=pair.privateKey,kid='k1'){
  const body=b64({alg:'RS256',kid})+'.'+b64(claims);
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(body));
  return body+'.'+Buffer.from(sig).toString('base64url');
}
const {default:entry}=await import('../cloudflare/entry.js');
const env={ACCESS_TEAM_DOMAIN:team,ACCESS_AUD:aud};
const status=async headers=>{const r=await entry.fetch(new Request('https://cod.example/api/voice/status',{headers}),env,{});return {code:r.status,body:await r.json()}};
const now=Math.floor(Date.now()/1000),good={aud:[aud],iss:'https://'+team,exp:now+600,email:'Owner@Example.com'};

let r=await status({'oai-authenticated-user-id':'spoofed','oai-authenticated-user-email':'spoof@x'});
assert.equal(r.code,401,'client-sent identity headers must be ignored');
r=await status({'cf-access-jwt-assertion':await token(good)});
assert.equal(r.code,200);assert.equal(r.body.identity.id,'owner@example.com');
r=await status({'cf-access-jwt-assertion':await token(good),'oai-authenticated-user-id':'spoofed'});
assert.equal(r.body.identity.id,'owner@example.com','verified identity wins over spoofed header');
for(const bad of [{...good,aud:['other']},{...good,iss:'https://evil'},{...good,exp:now-5},{...good,email:undefined}])
  assert.equal((await status({'cf-access-jwt-assertion':await token(bad)})).code,401);
const other=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign']);
assert.equal((await status({'cf-access-jwt-assertion':await token(good,other.privateKey)})).code,401,'wrong signature');
assert.equal((await status({'cf-access-jwt-assertion':'garbage'})).code,401);
// Key rotation: an unknown kid triggers one refetch of the certs.
const rotated=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
jwk={...await crypto.subtle.exportKey('jwk',rotated.publicKey),kid:'k2'};
const realNow=Date.now;Date.now=()=>realNow()+31000;
r=await status({'cf-access-jwt-assertion':await token(good,rotated.privateKey,'k2')});
Date.now=realNow;
assert.equal(r.code,200,'rotated signing key is picked up');
// DEV_USER_EMAIL works only on localhost and only without Access configured.
const dev=async(url,e)=>(await entry.fetch(new Request(url+'/api/voice/status'),e,{})).status;
assert.equal(await dev('http://localhost:8787',{DEV_USER_EMAIL:'me@x'}),200);
assert.equal(await dev('https://cod.example',{DEV_USER_EMAIL:'me@x'}),401);
assert.equal(await dev('http://localhost:8787',{...env,DEV_USER_EMAIL:'me@x'}),401);
globalThis.fetch=realFetch;
console.log('PASS Cloudflare Access identity mapping, spoof stripping, JWT aud/iss/exp/signature checks, dev-only fallback');
