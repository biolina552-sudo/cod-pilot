// Read-only reporting uses the same encrypted, owner-scoped Meta connection as asset discovery.
async function monitorList(env,token,path,params){let items=[],after;for(let i=0;i<10;i++){const d=await metaGraph(env,token,path,{...params,limit:100,...(after?{after}:{})});if(!Array.isArray(d.data))throw Error('META_ASSET_ACCESS');items.push(...d.data);after=d.paging?.next?d.paging?.cursors?.after:null;if(!after)return {items,incomplete:false}}return {items,incomplete:true}}
function monitorNumber(v){return v!==undefined&&v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):null}
function monitorAction(items,types){for(const type of types){const item=Array.isArray(items)?items.find(a=>a.action_type===type):null;if(item)return monitorNumber(item.value)}return null}
async function personalMetaMonitor(request,env,user){
if(!user)return json({success:false,error:'UNAUTHENTICATED'},401);
if(request.method!=='POST')return json({success:false,error:'METHOD_NOT_ALLOWED'},405);
if(request.headers.get('origin')!==new URL(request.url).origin)return json({success:false,error:'FORBIDDEN'},403);
if(Number(request.headers.get('content-length')||0)>2048)return json({success:false,error:'INVALID_BRIEF'},400);
try{
const b=await request.clone().json(),connections=await metaConnections(env,user);if(!connections.connections.length&&!b.connection_id)return null;
if(typeof b.connection_id!=='string'||!/^\d+$/.test(b.connection_id))return json({success:false,error:'INVALID_BRIEF'},400);
const c=connections.connections.find(c=>c.id===b.connection_id);if(!c)return json({success:false,error:'META_ASSET_ACCESS'},403);
if(c.expires_at<=Date.now())return json({success:false,error:'META_RECONNECT'},401);
const account=String(b.account||'').replace(/^act_/,'');if(!/^\d+$/.test(account))return json({success:false,error:'INVALID_BRIEF'},400);
const permitted=await metaList(env,c.token,'me/adaccounts','id,name,currency,timezone_name');const a=permitted.items.find(a=>String(a.id).replace(/^act_/,'')===account);if(!a)return json({success:false,error:'META_ASSET_ACCESS'},403);
const [campaigns,insights]=await Promise.all([
monitorList(env,c.token,'act_'+account+'/campaigns',{fields:'id,name,status,effective_status,objective,daily_budget,lifetime_budget'}),
monitorList(env,c.token,'act_'+account+'/insights',{level:'campaign',date_preset:'last_7d',fields:'campaign_id,spend,impressions,reach,frequency,inline_link_clicks,cpm,inline_link_click_ctr,cost_per_inline_link_click,actions,action_values,date_start,date_stop'})]);
const metrics=new Map(insights.items.map(r=>[String(r.campaign_id),r]));const purchaseTypes=['offsite_conversion.fb_pixel_purchase','omni_purchase','purchase'];
return json({success:true,read_only:true,source:'facebook_login',connection_id:c.id,account_id:account,account_name:String(a.name||account),timezone:a.timezone_name||null,date_preset:'last_7d',generated_at:new Date().toISOString(),incomplete:campaigns.incomplete||insights.incomplete,campaigns:campaigns.items.filter(r=>/^\d+$/.test(String(r.id))).map(r=>{const m=metrics.get(String(r.id))||{},spend=monitorNumber(m.spend),purchases=monitorAction(m.actions,purchaseTypes),value=monitorAction(m.action_values,purchaseTypes);return {campaign_id:String(r.id),account_id:account,name:String(r.name||r.id).slice(0,250),status:r.effective_status||r.status||null,objective:r.objective||null,currency:a.currency||null,daily_budget_minor_units:monitorNumber(r.daily_budget),lifetime_budget_minor_units:monitorNumber(r.lifetime_budget),spend,impressions:monitorNumber(m.impressions),reach:monitorNumber(m.reach),frequency:monitorNumber(m.frequency),link_clicks:monitorNumber(m.inline_link_clicks),cpm:monitorNumber(m.cpm),link_ctr:monitorNumber(m.inline_link_click_ctr),link_cpc:monitorNumber(m.cost_per_inline_link_click),reported_purchases:purchases,reported_purchase_value:value,cpa:purchases>0&&spend!==null?spend/purchases:null,roas:spend>0&&value!==null?value/spend:null,landing_page_views:monitorAction(m.actions,['landing_page_view']),add_to_cart:monitorAction(m.actions,['offsite_conversion.fb_pixel_add_to_cart','omni_add_to_cart','add_to_cart']),initiate_checkout:monitorAction(m.actions,['offsite_conversion.fb_pixel_initiate_checkout','omni_initiated_checkout','initiate_checkout']),date_start:m.date_start||null,date_stop:m.date_stop||null,has_insights:metrics.has(String(r.id))}})})
}catch(e){return json({success:false,error:e.message==='META_RECONNECT'?'META_RECONNECT':'META_ASSET_ACCESS'},502)}
}
