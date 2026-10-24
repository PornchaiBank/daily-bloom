/* Google access tokens remain in memory; only public setup is stored locally. */
const WandeeCloud=(()=>{
 const configKey='wandee-google-config-v1',tabName='WandeeSales_v1';
 const headers=['record_id','event_id','saved_at','วันที่ขาย','สินค้า','จำนวนซื้อ','หน่วยซื้อ','ต้นทุนซื้อ','ค่าใช้จ่ายเพิ่ม','ทำได้_กำ','ราคาขายต่อกำ','เหลือ_กำ','ขายได้_กำ','ยอดขาย','ต้นทุนรวม','กำไรขาดทุน','หมายเหตุ'];
 const scope='https://www.googleapis.com/auth/spreadsheets';
 let token='',expiresAt=0,config=null,sheetName='',ready=false,requestBusy=false;
 try{config=JSON.parse(localStorage.getItem(configKey)||'null')}catch{}
 function getConfig(){return config}
 function disconnect(){token='';expiresAt=0;ready=false}
 function configured(){return !!config?.clientId&&!!config?.sheetId}
 function saveConfig(clientId,url){
  clientId=clientId.trim();const match=url.trim().match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/);
  if(!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error('กรุณาใส่ OAuth Client ID ที่ลงท้าย .apps.googleusercontent.com');
  if(!match)throw Error('กรุณาใส่ลิงก์ Google Sheet แบบ https://docs.google.com/spreadsheets/d/…');
  const next={clientId,sheetId:match[1]};localStorage.setItem(configKey,JSON.stringify(next));config=next;disconnect();
 }
 async function api(path,method='GET',body){
  if(!token||Date.now()>=expiresAt){disconnect();throw Error('หมดเวลาเชื่อมต่อ กรุณาเข้าสู่ระบบ Google อีกครั้ง ข้อมูลที่กรอกยังอยู่')}
  let res;try{res=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.sheetId)+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(25000)})}catch{throw Error('การเชื่อมต่อขัดข้อง หากกดบันทึกแล้วให้กดอีกครั้งเพื่อตรวจสอบผลก่อนส่งซ้ำ')}
  const data=await res.json().catch(()=>({}));
  if(!res.ok){if(res.status===401){disconnect();throw Error('สิทธิ์หมดอายุ กรุณาเข้าสู่ระบบ Google อีกครั้ง')}if(res.status===403)throw Error('Google ไม่อนุญาต: ตรวจสิทธิ์แก้ไขชีต การอนุญาตบัญชี และการเปิด Google Sheets API');if(res.status===404)throw Error('ไม่พบชีต หรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง');if(res.status===429)throw Error('Google จำกัดคำขอชั่วคราว กรุณารอสักครู่แล้วลองใหม่');throw Error('Google Sheets ตอบกลับข้อผิดพลาด '+res.status+' กรุณาตรวจการตั้งค่า')}
  return data;
 }
 async function metadata(){const d=await api('?fields=properties(title),sheets(properties(sheetId,title))');sheetName=d.properties?.title||'';return d}
 function parseRows(values){
  if(!values?.length||headers.some((h,i)=>values[0]?.[i]!==h))throw Error('โครงสร้างแท็บข้อมูลไม่ตรงกับเว็บ กรุณาใช้แท็บ WandeeSales_v1 ที่เว็บสร้าง');
  if(values.length>=10001)throw Error('แท็บมีข้อมูลถึงขีดจำกัดการอ่าน กรุณาติดต่อเพื่อขยายก่อนบันทึกเพิ่ม');
  let latest=new Map(),events=new Set();
  for(const v of values.slice(1)){if(!v.some(x=>x!==''&&x!=null))continue;
   const r={id:String(v[0]||''),_version:String(v[1]||''),date:String(v[3]||''),product:String(v[4]||''),buyqty:v[5]===''?null:Number(v[5]),buyunit:String(v[6]||'ดอก'),cost:Number(v[7]),extra:Number(v[8]),made:Number(v[9]),price:Number(v[10]),left:Number(v[11]),memo:String(v[16]||'')};
   if(!r.id||!r._version||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date+'T12:00:00Z'))||!r.product||[r.cost,r.extra,r.made,r.price,r.left].some(x=>!Number.isFinite(x)||x<0)||r.made<1||r.left>r.made||!Number.isInteger(r.made)||!Number.isInteger(r.left))throw Error('พบรายการในชีตที่ไม่ถูกต้อง กรุณาตรวจข้อมูลก่อนใช้ยอดรวม');
   latest.set(r.id,r);events.add(r._version);
  }
  return{rows:[...latest.values()],events};
 }
 async function read(){if(!ready)throw Error('ยังไม่พร้อมอ่านข้อมูล กรุณาเชื่อมต่อ Google Sheets');const d=await api('/values/'+encodeURIComponent("'"+tabName+"'!A1:Q10001")+'?valueRenderOption=UNFORMATTED_VALUE');return parseRows(d.values)}
 function authorize(){
  if(!configured()){openSetup();return}
  if(!globalThis.google?.accounts?.oauth2){toast('กำลังโหลดบริการ Google กรุณารอสักครู่แล้วกดอีกครั้ง หรือเปิดเว็บใน Chrome/Safari');return}
  const client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope,include_granted_scopes:false,error_callback:()=>{toast('ยังไม่ได้เข้าสู่ระบบ Google กรุณาเปิดหน้าต่างอนุญาตแล้วลองอีกครั้ง')},callback:async r=>{
   if(r.error||!r.access_token){toast('Google ยังไม่อนุญาตการเชื่อมต่อ');return}
   if(!google.accounts.oauth2.hasGrantedAllScopes(r,scope)){toast('กรุณาอนุญาตสิทธิ์ Google Sheets เพื่ออ่านและบันทึก');return}
   token=r.access_token;expiresAt=Date.now()+(Number(r.expires_in)||3600)*1000-60000;ready=false;
   try{const m=await metadata();if(!m.sheets?.some(s=>s.properties.title===tabName)){openSetup();$('initmessage').textContent='เชื่อมบัญชีแล้ว: '+sheetName+' — ยังไม่มีแท็บข้อมูลสำหรับเว็บ';$('initarea').hidden=false;return}ready=true;const result=await read();await activateCloud(result.rows,sheetName)}catch(e){showCloudError(e)}
  }});client.requestAccessToken({prompt:'select_account'});
 }
 async function initialize(){
  if(requestBusy)return;requestBusy=true;
  try{const m=await metadata();if(!m.sheets?.some(s=>s.properties.title===tabName)){
   let sid=100000+Math.floor(Math.random()*900000000);while(m.sheets?.some(s=>s.properties.sheetId===sid))sid++;
   const profitRange={sheetId:sid,startRowIndex:1,startColumnIndex:15,endColumnIndex:16};
   const profitRule=(index,type,color)=>({addConditionalFormatRule:{index,rule:{ranges:[profitRange],booleanRule:{condition:{type,values:[{userEnteredValue:'0'}]},format:{textFormat:{foregroundColor:color}}}}}});
   const requests=[
    {addSheet:{properties:{sheetId:sid,title:tabName,gridProperties:{rowCount:10001,columnCount:17,frozenRowCount:1}}}},
    {updateCells:{range:{sheetId:sid,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:17},rows:[{values:headers.map(h=>({userEnteredValue:{stringValue:h}}))}],fields:'userEnteredValue'}},
    {repeatCell:{range:{sheetId:sid,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:.13,green:.3,blue:.24},textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},
    {repeatCell:{range:profitRange,cell:{userEnteredFormat:{numberFormat:{type:'NUMBER',pattern:'+#,##0.00;[Red]-#,##0.00;0.00'}}},fields:'userEnteredFormat.numberFormat'}},
    profitRule(0,'NUMBER_LESS',{red:.8,green:.2,blue:.2}),profitRule(1,'NUMBER_GREATER',{red:.15,green:.45,blue:.25})
   ];
   await api(':batchUpdate','POST',{requests});
  }ready=true;const r=await read();await activateCloud(r.rows,sheetName);toast('สร้างแท็บและเชื่อม Google Sheets สำเร็จ')
  }finally{requestBusy=false}
 }
 function pendingKey(){return 'wandee-pending-'+config.sheetId}
 async function save(record,baseVersion){
  if(!ready)throw Error('กรุณาเชื่อมต่อ Google Sheets ก่อนบันทึก');
  let pending=null;try{pending=JSON.parse(sessionStorage.getItem(pendingKey())||'null')}catch{}
  const before=await read();
  if(pending){if(before.events.has(pending.eventId)){sessionStorage.removeItem(pendingKey());return before.rows}if(JSON.stringify(pending.record)!==JSON.stringify(record))throw Error('มีรายการรอตรวจสอบจากการบันทึกครั้งก่อน กรุณาเชื่อมต่อใหม่เพื่อตรวจสอบผล');record=pending.record;baseVersion=pending.baseVersion}
  const current=before.rows.find(x=>x.id===record.id);
  if((current?._version||null)!==(baseVersion||null))throw Error('รายการนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณาดึงข้อมูลล่าสุดแล้วเปิดรายการใหม่');
  const eventId=pending?.eventId||crypto.randomUUID(),sold=record.made-record.left,revenue=Math.round(sold*record.price*100)/100,cost=Math.round((record.cost+record.extra)*100)/100;
  pending=pending||{eventId,record,baseVersion};sessionStorage.setItem(pendingKey(),JSON.stringify(pending));
  const values=[[record.id,eventId,new Date().toISOString(),record.date,record.product,record.buyqty??'',record.buyunit,record.cost,record.extra,record.made,record.price,record.left,sold,revenue,cost,Math.round((revenue-cost)*100)/100,record.memo]];
  const result=await api('/values/'+encodeURIComponent("'"+tabName+"'!A:Q")+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{majorDimension:'ROWS',values});
  if(result.updates?.updatedRows!==1)throw Error('ยังยืนยันการบันทึกไม่ได้ กรุณาตรวจข้อมูลล่าสุดก่อนทำรายการอื่น');
  sessionStorage.removeItem(pendingKey());const next={...record,_version:eventId};return before.rows.filter(x=>x.id!==record.id).concat(next);
 }
 async function recoverPending(){let p;try{p=JSON.parse(sessionStorage.getItem(pendingKey())||'null')}catch{}if(!p)return null;const before=await read();if(before.events.has(p.eventId)){sessionStorage.removeItem(pendingKey());return null}return p}
 return{getConfig,saveConfig,configured,authorize,initialize,read,save,disconnect,recoverPending,parseRows,get name(){return sheetName},get ready(){return ready}};
})();
function openSetup(){const c=WandeeCloud.getConfig();$('clientid').value=c?.clientId||'';$('sheeturl').value=c?.sheetId?'https://docs.google.com/spreadsheets/d/'+c.sheetId+'/edit':'';$('originlabel').textContent=location.origin;$('setuperror').hidden=true;if(!$('setupDialog').open)$('setupDialog').showModal()}
function showCloudError(e){const msg=e?.message||'เชื่อมต่อไม่สำเร็จ';if(appMode==='cloud'){cloudUi();$('datasource').textContent='ดึงข้อมูลไม่สำเร็จ • ข้อมูลที่แสดงอาจยังไม่ล่าสุด'}toast(msg);if($('setupDialog').open){$('setuperror').hidden=false;$('setuperror').textContent=msg}}
function saveSetup(){if(appMode==='cloud'){showCloudError(Error('ออกจากระบบก่อนเปลี่ยนชีต เพื่อแยกข้อมูลแต่ละร้าน'));return}try{WandeeCloud.saveConfig($('clientid').value,$('sheeturl').value);$('initarea').hidden=true;$('loginstatus').textContent='ตั้งค่าแล้ว • กดเข้าสู่ระบบ Google เพื่อเชื่อมต่อ';toast('บันทึกการตั้งค่าแล้ว กรุณากดเข้าสู่ระบบ Google')}catch(e){showCloudError(e)}}
function googleLogin(){if(saving){toast('กำลังบันทึก กรุณารอผลก่อน');return}WandeeCloud.authorize()}
async function initializeCloudSheet(){$('initbtn').disabled=true;try{await WandeeCloud.initialize()}catch(e){showCloudError(e)}finally{$('initbtn').disabled=false}}
async function activateCloud(data,name){
 const pending=await WandeeCloud.recoverPending();
 if(appMode==='demo'){dirty=false;editId=null;draftId=null;$('saleform').reset()}
 appMode='cloud';rows=data;$('setupDialog').close();$('initarea').hidden=true;$('login').hidden=true;$('app').hidden=false;document.body.classList.remove('login-screen');cloudUi();
 if(pending){const r=pending.record;for(const k of ['product','cost','buyqty','buyunit','extra','memo','made','price','left'])$(k).value=r[k]??'';$('entrydate').value=r.date;editId=pending.baseVersion?r.id:null;draftId=r.id;editVersion=pending.baseVersion;dirty=true;setStep(2);page('record');toast('มีรายการที่ยังยืนยันผลไม่ได้ กดบันทึกเพื่อตรวจสอบก่อนส่งซ้ำ');return}
 page(dirty?'record':'home');toast('เชื่อมต่อแล้ว: '+name)
}
function cloudUi(){const live=appMode==='cloud';document.querySelector('.demobadge').textContent=live?'Google Sheets':'โหมดทดลอง';$('datasource').textContent=live?'ข้อมูลจาก Google Sheets • '+WandeeCloud.name:'◌ ข้อมูลเก็บในเครื่องนี้ • ยังไม่ส่ง Google Sheets';$('savehint').textContent=live?'บันทึกตรงไปยัง Google Sheets':'ข้อมูลยังไม่ส่งไป Google Sheets';$('refreshcloud').hidden=!live;$('accountmode').textContent=live?'ใช้งาน Google Sheets จริง':'บัญชีทดลอง';$('cloudstatus').textContent=live?(WandeeCloud.ready?'เชื่อมต่อแล้ว':'กรุณาเชื่อมต่อใหม่'):'ยังไม่เชื่อมต่อ';$('cloudexplain').textContent=live?'ไฟล์: '+WandeeCloud.name+' · แท็บ WandeeSales_v1 เก็บประวัติแต่ละเวอร์ชัน เว็บแสดงเฉพาะรายการล่าสุด ข้อมูลตัวอย่างไม่ถูกส่งไปด้วย':'ข้อมูลทดลองเก็บในเครื่องนี้ ข้อมูลจริงอ่านและบันทึกตรงไปยังชีตที่คุณเลือก';$('savebtn').textContent=live?'✓ บันทึกลง Google Sheets':editId?'✓ บันทึกการแก้ไข':'✓ บันทึกรายการทดลอง'}
async function refreshCloud(){if(saving)return;try{const data=await WandeeCloud.read();rows=data.rows;cloudUi();renderHome();if(currentPage==='history')renderHistory();toast('ดึงข้อมูลล่าสุดแล้ว')}catch(e){showCloudError(e)}}
