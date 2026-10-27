// Private API for landing pages and their orders (/api/landing/*, /api/orders*).
// Public pages are served by the separate shop worker (shop/entry.js).
const LP_IMAGE_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const LP_IMAGE_LIMIT=5*1024*1024;
const LP_TEXT_MODELS=['gemini-3.6-flash','gemini-3.8-flash','gemini-2.5-flash'],LP_IMAGE_MODELS=['gemini-3.1-flash-image','gemini-3.1-flash-image-preview','gemini-2.5-flash-image','gemini-nano-banana-2.1'];
const lpHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,'0')).join('');
function lpB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s)}
function lpSniff(b){
  if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
  if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)return 'image/png';
  if(b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50)return 'image/webp';
  return null;
}
async function lpPutImage(env,user,bytes,type){
  const id=lpHex(12)+'.'+LP_IMAGE_TYPES[type];
  await env.BUCKET.put('public-images/'+id,bytes,{httpMetadata:{contentType:type},customMetadata:{owner:user}});
  return id;
}
// Loads the user's own uploaded images (bytes + type); null if any is missing or not theirs.
async function lpLoadImages(env,user,ids){
  if(!Array.isArray(ids)||!ids.length||ids.length>4||!ids.every(i=>typeof i==='string'&&LP_IMAGE_RE.test(i)))return null;
  const out=[];
  for(const id of ids){
    const o=await env.BUCKET.get('public-images/'+id);
    if(!o||o.customMetadata?.owner!==user)return null;
    out.push({type:o.httpMetadata?.contentType||'image/jpeg',bytes:new Uint8Array(await o.arrayBuffer())});
  }
  return out;
}
const lpParts=imgs=>imgs.map(i=>({inline_data:{mime_type:i.type,data:lpB64(i.bytes)}}));
async function lpImageParts(env,user,ids){const imgs=await lpLoadImages(env,user,ids);return imgs&&lpParts(imgs)}

// Free image generation on Cloudflare Workers AI (daily free allowance). FLUX.2 klein
// takes the product photos as references (each under 512x512) so the product stays the same.
const LP_CF_IMAGE_MODEL='@cf/black-forest-labs/flux-2-klein-9b';
async function lpCfImage(env,refs,prompt,aspect){
  const form=new FormData();
  form.append('prompt',prompt);form.append('width','1024');form.append('height',aspect==='4:5'?'1280':'1024');
  refs.forEach((r,i)=>form.append('input_image_'+i,new Blob([r.bytes],{type:r.type}),'ref'+i));
  const req=new Response(form);
  let out;
  try{out=await env.AI.run(LP_CF_IMAGE_MODEL,{multipart:{body:req.body,contentType:req.headers.get('content-type')}})}
  catch(e){
    const msg=String(e?.message||e).slice(0,200);console.error('LANDING_CF',msg);
    throw Object.assign(Error('cf'),{code:/4006|daily free allocation|neurons/i.test(msg)?'CF_DAILY_LIMIT':'CF_FAILED',detail:'cloudflare: '+msg});
  }
  const bytes=out?.image?Uint8Array.from(atob(out.image),c=>c.charCodeAt(0)):null;
  const type=bytes&&lpSniff(bytes);
  if(!type)throw Object.assign(Error('cf'),{code:'CF_FAILED',detail:'cloudflare: no image in the answer'});
  return {bytes,type};
}
// Gemini is often briefly overloaded: wait and try again before giving up.
async function lpGeminiRetry(env,model,body){
  for(let i=0;;i++){try{return await lpGemini(env,model,body)}catch(e){if(e.code!=='AI_BUSY'||i>=2)throw e;await new Promise(r=>setTimeout(r,2000*(i+1)))}}
}
// Tries each model (and each request variant) in turn; errors about the key, quota or content stop at once.
// usable(parts) can reject an answer that came back empty (e.g. no image) so the next try runs.
async function lpGeminiFirst(env,models,variants,usable=()=>true){
  let last;
  for(const model of models)for(const body of variants(model)){
    try{const out=await lpGeminiRetry(env,model,body);if(usable(out))return out;last=Object.assign(Error('empty'),{code:'AI_NO_IMAGE',detail:model+': no image in the answer'})}
    catch(e){last=e;if(!['AI_MODEL_UNAVAILABLE','AI_BUSY','GENERATION_FAILED'].includes(e.code))throw e}
  }
  throw last;
}
async function lpGemini(env,model,body){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY.trim()},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(110000)});
  if(!r.ok){
    const msg=(await r.text()).split(env.GEMINI_API_KEY.trim()).join('[REDACTED]').slice(0,300);
    console.error('LANDING_AI',model,r.status,msg);
    const busy=[500,502,503,504].includes(r.status)||/overloaded|UNAVAILABLE/.test(msg);
    // detail is shown to the app owner only (AI routes are owner-only) so a failure can be diagnosed.
    throw Object.assign(Error('provider'),{status:r.status,detail:model+' '+r.status+': '+msg.replace(/\s+/g,' ').slice(0,200),code:busy?'AI_BUSY':r.status===429?(/limit: 0\b|free_tier|exceeded your current quota|billing/i.test(msg)?'GEMINI_NEEDS_BILLING':'GEMINI_RATE_LIMITED'):r.status===400&&/not supported|does not support|response modalit/i.test(msg)?'AI_MODEL_UNAVAILABLE':[401,403].includes(r.status)||/API_KEY/.test(msg)?'GEMINI_AUTH_FAILED':r.status===404?'AI_MODEL_UNAVAILABLE':'GENERATION_FAILED'});
  }
  const d=await r.json();
  if(d.promptFeedback?.blockReason)throw Object.assign(Error('blocked'),{code:'AI_CONTENT_BLOCKED'});
  return d.candidates?.[0]?.content?.parts||[];
}

// Image model names change often: ask Gemini which image models this key can use,
// preferring the known names, and remember the answer while the worker is warm.
let lpImageModelCache=null;
async function lpImageModels(env){
  if(lpImageModelCache)return lpImageModelCache;
  let found=[];
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':env.GEMINI_API_KEY.trim()},signal:AbortSignal.timeout(10000)});
    if(r.ok)found=((await r.json()).models||[]).filter(m=>/image/i.test(m.name)&&!/imagen/i.test(m.name)&&(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,''));
  }catch{}
  const rank=m=>{const i=LP_IMAGE_MODELS.indexOf(m);return i<0?LP_IMAGE_MODELS.length:i};
  found.sort((a,b)=>rank(a)-rank(b)||b.localeCompare(a));
  const list=[...new Set([...found,...LP_IMAGE_MODELS])];
  if(found.length)lpImageModelCache=list;
  return list;
}

const LP_LANG_NAMES={ar:'Moroccan Darija written in Arabic script (natural, the way Moroccans talk; not formal Modern Standard Arabic)',fr:'French',en:'English'};
const LP_COPY_SCHEMA={type:'object',properties:{
  product:{type:'string'},slug:{type:'string'},headline:{type:'string'},subheadline:{type:'string'},
  problem_title:{type:'string'},problems:{type:'array',items:{type:'string'}},solution:{type:'string'},
  results_title:{type:'string'},results:{type:'array',items:{type:'string'}},
  before_after:{type:'array',items:{type:'object',properties:{before:{type:'string'},after:{type:'string'}},required:['before','after']}},
  bullets:{type:'array',items:{type:'string'}},
  features:{type:'array',items:{type:'object',properties:{icon:{type:'string'},title:{type:'string'},text:{type:'string'}},required:['icon','title','text']}},
  description:{type:'string'},
  faq:{type:'array',items:{type:'object',properties:{q:{type:'string'},a:{type:'string'}},required:['q','a']}},
  cta:{type:'string'},color:{type:'string'},image_prompts:{type:'array',items:{type:'string'}},image_captions:{type:'array',items:{type:'string'}},image_subcaptions:{type:'array',items:{type:'string'}}
},required:['product','slug','headline','subheadline','problem_title','problems','solution','results_title','results','before_after','bullets','features','description','faq','cta','color','image_prompts','image_captions','image_subcaptions']};

function lpCopyPrompt(lang,product,notes,niche){
  const hint=Object.hasOwn(LP_NICHES,niche)?LP_NICHES[niche].hint:"";
  return `You are a senior direct-response copywriter who builds high-converting cash-on-delivery landing pages for Morocco and the Gulf.
Look carefully at the product photos${product?` (the seller calls it: "${product}")`:''}.${notes?`\nSeller notes: ${notes}`:''}
${hint?`Niche: ${hint}\n`:''}Write the whole landing page in ${LP_LANG_NAMES[lang]}.

The customer does not buy a product, they buy a SOLUTION: the result and the better life after using it.
Structure it around the customer's PROBLEM and the RESULT they get (problem → agitate → solution → result):
- headline: name the painful everyday problem or the desired result in one punchy line (max 12 words).
- subheadline: how this product solves it, in one sentence.
- problem_title + problems: 3-4 short, concrete, relatable frustrations the buyer lives with today.
- solution: 1-2 sentences presenting the product as the simple fix.
- results_title + results: 4 short lines (4-9 words) on what changes in the customer's life after using it, each a concrete result they feel or see, talking to them as "you" (e.g. "غادي تربح نص ساعة كل صباح").
- before_after: exactly 3 pairs, each "before" a frustration from today and "after" the same moment once the product solves it, 2-6 words each (e.g. before "رجلين ناشفين ومشققين", after "رجلين ناعمين فـ 5 دقايق").
- bullets: 4-6 short benefits (result first, not specs).
- features: exactly 4 items, each an emoji icon, a 2-4 word title and one short sentence.
- description: 2 short paragraphs on how it is used and why it is worth it.
- faq: 4 questions a hesitant buyer asks (how to use, who it is for, delivery time, paying cash on delivery) with short reassuring answers.
- cta: a 2-4 word order button.
- product: a short product name. slug: 2-4 lowercase latin words joined by "-" for the URL.
- color: one hex brand color that fits the product photos and stays readable with white text.
- image_prompts: exactly 8 English descriptions of different, realistic photo scenes. Each one must SHOW THE RESULT the customer gets (the problem visibly solved, the relief, the visible improvement), with the product present, in this order:
  (1) the product in use with the problem visibly solved right now; (2) a happy, relieved customer enjoying the result in a modern Moroccan home or setting;
  (3) a split before/after composition: left side the frustrating "before" situation, right side the same situation solved with the product; (4) a close-up of the visible result (clean, smooth, organized, comfortable... whatever fits) with the product;
  (5) hands showing how easy it is to use, step by step; (6) the result in a second everyday place (work, car, outdoors, travel... whatever fits);
  (7) the customer sharing the result with family or friends, smiling; (8) a clean studio hero shot of the product on a soft colored background matching the brand color.
- image_captions: exactly 8 poster titles, one per image_prompt in the same order, written in the page language. Each is 2-5 words, printed huge and bold above the photo. Each one states the RESULT the customer gets, not a product spec: the first names the problem solved or the desired result (e.g. "بلا ما تشعل الفران..."), the others are punchy results (e.g. "ماكلة سخونة فـ 30 دقيقة", "رجلين ناعمين فـ 5 دقايق"), never "powerful device" style claims. No final punctuation except an optional "...".
- image_subcaptions: exactly 8 short lines (3-7 words), one per title, printed in a colored ribbon under it, completing or explaining the title (e.g. "كيبقى سخون حتى توصل للخدمة").

Rules: short sentences, simple words, no hashtags. Do NOT mention prices, discounts or stock. Do NOT invent reviews, ratings, numbers of customers, certifications, guarantees, medical or health claims, or anything you cannot see in the photos.`;
}

async function handleLanding(request,env,user,u){
  if(!user)return json({success:false,error:'UNAUTHENTICATED'},401);
  if(!env.BUCKET)return json({success:false,error:'STORAGE_UNAVAILABLE'},503);
  if(request.method!=='GET'&&request.headers.get('origin')!==u.origin)return json({success:false,error:'FORBIDDEN'},403);
  const mine='landing/'+encodeURIComponent(user)+'/',orders='orders/'+encodeURIComponent(user)+'/';
  const shop=(env.SHOP_ORIGIN||'').replace(/\/$/,'');
  const body=async(limit=65536)=>{if(Number(request.headers.get('content-length')||0)>limit)return null;try{return await request.json()}catch{return null}};
  try{
    if(u.pathname==='/api/landing'&&request.method==='GET'){
      const list=await env.BUCKET.list({prefix:mine,limit:100});
      const pages=(await Promise.all(list.objects.map(o=>env.BUCKET.get(o.key).then(r=>r&&r.json())))).filter(Boolean);
      pages.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
      return json({success:true,shop,ai:!!env.GEMINI_API_KEY&&user===env.VOICE_OWNER_ID,pages,niches:Object.entries(LP_NICHES).map(([id,n])=>({id,name:n.name,color:n.c}))});
    }
    if(u.pathname==='/api/landing/save'&&request.method==='POST'){
      const b=await body();if(!b)return json({success:false,error:'INVALID_PAGE'},400);
      const {page,error}=lpCleanPage(b);if(error)return json({success:false,error},400);
      const id=typeof b.id==='string'&&/^[a-f0-9]{16}$/.test(b.id)?b.id:lpHex(8);
      const prevObj=await env.BUCKET.get(mine+id+'.json'),prev=prevObj&&await prevObj.json();
      const takenObj=await env.BUCKET.get('public-pages/'+page.slug+'.json'),taken=takenObj&&await takenObj.json();
      if(taken&&(taken.owner!==user||taken.id!==id))return json({success:false,error:'SLUG_TAKEN'},409);
      const saved={...page,id,created_at:prev?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
      await env.BUCKET.put(mine+id+'.json',JSON.stringify(saved),{httpMetadata:{contentType:'application/json'}});
      if(prev&&prev.slug!==page.slug){
        // The old slug may have been taken by someone else since: only remove our own copy.
        const old=await env.BUCKET.get('public-pages/'+prev.slug+'.json');
        if(old){const op=await old.json();if(op.owner===user&&op.id===id)await env.BUCKET.delete('public-pages/'+prev.slug+'.json')}
      }
      if(page.published)await env.BUCKET.put('public-pages/'+page.slug+'.json',JSON.stringify({...saved,owner:user}),{httpMetadata:{contentType:'application/json'}});
      else if(taken)await env.BUCKET.delete('public-pages/'+page.slug+'.json');
      return json({success:true,page:saved,url:shop?shop+'/'+page.slug:null});
    }
    if(u.pathname==='/api/landing/export'&&request.method==='GET'){
      // A standalone copy for other sites: images inline, the form posts to the shop.
      const id=u.searchParams.get('id')||'';if(!/^[a-f0-9]{16}$/.test(id))return json({success:false,error:'INVALID_REQUEST'},400);
      const o=await env.BUCKET.get(mine+id+'.json');if(!o)return json({success:false,error:'NOT_FOUND'},404);
      if(!shop)return json({success:false,error:'SHOP_NOT_CONFIGURED'},503);
      const page=await o.json(),inline={};
      for(const img of new Set([...page.images,...(page.scene_images||[])])){
        const r=await env.BUCKET.get('public-images/'+img);
        inline[img]=r?'data:'+(r.httpMetadata?.contentType||'image/jpeg')+';base64,'+lpB64(new Uint8Array(await r.arrayBuffer())):shop+'/img/'+img;
      }
      const html=lpRenderPage(page,{img:i=>inline[i]||shop+'/img/'+i,base:shop});
      return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','content-disposition':'attachment; filename="'+page.slug+'.html"','cache-control':'no-store','x-content-type-options':'nosniff'}});
    }
    if(u.pathname==='/api/landing/delete'&&request.method==='POST'){
      const b=await body(1024);if(!b||!/^[a-f0-9]{16}$/.test(b.id||''))return json({success:false,error:'INVALID_REQUEST'},400);
      const o=await env.BUCKET.get(mine+b.id+'.json');if(!o)return json({success:false,error:'NOT_FOUND'},404);
      const page=await o.json(),pub=await env.BUCKET.get('public-pages/'+page.slug+'.json');
      if(pub&&(await pub.json()).owner===user)await env.BUCKET.delete('public-pages/'+page.slug+'.json');
      await env.BUCKET.delete(mine+b.id+'.json');
      return json({success:true});
    }
    if(u.pathname==='/api/landing/image'&&request.method==='POST'){
      if(Number(request.headers.get('content-length')||0)>LP_IMAGE_LIMIT)return json({success:false,error:'IMAGE_TOO_LARGE'},413);
      const bytes=new Uint8Array(await request.arrayBuffer());
      if(bytes.length>LP_IMAGE_LIMIT)return json({success:false,error:'IMAGE_TOO_LARGE'},413);
      const type=lpSniff(bytes);if(!type)return json({success:false,error:'INVALID_IMAGE'},400);
      return json({success:true,id:await lpPutImage(env,user,bytes,type)});
    }
    if(u.pathname==='/api/landing/ai-copy'&&request.method==='POST'){
      if(!env.GEMINI_API_KEY||user!==env.VOICE_OWNER_ID)return json({success:false,error:'AI_NOT_CONFIGURED'},503);
      const b=await body(8192);if(!b)return json({success:false,error:'INVALID_REQUEST'},400);
      const lang=['ar','fr','en'].includes(b.lang)?b.lang:'ar';
      const parts=await lpImageParts(env,user,b.images);if(!parts)return json({success:false,error:'INVALID_IMAGES'},400);
      const product=typeof b.product==='string'?b.product.slice(0,120).replace(/["\n]/g,' '):'',notes=typeof b.notes==='string'?b.notes.slice(0,1000):'';
      const contents=[{parts:[...parts,{text:lpCopyPrompt(lang,product,notes,b.niche)}]}],config={responseMimeType:'application/json',maxOutputTokens:6000,responseSchema:LP_COPY_SCHEMA};
      // The newest model gets a thinking setting; older fallbacks may reject it, so they go without.
      const out=await lpGeminiFirst(env,LP_TEXT_MODELS,m=>[{contents,generationConfig:m===LP_TEXT_MODELS[0]?{...config,thinkingConfig:{thinkingLevel:'low'}}:config}]);
      let copy;try{copy=JSON.parse(out.map(p=>p.text||'').join(''))}catch{return json({success:false,error:'INVALID_AI_RESPONSE'},502)}
      copy.slug=String(copy.slug||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'product';
      if(copy.slug.length<3)copy.slug+='-shop';
      copy.image_prompts=(Array.isArray(copy.image_prompts)?copy.image_prompts:[]).map(String).map(s=>s.slice(0,600)).slice(0,8);
      const lines=(v,max)=>(Array.isArray(v)?v:[]).map(String).map(s=>s.trim().slice(0,max)).slice(0,8);
      copy.image_captions=lines(copy.image_captions,60);copy.results=lines(copy.results,140).filter(Boolean).slice(0,6);
      copy.before_after=(Array.isArray(copy.before_after)?copy.before_after:[]).map(x=>({before:String(x?.before||'').trim().slice(0,100),after:String(x?.after||'').trim().slice(0,100)})).filter(x=>x.before&&x.after).slice(0,4);copy.image_subcaptions=lines(copy.image_subcaptions,80);
      return json({success:true,copy});
    }
    if(u.pathname==='/api/landing/ai-image'&&request.method==='POST'){
      if(!(env.AI||env.GEMINI_API_KEY)||user!==env.VOICE_OWNER_ID)return json({success:false,error:'AI_NOT_CONFIGURED'},503);
      const b=await body(8192);if(!b||typeof b.prompt!=='string'||!b.prompt.trim())return json({success:false,error:'INVALID_REQUEST'},400);
      const imgs=await lpLoadImages(env,user,b.images);if(!imgs)return json({success:false,error:'INVALID_IMAGES'},400);
      const parts=lpParts(imgs);
      const prompt=`Create a professional, photorealistic e-commerce photo for a product landing page.
Use the EXACT product shown in the reference photo(s): keep its shape, colors, materials, logo and details identical. Do not redesign it.
Scene: ${b.prompt.slice(0,600)}
Style: high-end advertising photography, natural soft light, sharp focus on the product, realistic people and hands if any, clean uncluttered background. No text, no letters, no logos added, no watermark, no borders.`;
      // Free Cloudflare first; Gemini (paid images) only if Cloudflare fails and a key is set.
      let cfErr=null;
      if(env.AI){try{const g=await lpCfImage(env,imgs,prompt,b.aspect);return json({success:true,id:await lpPutImage(env,user,g.bytes,g.type),source:'cloudflare'})}catch(e){cfErr=e}}
      if(!env.GEMINI_API_KEY)throw cfErr;
      const req={contents:[{parts:[...parts,{text:prompt}]}],generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:b.aspect==='4:5'?'4:5':'1:1'}}};
      // Image model names change often: fall back to the next one if a model is gone.
      // Some image models want TEXT+IMAGE output and no imageConfig: try that shape too.
      let out;
      try{out=await lpGeminiFirst(env,await lpImageModels(env),()=>[req,{contents:req.contents,generationConfig:{responseModalities:['TEXT','IMAGE']}}],parts=>parts.some(p=>(p.inlineData||p.inline_data)?.data))}
      catch(e){
        // Both failed: Cloudflare's daily limit is the more useful thing to tell; keep both reasons.
        if(!cfErr)throw e;
        throw Object.assign(Error('both'),{code:cfErr.code==='CF_DAILY_LIMIT'?cfErr.code:e.code,detail:[cfErr.detail,e.detail].filter(Boolean).join(' | ')});
      }
      const img=out.map(p=>p.inlineData||p.inline_data).find(d=>d?.data);
      if(!img)return json({success:false,error:'AI_NO_IMAGE'},502);
      const bytes=Uint8Array.from(atob(img.data),c=>c.charCodeAt(0)),type=lpSniff(bytes);
      if(!type)return json({success:false,error:'AI_NO_IMAGE'},502);
      return json({success:true,id:await lpPutImage(env,user,bytes,type)});
    }
    if(u.pathname==='/api/orders'&&request.method==='GET'){
      const cursor=u.searchParams.get('cursor')||undefined;if(cursor&&cursor.length>2048)return json({success:false,error:'INVALID_REQUEST'},400);
      const list=await env.BUCKET.list({prefix:orders,limit:200,cursor,include:['customMetadata']});
      const items=await Promise.all(list.objects.map(async o=>{
        if(o.customMetadata?.d)try{return JSON.parse(o.customMetadata.d)}catch{}
        const r=await env.BUCKET.get(o.key);return r&&r.json();
      }));
      return json({success:true,items:items.filter(Boolean),cursor:list.truncated?list.cursor:null});
    }
    if(u.pathname==='/api/orders/status'&&request.method==='POST'){
      const b=await body(1024);
      if(!b||!/^\d{13}-[a-f0-9]{8}$/.test(b.id||'')||!LP_STATUSES.includes(b.status))return json({success:false,error:'INVALID_REQUEST'},400);
      const key=orders+b.id+'.json',o=await env.BUCKET.get(key);if(!o)return json({success:false,error:'NOT_FOUND'},404);
      const rec={...await o.json(),status:b.status,updated_at:new Date().toISOString()},data=JSON.stringify(rec);
      await env.BUCKET.put(key,data,{httpMetadata:{contentType:'application/json'},customMetadata:new TextEncoder().encode(data).length<1900?{d:data}:{}});
      return json({success:true,order:rec});
    }
    return json({success:false,error:'NOT_FOUND'},404);
  }catch(e){
    if(typeof e?.code==='string')return json({success:false,error:e.code,...(e.detail?{detail:e.detail}:{})},502);
    console.error('LANDING',String(e?.name),String(e?.message).slice(0,200));
    return json({success:false,error:e?.name==='TimeoutError'?'AI_TIMEOUT':'SERVER_ERROR'},500);
  }
}
