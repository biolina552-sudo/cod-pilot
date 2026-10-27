import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Run after `npm run build`. Covers the private landing API (inside the built
// app) and the public shop worker, both against an in-memory R2 bucket.
function bucket(){
  const m=new Map();
  const obj=(key,v)=>v&&{key,size:v.bytes.length,httpMetadata:v.http,customMetadata:v.meta,body:v.bytes,
    async json(){return JSON.parse(new TextDecoder().decode(v.bytes))},async text(){return new TextDecoder().decode(v.bytes)},async arrayBuffer(){return v.bytes.slice().buffer}};
  return {m,
    async put(key,data,o={}){const bytes=typeof data==='string'?new TextEncoder().encode(data):new Uint8Array(data);m.set(key,{bytes,http:o.httpMetadata||{},meta:o.customMetadata||{}})},
    async get(key){return obj(key,m.get(key))||null},
    async delete(key){m.delete(key)},
    async list({prefix='',limit=1000}={}){return {objects:[...m.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(k=>obj(k,m.get(k))),truncated:false}}
  };
}
const env={BUCKET:bucket(),SHOP_ORIGIN:'https://shop.test',GEMINI_API_KEY:'test-gemini-key',VOICE_OWNER_ID:'owner@test.com'};
const {default:app}=await import('../dist/server/index.js');
const {default:shop}=await import('../shop/entry.js');
const O='https://app.test';
const call=(path,{user='owner@test.com',body,raw,origin=O,method}={})=>app.fetch(new Request(O+path,{method:method||(body!==undefined||raw?'POST':'GET'),headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(origin?{origin}:{}),'content-type':raw?'image/jpeg':'application/json'},body:raw||(body!==undefined?JSON.stringify(body):undefined)}),env);
const shopGet=(p,init)=>shop.fetch(new Request('https://shop.test'+p,init),env);

// Auth and CSRF.
assert.equal((await call('/api/landing',{user:null})).status,401);
assert.equal((await call('/api/landing/save',{body:{},origin:'https://evil.test'})).status,403);

// Image upload checks real bytes, not the declared type.
const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8]);
assert.equal((await call('/api/landing/image',{raw:new Uint8Array([60,115,99,114,105,112,116,62])})).status,400);
const up=await (await call('/api/landing/image',{raw:jpeg})).json();
assert.match(up.id,/^[a-f0-9]{24}\.jpg$/);
assert.equal(env.BUCKET.m.get('public-images/'+up.id).meta.owner,'owner@test.com');

// Save validates and publishes.
const draft={slug:'smart-watch',product:'ساعة <script>alert(1)</script>',lang:'ar',currency:'MAD',offers:[{qty:1,price:199},{qty:2,price:349,label:'2 حبات'}],old_price:299,images:[up.id,'../../etc'],problems:['مشكل'],solution:'حل',bullets:['ميزة'],features:[{icon:'⚡',title:'سريع',text:'نص'}],faq:[{q:'سؤال؟',a:'جواب'}],meta_pixel:'123456789',tiktok_pixel:'cabc123def45'};
for(const [patch,err] of [[{slug:'A B'},'INVALID_SLUG'],[{slug:'img'},'INVALID_SLUG'],[{offers:[],price:''},'INVALID_PRICE'],[{meta_pixel:'abc'},'INVALID_META_PIXEL']]){
  const r=await call('/api/landing/save',{body:{...draft,...patch}});assert.equal(r.status,400);assert.equal((await r.json()).error,err);
}
let r=await call('/api/landing/save',{body:draft});assert.equal(r.status,200);
const saved=await r.json();assert.equal(saved.url,'https://shop.test/smart-watch');assert.deepEqual(saved.page.images,[up.id]);assert.equal(saved.page.tiktok_pixel,'CABC123DEF45');
assert.equal((await env.BUCKET.get('public-pages/smart-watch.json').then(o=>o.json())).owner,'owner@test.com');

// Another user cannot take the slug, sees none of the owner's pages, and gets no AI.
r=await call('/api/landing/save',{user:'other@test.com',body:draft});assert.equal(r.status,409);
assert.equal((await (await call('/api/landing',{user:'other@test.com'})).json()).pages.length,0);
assert.equal((await call('/api/landing/ai-copy',{user:'other@test.com',body:{images:[up.id]}})).status,503);
const list=await (await call('/api/landing')).json();assert.equal(list.pages.length,1);assert.equal(list.ai,true);

// Public page renders escaped text, pixels, and the form.
r=await shopGet('/smart-watch');assert.equal(r.status,200);let page=await r.text();
assert.ok(!page.includes('<script>alert(1)'));assert.ok(page.includes('&lt;script&gt;'));
assert.ok(page.includes("fbq('init','123456789')")&&page.includes("ttq.load('CABC123DEF45')"));
assert.ok(page.includes('action="/smart-watch/order"')&&page.includes('349 درهم'));
assert.equal((await shopGet('/nope')).status,404);
assert.equal((await shopGet('/img/'+up.id)).headers.get('content-type'),'image/jpeg');
assert.equal((await shopGet('/img/..%2Fpublic-pages%2Fsmart-watch.json')).status,404);

// Orders: invalid shows errors, honeypot stores nothing, valid is stored for the owner.
const order=f=>shopGet('/smart-watch/order',{method:'POST',body:new URLSearchParams(f)});
r=await order({name:'A',phone:'12',city:'',offer:'0'});assert.equal(r.status,400);assert.ok((await r.text()).includes('رقم هاتف صحيح'));
r=await order({name:'Bot',phone:'0612345678',city:'Rabat',offer:'0',website:'spam'});assert.equal(r.status,303);
assert.equal(r.headers.get('location'),'https://shop.test/smart-watch/thanks');
assert.ok(!(await (await shopGet('/smart-watch/thanks?q=0')).text()).includes("'Purchase'"));
assert.equal([...env.BUCKET.m.keys()].filter(k=>k.startsWith('orders/')).length,0);
r=await order({name:'سعيد',phone:'06 12-34 56 78',city:'الدار البيضاء',offer:'1'});assert.equal(r.status,303);
const loc=r.headers.get('location');assert.match(loc,/^https:\/\/shop\.test\/smart-watch\/thanks\?o=\d{13}-[a-f0-9]{8}$/);
const thanks=await (await shopGet(loc.slice('https://shop.test'.length))).text();
assert.ok(thanks.includes('"value":349')&&thanks.includes('eventID:"'+loc.split('o=')[1]+'"')&&thanks.includes('event_id:'));
assert.ok(!(await (await shopGet('/smart-watch/thanks?o=9999999999999-deadbeef')).text()).includes("'Purchase'"));
// A body without Content-Length is still capped.
const big=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('name='+'x'.repeat(9000)));c.close()}});
assert.equal((await shopGet('/smart-watch/order',{method:'POST',body:big,duplex:'half'})).status,413);
let orders=await (await call('/api/orders')).json();assert.equal(orders.items.length,1);
assert.deepEqual([orders.items[0].phone,orders.items[0].offer.price,orders.items[0].status],['0612345678',349,'new']);
assert.equal((await (await call('/api/orders',{user:'other@test.com'})).json()).items.length,0);
r=await call('/api/orders/status',{body:{id:orders.items[0].id,status:'confirmed'}});assert.equal((await r.json()).order.status,'confirmed');
assert.equal((await call('/api/orders/status',{body:{id:orders.items[0].id,status:'paid'}})).status,400);
assert.equal((await call('/api/orders/status',{user:'other@test.com',body:{id:orders.items[0].id,status:'cancelled'}})).status,404);

// Captions over AI photos: only for this page's scene images, escaped.
const scenePage=(await (await call('/api/landing/save',{body:{...draft,slug:'caption-test',scene_images:[up.id],scene_captions:{[up.id]:'سخونة <b>فـ 30 دقيقة</b>','ffffffffffffffffffffffff.jpg':'x'}}})).json()).page;
assert.deepEqual(Object.keys(scenePage.scene_captions),[up.id]);
const capHtml=await (await shopGet('/caption-test')).text();
assert.ok(capHtml.includes('<figure class="poster"><h3>سخونة &lt;b&gt;فـ 30 دقيقة&lt;/b&gt;</h3><img'));
assert.ok(capHtml.includes('class="top"')&&capHtml.includes('class="offer"'));
// Title + ribbon line, and niche templates (unknown niche falls back to general).
const nichePage=(await (await call('/api/landing/save',{body:{...draft,id:scenePage.id,slug:'caption-test',niche:'beauty',color:'',scene_images:[up.id],scene_captions:{[up.id]:{t:'بشرة نقية',s:'فـ 7 أيام <i>'}}}})).json()).page;
assert.equal(nichePage.niche,'beauty');assert.equal(nichePage.color,'#b0195a');
const nicheHtml=await (await shopGet('/caption-test')).text();
assert.ok(nicheHtml.includes('<h3>بشرة نقية</h3><p class="rb">فـ 7 أيام &lt;i&gt;</p>'));
assert.ok(nicheHtml.includes('--a:#f06292')&&nicheHtml.includes('✨'));
assert.equal((await (await call('/api/landing/save',{body:{...draft,id:scenePage.id,slug:'caption-test',niche:'__proto__'}})).json()).page.niche,'general');
const listed=await (await call('/api/landing')).json();assert.ok(listed.niches.some(n=>n.id==='kitchen'&&n.color));
await call('/api/landing/save',{body:{...draft,id:scenePage.id,slug:'caption-test',layout:'classic',scene_images:[up.id],scene_captions:{[up.id]:'سخونة'}}});
assert.ok((await (await shopGet('/caption-test')).text()).includes('<figcaption><span>سخونة</span></figcaption>'));
assert.equal((await shopGet('/img/'+up.id)).headers.get('access-control-allow-origin'),'*');
await call('/api/landing/delete',{body:{id:scenePage.id}});

// Download for other sites: images inline, form posts to the shop, Cairo font.
r=await call('/api/landing/export?id='+saved.page.id);assert.equal(r.status,200);
assert.equal(r.headers.get('content-disposition'),'attachment; filename="smart-watch.html"');
const exported=await r.text();
assert.ok(exported.includes('src="data:image/jpeg;base64,')&&exported.includes('action="https://shop.test/smart-watch/order"')&&exported.includes('family=Cairo'));
assert.equal((await call('/api/landing/export?id='+saved.page.id,{user:'other@test.com'})).status,404);

// Unpublish hides the page; slug change moves it; delete removes it.
await call('/api/landing/save',{body:{...draft,id:saved.page.id,published:false}});assert.equal((await shopGet('/smart-watch')).status,404);
await call('/api/landing/save',{body:{...draft,id:saved.page.id,slug:'watch-pro'}});
assert.equal((await shopGet('/watch-pro')).status,200);assert.ok(!env.BUCKET.m.has('public-pages/smart-watch.json'));
await call('/api/landing/delete',{body:{id:saved.page.id}});assert.equal((await shopGet('/watch-pro')).status,404);
// A's rename must not unpublish B's page that took A's old (unpublished) slug.
const a=(await (await call('/api/landing/save',{body:{...draft,slug:'shared-slug',published:false}})).json()).page;
assert.equal((await call('/api/landing/save',{user:'other@test.com',body:{...draft,slug:'shared-slug',images:[]}})).status,200);
await call('/api/landing/save',{body:{...draft,id:a.id,slug:'a-new-slug',published:false}});
assert.equal((await shopGet('/shared-slug')).status,200);
// The same user cannot publish two pages on one slug.
assert.equal((await call('/api/landing/save',{body:{...draft,slug:'a-only'}})).status,200);
assert.equal((await call('/api/landing/save',{body:{...draft,slug:'a-only'}})).status,409);

// AI copy and image call Gemini with the user's own photos only.
const calls=[];const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opt)=>{
  // The model list says which image models the key has; unknown names are skipped.
  if(String(url).includes('/models?'))return new Response(JSON.stringify({models:[{name:'models/gemini-9-flash-image-preview',supportedGenerationMethods:['generateContent']},{name:'models/imagen-5',supportedGenerationMethods:['predict']},{name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']}]}));
  calls.push({url:String(url),body:JSON.parse(opt.body),headers:opt.headers});
  if(String(url).includes('image'))return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.from([0x89,0x50,0x4e,0x47,1,2,3]).toString('base64')}}]}}]}));
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({product:'ساعة',slug:'Montre Smart!!',headline:'h',subheadline:'s',problem_title:'p',problems:['a'],solution:'b',bullets:['c'],features:[],description:'d',faq:[],cta:'اطلب',color:'#123456',image_prompts:['x','y','z','w']})}]}}]}));};
const otherImg=(await (await call('/api/landing/image',{user:'other@test.com',raw:jpeg})).json()).id;
assert.equal((await call('/api/landing/ai-copy',{body:{images:[otherImg]}})).status,400);
r=await call('/api/landing/ai-copy',{body:{images:[up.id],lang:'ar'}});const copy=(await r.json()).copy;
assert.equal(copy.slug,'montre-smart');assert.equal(copy.image_prompts.length,4);
assert.ok(calls[0].body.contents[0].parts[0].inline_data.data);assert.ok(/Darija/.test(calls[0].body.contents[0].parts.at(-1).text));
assert.equal(calls[0].headers['x-goog-api-key'],'test-gemini-key');
r=await call('/api/landing/ai-image',{body:{images:[up.id],prompt:'on a table'}});const gen=await r.json();
assert.match(gen.id,/\.png$/);assert.deepEqual(calls[1].body.generationConfig.responseModalities,['IMAGE']);
assert.ok(calls[1].url.includes('/gemini-9-flash-image-preview:'));
// An answer with no image is skipped: the next request shape gets its turn.
{const keep=globalThis.fetch;let n=0;globalThis.fetch=async(url,opt)=>String(url).includes('/models?')||n++?keep(url,opt):new Response('{"candidates":[]}');
r=await call('/api/landing/ai-image',{body:{images:[up.id],prompt:'x'}});assert.match((await r.json()).id,/\.png$/);globalThis.fetch=keep}
{const keep=globalThis.fetch;globalThis.fetch=async(url,opt)=>String(url).includes('/models?')?keep(url,opt):new Response('{"error":{"message":"Quota exceeded, limit: 0, model: x free_tier"}}',{status:429});
r=await call('/api/landing/ai-image',{body:{images:[up.id],prompt:'x'}});assert.equal((await r.json()).error,'AI_IMAGE_NEEDS_BILLING');globalThis.fetch=keep}
// A model that fails with a plain 400 is skipped for the next one; the reason reaches the owner.
{const keep=globalThis.fetch,seen=[];globalThis.fetch=async(url,opt)=>{seen.push(String(url));return String(url).includes('gemini-3.6-flash:')?new Response('{"error":{"message":"Invalid value at thinking_level"}}',{status:400}):keep(url,opt)};
r=await call('/api/landing/ai-copy',{body:{images:[up.id],lang:'ar'}});assert.equal(r.status,200);assert.ok(seen.some(u=>u.includes('gemini-3.8-flash:')));
globalThis.fetch=async()=>new Response('{"error":{"message":"bad request x"}}',{status:400});
const fail=await (await call('/api/landing/ai-copy',{body:{images:[up.id]}})).json();assert.equal(fail.error,'GENERATION_FAILED');assert.match(fail.detail,/400: .*bad request x/);
globalThis.fetch=keep}
globalThis.fetch=async()=>new Response('{"error":{"message":"API_KEY_INVALID test-gemini-key"}}',{status:400});
r=await call('/api/landing/ai-copy',{body:{images:[up.id]}});assert.equal((await r.json()).error,'GEMINI_AUTH_FAILED');
globalThis.fetch=async()=>{throw new DOMException('timed out','TimeoutError')};
r=await call('/api/landing/ai-copy',{body:{images:[up.id]}});assert.equal((await r.json()).error,'AI_TIMEOUT');
globalThis.fetch=realFetch;

// Editor page script parses.
const html=readFileSync('pages.html','utf8');new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
assert.equal((await call('/pages')).status,200);

console.log('PASS landing pages: auth/CSRF, image sniffing, validation, slug ownership, escaping, pixels, COD orders, honeypot, HTML export, photo captions, niche templates, isolation, status, publish/rename/delete, Gemini copy+image, editor syntax');
