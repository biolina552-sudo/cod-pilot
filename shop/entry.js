import {LP_IMAGE_RE,LP_SLUG_RE,lpCleanOrder,lpRenderPage,lpRenderThanks} from '../landing-render.js';

// Public worker for landing pages: no sign-in, so it can only read published
// pages and images, and add new orders. Everything else lives in the private app.
const SECURITY={
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
  'content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://analytics.tiktok.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-src https:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...SECURITY}});
const notFound=()=>new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8',...SECURITY}});

export function orderId(now=Date.now()){
  const rand=[...crypto.getRandomValues(new Uint8Array(4))].map(b=>b.toString(16).padStart(2,'0')).join('');
  // Reverse time so a plain R2 listing returns the newest orders first.
  return String(9999999999999-now).padStart(13,'0')+'-'+rand;
}

async function loadPage(env,slug){
  if(!LP_SLUG_RE.test(slug))return null;
  const o=await env.BUCKET.get('public-pages/'+slug+'.json');
  if(!o)return null;
  const page=await o.json();
  return page.published?page:null;
}

export default {async fetch(request,env){
  const u=new URL(request.url);let path;try{path=decodeURIComponent(u.pathname).replace(/\/+$/,'')||'/'}catch{return notFound()}
  if(path==='/robots.txt')return new Response('User-agent: *\nAllow: /\n',{headers:{'content-type':'text/plain'}});
  if(path==='/')return html('<!doctype html><meta charset="utf-8"><title>Shop</title><p style="font-family:system-ui;text-align:center;margin-top:20vh">🛍️</p>');

  let m=path.match(/^\/img\/([^/]+)$/);
  if(m){
    if(!LP_IMAGE_RE.test(m[1])||!['GET','HEAD'].includes(request.method))return notFound();
    const o=await env.BUCKET.get('public-images/'+m[1]);
    if(!o)return notFound();
    return new Response(request.method==='HEAD'?null:o.body,{headers:{'content-type':o.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=31536000, immutable',...SECURITY}});
  }

  m=path.match(/^\/([a-z0-9-]+)(?:\/(order|thanks))?$/);
  if(!m)return notFound();
  const page=await loadPage(env,m[1]);
  if(!page)return notFound();

  if(!m[2]&&request.method==='GET')return html(lpRenderPage(page));
  if(m[2]==='thanks'&&request.method==='GET')return html(lpRenderThanks(page,parseInt(u.searchParams.get('q')||'0',10)));
  if(m[2]==='order'&&request.method==='POST'){
    if(Number(request.headers.get('content-length')||0)>8000)return new Response('Too large',{status:413});
    let form;try{form=Object.fromEntries(await request.formData())}catch{return html(lpRenderPage(page),400)}
    const thanks=i=>Response.redirect(u.origin+'/'+page.slug+'/thanks?q='+i,303);
    // Bots fill the hidden field: pretend it worked and store nothing.
    if(form.website)return thanks(0);
    const {order,errors}=lpCleanOrder(page,form);
    if(errors)return html(lpRenderPage(page,{values:form,errors}),400);
    const offer=page.offers[order.offer],id=orderId();
    const record={id,page_id:page.id,slug:page.slug,product:page.product,offer,currency:page.currency,
      name:order.name,phone:order.phone,city:order.city,address:order.address,status:'new',
      created_at:new Date().toISOString(),country:request.cf?.country||null};
    const data=JSON.stringify(record);
    // The order also goes in metadata (when it fits) so the app lists orders in one call.
    await env.BUCKET.put('orders/'+encodeURIComponent(page.owner)+'/'+id+'.json',data,{httpMetadata:{contentType:'application/json'},customMetadata:new TextEncoder().encode(data).length<1900?{d:data}:{}});
    return thanks(order.offer);
  }
  return new Response('Method not allowed',{status:405});
}};
