// Google TTS: fixed endpoint/model; no automatic fallback to a paid provider.
async function googleVoice(text,env,voice='Kore'){
try{
const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY.trim()},body:JSON.stringify({model:'gemini-3.8-flash-lite-tts',input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style:'Speak in natural Moroccan Darija, with authentic Moroccan pronunciation. Warm, clear, conversational advertising delivery, moderate pace. Read the transcript exactly; do not add words.'}]}]}],response_format:{type:'audio'},generation_config:{speech_config:[{voice}]}}),redirect:'manual',signal:AbortSignal.timeout(90000)});
if(!r.ok){
let errorStatus=null,safeMessage='',reason=null;
try{const raw=await r.text();let e;try{e=JSON.parse(raw)}catch{e={}}if(Array.isArray(e))e=e[0];
const err=e?.error;safeMessage=String(err?.message||e?.message||(typeof err==='string'?err:raw)).split(env.GEMINI_API_KEY).join('[REDACTED]').split(env.GEMINI_API_KEY.trim()).join('[REDACTED]').replace(/AIza[0-9A-Za-z_-]+/g,'[REDACTED]').replace(/https?:\/\/[^\s]+/g,'[URL]').slice(0,1200);
if(['INVALID_ARGUMENT','NOT_FOUND','PERMISSION_DENIED','UNAUTHENTICATED','RESOURCE_EXHAUSTED','FAILED_PRECONDITION','UNAVAILABLE','INTERNAL'].includes(err?.status))errorStatus=err.status;
const reasons=Array.isArray(err?.details)?err.details.map(d=>d.reason):[];
if(reasons.includes('API_KEY_INVALID')||safeMessage.includes('API key not valid'))reason='API_KEY_INVALID';
}catch{}
if(env.BUCKET)await env.BUCKET.put('voice-diagnostics/google-last-error',JSON.stringify({http_status:r.status,provider_status:errorStatus,reason,message:safeMessage,at:new Date().toISOString()}));
return json({error:reason==='API_KEY_INVALID'?'VOICE_KEY_INVALID':[401,403].includes(r.status)?'VOICE_AUTH':r.status===429?'VOICE_LIMIT':r.status===402?'VOICE_PAYMENT_REQUIRED':r.status===404?'VOICE_MODEL_UNAVAILABLE':r.status===400?'VOICE_REQUEST_REJECTED':'VOICE_FAILED',upstream_status:r.status,provider_status:errorStatus},502);
}
const d=await r.json();let audio;for(const step of d.steps||[])if(step.type==='model_output')for(const part of step.content||[])if(part.type==='audio')audio=part;
if(!audio||typeof audio.data!=='string'||audio.data.length>16000000)return json({error:'VOICE_FAILED'},502);
const bytes=Uint8Array.from(atob(audio.data),c=>c.charCodeAt(0));
if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')return json({error:'VOICE_FAILED'},502);
return new Response(bytes,{headers:{'content-type':'audio/wav','cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':'attachment; filename="codpilot-voice.wav"'}});
}catch{return json({error:'VOICE_UNAVAILABLE'},502)}
}
