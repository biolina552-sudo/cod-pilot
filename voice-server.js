const GOOGLE_VOICE_IDS=['Kore','Puck','Charon','Sulafat','Aoede','Leda','Despina','Achernar','Zephyr','Fenrir','Orus','Algieba','Alnilam','Sadaltager'];
// Delivery styles are picked by id so visitors can't send free-form prompts to the model.
const GOOGLE_VOICE_STYLES={hype:'Energetic, excited, fast-paced advertising delivery, like a TikTok ad.',calm:'Calm, soft, trustworthy tone, like a friend giving advice.',testimonial:'Like a real customer giving an honest testimonial, casual and spontaneous.'};
// Paid speech is restricted to an explicitly configured owner, never public visitors.
async function handleVoice(request,env,user,u){
if(!user)return json({error:'UNAUTHENTICATED'},401);
const allowed=!!env.VOICE_OWNER_ID&&user===env.VOICE_OWNER_ID;
const providers={google:!!(env.GEMINI_API_KEY&&env.VOICE_OWNER_ID),elevenlabs:!!(env.ELEVENLABS_API_KEY&&env.ELEVENLABS_VOICE_ID&&env.VOICE_OWNER_ID)};const configured=providers.google||providers.elevenlabs;
if(u.pathname==='/api/voice/status'&&request.method==='GET')return json({configured,providers,allowed,identity:{id:user,email:request.headers.get('oai-authenticated-user-email')||null},voice_name:env.ELEVENLABS_VOICE_NAME||'صوت الاستوديو',max_characters:1000});
if(!allowed)return json({error:'VOICE_OWNER_ONLY'},403);
if(u.pathname==='/api/voice/diagnostic'&&request.method==='GET'){const o=await env.BUCKET?.get(u.searchParams.get('kind')==='plan'?'voice-diagnostics/auto-last-error':'voice-diagnostics/google-last-error');return json(o?await o.json():{message:'No recorded Google error'})}
if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
if(request.headers.get('origin')!==u.origin)return json({error:'FORBIDDEN'},403);
if(!configured)return json({error:'VOICE_NOT_CONFIGURED'},503);
if(!['/api/voice/generate','/api/voice/sample','/api/voice/plan'].includes(u.pathname))return json({error:'NOT_FOUND'},404);
if(Number(request.headers.get('content-length')||0)>(u.pathname==='/api/voice/plan'?8000000:8000))return json({error:'INVALID_TEXT'},400);
let b;try{b=await request.json()}catch{return json({error:'INVALID_TEXT'},400)}
if(u.pathname==='/api/voice/plan')return googleAutoPlan(b,env);
const sample=u.pathname==='/api/voice/sample';
const selectedVoice=b.voice||'Kore';
if(!GOOGLE_VOICE_IDS.includes(selectedVoice))return json({error:'INVALID_VOICE'},400);
if(sample){
if(b.provider!=='google'||!providers.google)return json({error:'VOICE_NOT_CONFIGURED'},503);
const key='voice-samples/v1/'+selectedVoice;
const cached=await env.BUCKET?.get(key);
if(cached)return new Response(cached.body,{headers:{'content-type':'audio/wav','cache-control':'private, max-age=86400','x-content-type-options':'nosniff'}});
const response=await googleVoice('مرحبا بيك فشوبلينا. اختار الصوت اللي مناسب للإعلان ديالك. توصيل للمغرب كامل، والدفع عند الاستلام.',env,selectedVoice);
if(!response.ok||!env.BUCKET)return response;
const bytes=await response.arrayBuffer();
await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'audio/wav'}});
return new Response(bytes,{headers:response.headers});
}
if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000)return json({error:'INVALID_TEXT'},400);
const provider=b.provider||'elevenlabs';
if(!['google','elevenlabs'].includes(provider))return json({error:'INVALID_TEXT'},400);
if(!providers[provider])return json({error:'VOICE_NOT_CONFIGURED'},503);
if(provider==='google')return googleVoice(b.text.trim(),env,selectedVoice,Object.hasOwn(GOOGLE_VOICE_STYLES,b.style)?GOOGLE_VOICE_STYLES[b.style]:undefined);
if(!/^[a-zA-Z0-9_-]{5,100}$/.test(env.ELEVENLABS_VOICE_ID))return json({error:'VOICE_NOT_CONFIGURED'},503);
try{
const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+env.ELEVENLABS_VOICE_ID+'?output_format=mp3_44100_128',{method:'POST',headers:{'content-type':'application/json','xi-api-key':env.ELEVENLABS_API_KEY},body:JSON.stringify({text:b.text.trim(),model_id:'eleven_v3',language_code:'ar'}),redirect:'manual',signal:AbortSignal.timeout(90000)});
if(r.status===402)return json({error:'VOICE_PAYMENT_REQUIRED'},502);
if(!r.ok)return json({error:[401,403].includes(r.status)?'VOICE_AUTH':r.status===429?'VOICE_LIMIT':'VOICE_FAILED'},502);
if(!(r.headers.get('content-type')||'').includes('audio/'))return json({error:'VOICE_FAILED'},502);
return new Response(r.body,{headers:{'content-type':'audio/mpeg','cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':'attachment; filename="codpilot-voice.mp3"'}});
}catch{return json({error:'VOICE_UNAVAILABLE'},502)}
}
