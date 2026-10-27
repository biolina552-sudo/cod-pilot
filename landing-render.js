// Landing pages with a cash-on-delivery order form.
// Shared by the private app (make.py inlines this file without the `export`
// keywords) and the public shop worker (shop/entry.js imports it).

export const LP_CURRENCIES=['MAD','SAR','AED','KWD','QAR','BHD','OMR','USD','EUR'];
export const LP_STATUSES=['new','confirmed','shipped','delivered','cancelled','returned'];
export const LP_IMAGE_RE=/^[a-f0-9]{24}\.(jpg|png|webp)$/;
export const LP_SLUG_RE=/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const LP_RESERVED=['img','api','order','orders','admin','static','assets','favicon.ico','robots.txt'];

// Ready-made templates per niche: colors (main, ribbon, ribbon text, soft background),
// the badges under the price, and a hint that steers the AI copy and photos.
export const LP_NICHES={
  general:{name:'عام (أي منتج)',c:'#196c58',a:'#f2a33a',at:'#fff',bg:'#eef7f3',icons:['💵','🚚','✅'],hint:''},
  kitchen:{name:'مطبخ وطبخ',c:'#1f7a3a',a:'#f39c12',at:'#fff',bg:'#f1f8ec',icons:['💵','🚚','🍲'],hint:'Kitchen and cooking: saving time, easy family meals, a clean kitchen. Scenes in a bright modern Moroccan kitchen with family members.'},
  health:{name:'صحة وراحة',c:'#0f6f7c',a:'#22b8a6',at:'#fff',bg:'#ecf8f8',icons:['💵','🚚','💆'],hint:'Wellbeing and comfort: relief from everyday discomfort, rest, feeling good. Calm, clean scenes at home. Never make medical claims.'},
  beauty:{name:'تجميل وعناية',c:'#b0195a',a:'#f06292',at:'#fff',bg:'#fdf0f5',icons:['💵','🚚','✨'],hint:'Beauty and self-care: looking and feeling confident, a quick easy routine. Soft elegant scenes with Moroccan women, bathroom or vanity table.'},
  home:{name:'دار وتنظيف',c:'#1d5fa6',a:'#f5b700',at:'#1f1f1f',bg:'#eef4fb',icons:['💵','🚚','🏠'],hint:'Home, cleaning and organization: less effort, a tidy home, saving space. Scenes in a bright Moroccan home.'},
  kids:{name:'أطفال وبيبي',c:'#7b3fa0',a:'#ff8a3d',at:'#fff',bg:'#f6effa',icons:['💵','🚚','🧸'],hint:'Babies and kids: safety, happy children, easier days for parents. Warm family scenes with a Moroccan mother or father and child.'},
  sport:{name:'رياضة ولياقة',c:'#c62828',a:'#212121',at:'#fff',bg:'#fdeeee',icons:['💵','🚚','💪'],hint:'Sport and fitness: energy, results, training at home or outdoors. Dynamic scenes with fit Moroccan men and women.'},
  tech:{name:'إلكترونيات وكادجيت',c:'#1a2a80',a:'#00a8e8',at:'#fff',bg:'#eef1fb',icons:['💵','🚚','⚡'],hint:'Electronics and gadgets: practical, modern, makes daily life easier. Sleek modern scenes at a desk, in a car or on the go.'},
  car:{name:'طوموبيل',c:'#263238',a:'#ff6f00',at:'#fff',bg:'#f0f2f3',icons:['💵','🚚','🚗'],hint:'Car accessories: comfort, a clean car, safety on the road. Scenes inside and around a car in a Moroccan city.'},
  fashion:{name:'لباس وإكسسوارات',c:'#3e2723',a:'#c9a227',at:'#1f1f1f',bg:'#f8f4ee',icons:['💵','🚚','👌'],hint:'Fashion and accessories: style, elegance, standing out. Lifestyle scenes with stylish Moroccan people in the city.'},
  pets:{name:'حيوانات أليفة',c:'#5d4037',a:'#43a047',at:'#fff',bg:'#f5f1ee',icons:['💵','🚚','🐾'],hint:'Pets: happy, healthy cats and dogs, easier care for owners. Warm home scenes with a pet and its owner.'}
};

const LP_TEXT={
  ar:{dir:'rtl',cod:'الدفع عند الاستلام',delivery:'التوصيل لجميع المدن',form:'اطلب دابا وخلص ملي توصلك',name:'الاسم الكامل',phone:'رقم الهاتف',city:'المدينة',address:'العنوان',offer:'اختار العرض',cta:'اطلب الآن',thanks:'شكرا! توصلنا بالطلب ديالك، وغادي نتصلو بيك قريب باش نأكدوه.',back:'رجوع للصفحة',sending:'كنصيفطو...',errors:{name:'دخل الاسم ديالك',phone:'دخل رقم هاتف صحيح',city:'دخل المدينة',address:'دخل العنوان',offer:'اختار العرض'},wa:'سولنا فـ WhatsApp',piece:'حبة',problem:'واش عندك هاد المشكل؟',offerT:'عرض خاص',why:'علاش تختارو؟',faq:'أسئلة متكررة',gain:'شنو غادي تربح؟',before:'قبل',after:'بعد',sol:'الحل ديالك غير بـ'},
  fr:{dir:'ltr',cod:'Paiement à la livraison',delivery:'Livraison dans toutes les villes',form:'Commandez maintenant, payez à la réception',name:'Nom complet',phone:'Téléphone',city:'Ville',address:'Adresse',offer:'Choisissez votre offre',cta:'Commander',thanks:'Merci ! Votre commande est bien reçue. Nous vous appellerons bientôt pour la confirmer.',back:'Retour',sending:'Envoi...',errors:{name:'Entrez votre nom',phone:'Entrez un numéro valide',city:'Entrez votre ville',address:'Entrez votre adresse',offer:'Choisissez une offre'},wa:'Écrivez-nous sur WhatsApp',piece:'pièce',problem:'Vous connaissez ce problème ?',offerT:'Offre spéciale',why:'Pourquoi le choisir ?',faq:'Questions fréquentes',gain:'Ce que vous allez gagner',before:'Avant',after:'Après',sol:'Votre solution pour seulement'},
  en:{dir:'ltr',cod:'Cash on delivery',delivery:'Delivery to every city',form:'Order now, pay when it arrives',name:'Full name',phone:'Phone number',city:'City',address:'Address',offer:'Choose your offer',cta:'Order now',thanks:'Thank you! We received your order and will call you soon to confirm it.',back:'Back',sending:'Sending...',errors:{name:'Enter your name',phone:'Enter a valid phone number',city:'Enter your city',address:'Enter your address',offer:'Choose an offer'},wa:'Ask us on WhatsApp',piece:'item',problem:'Sound familiar?',offerT:'Special offer',why:'Why you will love it',faq:'Questions',gain:'What you get',before:'Before',after:'After',sol:'Your solution for only'}
};

export function lpEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function lpStr(v,max){return typeof v==='string'?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):''}
function lpLine(v,max){return lpStr(v,max).replace(/\s+/g,' ')}
// Old pages stored a plain string; new ones store {t: title, s: ribbon line}.
function lpCap(v){const c=typeof v==='string'?{t:lpLine(v,60),s:''}:{t:lpLine(v?.t,60),s:lpLine(v?.s,80)};return c.t||c.s?c:null}
function lpNum(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=typeof v==='number'?v:Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=10000000?Math.round(n*100)/100:null}

// Validates a page sent from the editor. Returns {page} or {error}.
export function lpCleanPage(b){
  if(!b||typeof b!=='object')return {error:'INVALID_PAGE'};
  const slug=lpStr(b.slug,40).toLowerCase();
  if(!LP_SLUG_RE.test(slug)||slug.includes('--')||LP_RESERVED.includes(slug))return {error:'INVALID_SLUG'};
  const product=lpLine(b.product,120);if(product.length<2)return {error:'INVALID_PRODUCT'};
  const currency=LP_CURRENCIES.includes(b.currency)?b.currency:'MAD';
  const lang=['ar','fr','en'].includes(b.lang)?b.lang:'ar';
  const offers=(Array.isArray(b.offers)?b.offers:[]).slice(0,4).map(o=>({qty:Math.min(99,Math.max(1,parseInt(o?.qty,10)||1)),price:lpNum(o?.price),label:lpLine(o?.label,60)})).filter(o=>o.price>0);
  const price=lpNum(b.price);
  if(!offers.length){if(!(price>0))return {error:'INVALID_PRICE'};offers.push({qty:1,price,label:''})}
  const old=lpNum(b.old_price);
  const imgs=list=>(Array.isArray(list)?list:[]).filter(i=>typeof i==='string'&&LP_IMAGE_RE.test(i)).slice(0,8);
  const images=imgs(b.images),scene_images=imgs(b.scene_images);
  // Poster text for each AI photo, keyed by image id: a big title and a short ribbon line.
  const caps=b.scene_captions&&typeof b.scene_captions==='object'?b.scene_captions:{},scene_captions={};
  for(const id of scene_images){const c=lpCap(caps[id]);if(c)scene_captions[id]=c}
  const whatsapp=lpStr(b.whatsapp,20).replace(/[^\d]/g,'');
  const meta=lpStr(b.meta_pixel,20),tiktok=lpStr(b.tiktok_pixel,30).toUpperCase();
  if(meta&&!/^\d{5,20}$/.test(meta))return {error:'INVALID_META_PIXEL'};
  if(tiktok&&!/^[A-Z0-9]{10,30}$/.test(tiktok))return {error:'INVALID_TIKTOK_PIXEL'};
  if(whatsapp&&(whatsapp.length<8||whatsapp.length>15))return {error:'INVALID_WHATSAPP'};
  const niche=Object.hasOwn(LP_NICHES,b.niche)?b.niche:'general';
  const color=/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color.toLowerCase():LP_NICHES[niche].c;
  return {page:{
    slug,lang,product,currency,offers,niche,color,images,scene_images,scene_captions,whatsapp,meta_pixel:meta,tiktok_pixel:tiktok,
    published:b.published!==false,
    layout:b.layout==='classic'?'classic':'poster',
    headline:lpLine(b.headline,160),
    subheadline:lpLine(b.subheadline,300),
    price:offers[0].price,
    old_price:old!==null&&old>offers[0].price?old:null,
    bullets:(Array.isArray(b.bullets)?b.bullets:[]).map(x=>lpLine(x,140)).filter(Boolean).slice(0,8),
    description:lpStr(b.description,3000),
    problem_title:lpLine(b.problem_title,160),
    problems:(Array.isArray(b.problems)?b.problems:[]).map(x=>lpLine(x,200)).filter(Boolean).slice(0,5),
    solution:lpLine(b.solution,500),
    results_title:lpLine(b.results_title,160),
    results:(Array.isArray(b.results)?b.results:[]).map(x=>lpLine(x,140)).filter(Boolean).slice(0,6),
    before_after:(Array.isArray(b.before_after)?b.before_after:[]).map(x=>({before:lpLine(x?.before,100),after:lpLine(x?.after,100)})).filter(x=>x.before&&x.after).slice(0,4),
    features:(Array.isArray(b.features)?b.features:[]).map(f=>({icon:lpLine(f?.icon,4),title:lpLine(f?.title,80),text:lpLine(f?.text,240)})).filter(f=>f.title).slice(0,6),
    faq:(Array.isArray(b.faq)?b.faq:[]).map(f=>({q:lpLine(f?.q,160),a:lpLine(f?.a,500)})).filter(f=>f.q&&f.a).slice(0,6),
    cta:lpLine(b.cta,40),
    thanks:lpLine(b.thanks,300),
    ask_address:!!b.ask_address
  }};
}

// Validates a customer's order form. Returns {order} or {errors}.
export function lpCleanOrder(page,f){
  const t=LP_TEXT[page.lang]||LP_TEXT.ar,errors={};
  const name=lpLine(f.name,80),city=lpLine(f.city,60),address=lpLine(f.address,200);
  const phone=lpStr(f.phone,30).replace(/[\s.\-()]/g,'').replace(/^00/,'+');
  const i=parseInt(f.offer??'0',10);
  if(name.length<2)errors.name=t.errors.name;
  if(!/^\+?\d{8,15}$/.test(phone))errors.phone=t.errors.phone;
  if(city.length<2)errors.city=t.errors.city;
  if(page.ask_address&&address.length<3)errors.address=t.errors.address;
  if(!(i>=0&&i<page.offers.length))errors.offer=t.errors.offer;
  if(Object.keys(errors).length)return {errors};
  return {order:{name,phone,city,address,offer:i}};
}

function lpJs(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
const LP_AR_CUR={MAD:'درهم',SAR:'ريال',AED:'درهم',QAR:'ريال',OMR:'ريال',KWD:'دينار',BHD:'دينار'};
function lpMoney(n,c,lang){return (Number.isInteger(n)?String(n):n.toFixed(2))+' '+(lang==='ar'&&LP_AR_CUR[c]||c)}

// event = {id, data}: the purchase is sent once per order (eventID lets the ad
// platforms drop duplicates, and the browser remembers orders it already sent).
function lpPixels(page,event){
  let s='';
  if(event&&(page.meta_pixel||page.tiktok_pixel))s+=`<script>(function(){var k=${lpJs('lp_order_'+event.id)};try{window.__lpSeen=!!localStorage.getItem(k);localStorage.setItem(k,'1')}catch(e){window.__lpSeen=false}})()</script>`;
  if(page.meta_pixel){
    s+=`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${page.meta_pixel}');fbq('track','PageView');${event?`if(!window.__lpSeen)fbq('track','Purchase',${lpJs(event.data)},{eventID:${lpJs(event.id)}});`:''}</script>`;
  }
  if(page.tiktok_pixel){
    s+=`<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${page.tiktok_pixel}');ttq.page();${event?`if(!window.__lpSeen)ttq.track('CompletePayment',${lpJs(event.data)},{event_id:${lpJs(event.id)}});`:''}}(window,document,'ttq');</script>`;
  }
  return s;
}

function lpShell(page,title,body,event,og){
  const t=LP_TEXT[page.lang]||LP_TEXT.ar,n=LP_NICHES[page.niche]||LP_NICHES.general;
  return `<!doctype html><html lang="${page.lang}" dir="${t.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${lpEsc(title)}</title>${og?`<meta property="og:image" content="${lpEsc(og)}">`:''}<meta property="og:title" content="${lpEsc(title)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"><style>
:root{--c:${page.color};--a:${n.a};--at:${n.at};--bg:${n.bg};--dk:color-mix(in srgb,var(--c) 72%,#000)}*{box-sizing:border-box}body{margin:0;background:#f6f6f4;color:#1f2a26;font:17px/1.7 'Cairo',system-ui,sans-serif}html,body{overflow-x:hidden}main{position:relative;max-width:560px;margin:0 auto;background:#fff;min-height:100vh;padding-bottom:90px}
.gallery{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0}.gallery img{width:100%;flex:0 0 100%;aspect-ratio:1;object-fit:cover;scroll-snap-align:center;display:block}
.pad{padding:18px 18px 4px}h1{font-size:28px;line-height:1.35;margin:4px 0 6px;font-weight:900;color:var(--dk)}.sub{color:#56635e;margin:0 0 10px}.price{display:flex;align-items:baseline;gap:12px;margin:8px 0}.price b{font-size:30px;color:var(--c)}.price s{color:#8a948f;font-size:19px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.badges span{background:#f0f4f1;border-radius:999px;padding:4px 12px;font-size:14px;font-weight:600}
ul.b{list-style:none;padding:0;margin:14px 0}ul.b li{padding:8px 0;border-bottom:1px solid #eef0ee}ul.b li:before{content:"✔";color:var(--c);font-weight:800;margin-inline-end:10px}
.desc p{margin:0 0 10px;color:#3a4742}
form{margin:18px;padding:18px;border:2px solid var(--c);border-radius:16px;background:#fcfdfc}form h2{margin:0 0 10px;font-size:20px;text-align:center}
label{display:block;margin:10px 0 4px;font-weight:600;font-size:15px}input{width:100%;padding:13px 14px;border:1px solid #cfd6d2;border-radius:10px;font:inherit;background:#fff}input:focus{outline:3px solid color-mix(in srgb,var(--c) 35%,transparent);border-color:var(--c)}
.offers{display:grid;gap:8px}.offers label{display:flex;justify-content:space-between;align-items:center;gap:10px;border:2px solid #dfe5e1;border-radius:12px;padding:12px 14px;margin:0;cursor:pointer;font-weight:600}.offers input{width:auto;margin:0}.offers label:has(input:checked){border-color:var(--c);background:color-mix(in srgb,var(--c) 8%,#fff)}.offers .op{color:var(--c);font-weight:800;white-space:nowrap}
.err{color:#b42318;font-size:14px;margin:4px 0 0}.alert{background:#fef3f2;color:#b42318;border-radius:10px;padding:10px 12px}
button{width:100%;margin-top:16px;padding:15px;border:0;border-radius:12px;background:var(--c);color:#fff;font:800 20px 'Cairo',system-ui;cursor:pointer;animation:pulse 2s infinite}button:disabled{opacity:.6;animation:none}@keyframes pulse{50%{transform:scale(1.02)}}
.hp{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0}
.sticky{position:fixed;bottom:0;left:0;right:0;padding:10px 14px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.08);text-align:center}.sticky a{display:block;max-width:532px;margin:0 auto;padding:13px;border-radius:12px;background:var(--c);color:#fff;font-weight:800;font-size:18px;text-decoration:none}
.top{display:block;background:var(--dk);color:#fff;text-align:center;font-weight:800;padding:9px 12px;text-decoration:none;font-size:16px}
.poster{position:relative;margin:0;padding:26px 0 18px;background:#fff;overflow:hidden;text-align:center}.poster:before,.poster:after{content:"";position:absolute;border-radius:50%;z-index:0}.poster:before{width:150%;height:200px;left:-25%;bottom:-120px;background:var(--bg)}.poster:after{width:120px;height:120px;top:-50px;inset-inline-end:-40px;border:18px solid color-mix(in srgb,var(--c) 18%,transparent)}
.poster>*{position:relative;z-index:1}.poster h3{margin:0 18px 10px;color:var(--dk);font:900 34px/1.25 'Cairo',system-ui,sans-serif}.rb{display:inline-block;background:var(--a);color:var(--at);font:800 20px/1.4 'Cairo',system-ui,sans-serif;padding:5px 18px;border-radius:999px;margin:0 16px 14px;transform:rotate(-1.5deg);box-shadow:0 4px 12px color-mix(in srgb,var(--a) 35%,transparent)}.poster img{width:calc(100% - 28px);margin:0 14px;border-radius:20px;display:block;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.offer{position:relative;margin:18px;padding:26px 18px 20px;border-radius:24px;background:linear-gradient(160deg,var(--bg),#fff);border:3px solid var(--c);text-align:center;overflow:hidden}.offer .on{margin:0;font-weight:800;color:var(--dk);font-size:20px}.offer h2{display:inline-block;margin:10px 0;background:var(--a);color:var(--at);font:900 30px/1.3 'Cairo',system-ui;padding:4px 26px;border-radius:14px;transform:rotate(-2deg)}.offer .big{font:900 56px/1.1 'Cairo',system-ui;color:var(--c);margin:8px 0 0}.offer s{color:#8a948f;font-size:22px;font-weight:700}.offer img{width:70%;max-width:280px;display:block;margin:12px auto 0;border-radius:16px}.scene{position:relative;margin:14px 0}.scene img{width:100%;display:block}.scene figcaption{position:absolute;left:0;right:0;bottom:0;padding:48px 18px 18px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:#fff;font:800 27px/1.3 'Cairo',system-ui,sans-serif;text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.5)}.scene figcaption span{background:var(--c);padding:2px 12px;border-radius:8px;box-decoration-break:clone;-webkit-box-decoration-break:clone}.prob{background:#fff7f5}.prob ul{list-style:none;padding:0;margin:0}.prob li{padding:8px 0}.prob li:before{content:"✖";color:#d92d20;font-weight:800;margin-inline-end:10px}.sol{background:#fff;border-inline-start:4px solid var(--c);padding:12px 14px;border-radius:10px;font-weight:700;margin:14px 0 6px}
.gain{background:#f3faf5}.ba{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.ba b{text-align:center;padding:8px;border-radius:10px;color:#fff;font-size:18px}.ba .bh{background:#d92d20}.ba .ah{background:#12a150}.ba span{padding:10px 12px;border-radius:10px;font-weight:700;line-height:1.5}.ba .bb{background:#fff1ef;color:#7a271a}.ba .aa{background:#e8f8ee;color:#0b5c2e}.gain ul{list-style:none;padding:0;margin:0}.gain li{padding:8px 0;font-weight:700}.gain li:before{content:"✔";color:#12a150;font-weight:900;margin-inline-end:10px}
section.pad h2{font-size:22px;text-align:center;margin:10px 0 14px}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:10px}.feat div{background:#f6f8f6;border-radius:14px;padding:14px}.feat span{font-size:28px;display:block}.feat b{display:block;margin:4px 0}.feat p{margin:0;font-size:15px;color:#4b5853;line-height:1.6}
details{border-bottom:1px solid #eef0ee;padding:10px 0}summary{font-weight:700;cursor:pointer}details p{margin:8px 0 0;color:#4b5853}
a.cta{display:block;text-align:center;margin:14px 0;padding:15px;border-radius:14px;background:var(--c);color:#fff;font-weight:900;font-size:21px;text-decoration:none;box-shadow:0 6px 0 var(--dk);animation:pulse 2s infinite}
.wa{display:block;text-align:center;margin:8px 18px 20px;color:#128c4a;font-weight:700}.done{text-align:center;padding:60px 24px}.done .ok{font-size:64px;color:var(--c)}
</style></head><body><main>${body}</main>${lpPixels(page,event)}</body></html>`;
}

// The public product page with the order form.
// opts.img maps an image id to its URL and opts.base is the shop origin; the
// downloadable copy sets both so the page works when hosted on another site.
export function lpRenderPage(page,{values={},errors={},img=id=>'/img/'+id,base=''}={}){
  const t=LP_TEXT[page.lang]||LP_TEXT.ar,v=k=>lpEsc(values[k]??''),e=k=>errors[k]?`<p class="err">${lpEsc(errors[k])}</p>`:'';
  const chosen=Number.isInteger(+values.offer)?+values.offer:0;
  const gallery=page.images.length?`<div class="gallery">${page.images.map((id,i)=>`<img src="${lpEsc(img(id))}" alt="${lpEsc(page.product)}"${i?' loading="lazy"':''}>`).join('')}</div>`:'';
  const offers=page.offers.length>1?`<label>${t.offer}</label><div class="offers">${page.offers.map((o,i)=>`<label><span><input type="radio" name="offer" value="${i}"${i===chosen?' checked':''}> ${lpEsc(o.label||o.qty+' '+t.piece)}</span><span class="op">${lpEsc(lpMoney(o.price,page.currency,page.lang))}</span></label>`).join('')}</div>${e('offer')}`:'<input type="hidden" name="offer" value="0">';
  const desc=page.description?`<div class="desc">${page.description.split(/\n+/).map(p=>`<p>${lpEsc(p)}</p>`).join('')}</div>`:'';
  const n=LP_NICHES[page.niche]||LP_NICHES.general,money=x=>lpEsc(lpMoney(x,page.currency,page.lang));
  const scenes=page.scene_images||[],poster=page.layout!=='classic',scene=i=>{if(!scenes[i])return '';const cap=lpCap((page.scene_captions||{})[scenes[i]])||{t:'',s:''},im=`<img src="${lpEsc(img(scenes[i]))}" alt="${lpEsc(cap.t||cap.s||page.product)}" loading="lazy">`;
    // Poster: big bold title and a colored ribbon line above the photo (like image-based COD pages); classic: caption over the photo.
    return poster?`<figure class="poster">${cap.t?`<h3>${lpEsc(cap.t)}</h3>`:''}${cap.s?`<p class="rb">${lpEsc(cap.s)}</p>`:''}${im}</figure>`:`<figure class="scene">${im}${cap.t||cap.s?`<figcaption><span>${lpEsc(cap.t||cap.s)}</span></figcaption>`:''}</figure>`};
  const cta=`<div class="pad"><a class="cta" href="#order">${lpEsc(page.cta||t.cta)}</a></div>`;
  const pair=k=>scenes[2*k]?scene(2*k)+scene(2*k+1)+cta:'';
  const features=(page.features||[]).length?`<section class="pad"><h2>${t.why}</h2><div class="feat">${page.features.map(f=>`<div><span>${lpEsc(f.icon||'⭐')}</span><b>${lpEsc(f.title)}</b><p>${lpEsc(f.text)}</p></div>`).join('')}</div></section>`:'';
  const problem=(page.problems||[]).length?`<section class="pad prob"><h2>${lpEsc(page.problem_title||t.problem)}</h2><ul>${page.problems.map(x=>`<li>${lpEsc(x)}</li>`).join('')}</ul>${page.solution?`<p class="sol">${lpEsc(page.solution)}</p>`:''}</section>`:'';
  // What the customer really buys: the result. Before/after rows, then the gains.
  const ba=page.before_after||[],gains=page.results||[];
  const gain=ba.length||gains.length?`<section class="pad gain"><h2>${lpEsc(page.results_title||t.gain)}</h2>${ba.length?`<div class="ba"><b class="bh">❌ ${t.before}</b><b class="ah">✅ ${t.after}</b>${ba.map(x=>`<span class="bb">${lpEsc(x.before)}</span><span class="aa">${lpEsc(x.after)}</span>`).join('')}</div>`:''}${gains.length?`<ul>${gains.map(x=>`<li>${lpEsc(x)}</li>`).join('')}</ul>`:''}</section>`:'';
  const faq=(page.faq||[]).length?`<section class="pad"><h2>${t.faq}</h2>${page.faq.map(f=>`<details><summary>${lpEsc(f.q)}</summary><p>${lpEsc(f.a)}</p></details>`).join('')}</section>`:'';
  // Final offer poster right before the form: product, "offer", the big price.
  const offerBox=poster?`<section class="offer"><p class="on">${n.icons[2]} ${lpEsc(page.product)}</p><h2>${t.offerT}</h2><p class="on">${t.sol}</p><p class="big">${money(page.price)}</p>${page.old_price?`<s>${money(page.old_price)}</s>`:''}${page.images[0]?`<img src="${lpEsc(img(page.images[0]))}" alt="${lpEsc(page.product)}" loading="lazy">`:''}<a class="cta" href="#order">${lpEsc(page.cta||t.cta)}</a></section>`:'';
  const body=`${poster?`<a class="top" href="#order">${n.icons[1]} ${t.delivery} · ${t.cod}</a>`:''}${gallery}<div class="pad"><h1>${lpEsc(page.headline||page.product)}</h1>${page.subheadline?`<p class="sub">${lpEsc(page.subheadline)}</p>`:''}
<div class="price"><b>${money(page.price)}</b>${page.old_price?`<s>${money(page.old_price)}</s>`:''}</div>
<div class="badges"><span>${n.icons[0]} ${t.cod}</span><span>${n.icons[1]} ${t.delivery}</span></div>
${page.bullets.length?`<ul class="b">${page.bullets.map(x=>`<li>${lpEsc(x)}</li>`).join('')}</ul>`:''}<a class="cta" href="#order">${lpEsc(page.cta||t.cta)}</a></div>
${poster?`${pair(0)}${problem}${pair(1)}${gain}${features}${pair(2)}${desc?`<section class="pad">${desc}</section>`:''}${scenes.slice(6).map((_,i)=>i%2?'':pair(3+i/2)).join('')}${faq}${offerBox}`
:`${problem}${scene(0)}${gain}${features}${scene(1)}${desc?`<section class="pad">${desc}</section>`:''}${scenes.slice(2).map((_,i)=>scene(i+2)).join('')}${faq}`}
<form id="order" method="post" action="${lpEsc(base)}/${page.slug}/order" novalidate><h2>${t.form}</h2>${Object.keys(errors).length?`<p class="alert" role="alert">${lpEsc(Object.values(errors)[0])}</p>`:''}
${offers}
<label for="f-name">${t.name}</label><input id="f-name" name="name" autocomplete="name" required maxlength="80" value="${v('name')}">${e('name')}
<label for="f-phone">${t.phone}</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" dir="ltr" value="${v('phone')}">${e('phone')}
<label for="f-city">${t.city}</label><input id="f-city" name="city" autocomplete="address-level2" required maxlength="60" value="${v('city')}">${e('city')}
${page.ask_address?`<label for="f-address">${t.address}</label><input id="f-address" name="address" autocomplete="street-address" required maxlength="200" value="${v('address')}">${e('address')}`:''}
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<button type="submit">${lpEsc(page.cta||t.cta)}</button></form>
${page.whatsapp?`<a class="wa" href="https://wa.me/${page.whatsapp}" target="_blank" rel="noopener">${t.wa}</a>`:''}
<div class="sticky"><a href="#order">${lpEsc(page.cta||t.cta)} · ${money(page.price)}</a></div>
<script>document.getElementById('order').addEventListener('submit',function(){var b=this.querySelector('button');setTimeout(function(){b.disabled=true;b.textContent=${lpJs(t.sending)}},0)})</script>`;
  return lpShell(page,page.headline||page.product,body,null,page.images[0]?base+'/img/'+page.images[0]:'');
}

// The thank-you page. With a stored order it fires the purchase event on the pixels.
export function lpRenderThanks(page,order){
  const t=LP_TEXT[page.lang]||LP_TEXT.ar;
  const body=`<div class="done"><div class="ok">✔</div><h1>${lpEsc(page.thanks||t.thanks)}</h1><p><a href="/${page.slug}">${t.back}</a></p></div>${page.whatsapp?`<a class="wa" href="https://wa.me/${page.whatsapp}" target="_blank" rel="noopener">${t.wa}</a>`:''}`;
  return lpShell(page,page.product,body,order?{id:order.id,data:{value:order.offer.price,currency:order.currency,content_name:page.product}}:null);
}
