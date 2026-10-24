import app from '../dist/server/index.js';

// The app was written for ChatGPT Sites, which injects the signed-in user as
// oai-authenticated-user-* headers. On Cloudflare, Cloudflare Access signs the
// user in instead; this wrapper verifies the Access JWT and maps it onto the
// same headers so the app code stays unchanged. Client-sent copies are always
// stripped so they cannot be spoofed.
const IDENTITY_HEADERS=['oai-authenticated-user-id','oai-authenticated-user-email'];
let certCache={url:'',at:0,keys:null};

function b64url(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}

async function accessKeys(team){
  const url='https://'+team+'/cdn-cgi/access/certs';
  if(certCache.url===url&&certCache.keys&&Date.now()-certCache.at<3600000)return certCache.keys;
  const r=await fetch(url);if(!r.ok)throw Error('ACCESS_CERTS_UNAVAILABLE');
  const {keys}=await r.json();
  certCache={url,at:Date.now(),keys:await Promise.all(keys.filter(k=>k.kty==='RSA').map(async k=>({kid:k.kid,key:await crypto.subtle.importKey('jwk',k,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])})))};
  return certCache.keys;
}

async function verifyAccess(token,env){
  const [h,p,sig]=String(token||'').split('.');if(!h||!p||!sig)return null;
  const header=JSON.parse(new TextDecoder().decode(b64url(h)));if(header.alg!=='RS256')return null;
  const keys=await accessKeys(env.ACCESS_TEAM_DOMAIN),k=keys.find(k=>k.kid===header.kid);if(!k)return null;
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',k.key,b64url(sig),new TextEncoder().encode(h+'.'+p)))return null;
  const claims=JSON.parse(new TextDecoder().decode(b64url(p))),now=Date.now()/1000;
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(!aud.includes(env.ACCESS_AUD)||claims.iss!=='https://'+env.ACCESS_TEAM_DOMAIN||!(claims.exp>now)||(claims.nbf&&claims.nbf>now+60)||!claims.email)return null;
  return String(claims.email).toLowerCase();
}

async function identify(request,env){
  if(env.ACCESS_TEAM_DOMAIN&&env.ACCESS_AUD){
    try{return await verifyAccess(request.headers.get('cf-access-jwt-assertion'),env)}catch{return null}
  }
  // Local `wrangler dev` only: never set DEV_USER_EMAIL on a deployed Worker.
  const host=new URL(request.url).hostname;
  if(env.DEV_USER_EMAIL&&(host==='localhost'||host==='127.0.0.1'))return env.DEV_USER_EMAIL.toLowerCase();
  return null;
}

export default {
  async fetch(request,env,ctx){
    const headers=new Headers(request.headers);
    for(const name of IDENTITY_HEADERS)headers.delete(name);
    const email=await identify(request,env);
    if(email){headers.set('oai-authenticated-user-id',email);headers.set('oai-authenticated-user-email',email)}
    return app.fetch(new Request(request,{headers}),env,ctx);
  }
};
