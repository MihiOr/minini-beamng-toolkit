import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const vue=await fs.readFile(require.resolve('vue/dist/vue.global.prod.js'),'utf8');
const e={companionRCControlValid:1,companionWantedRC:10,companionEstimatedRC:8.7,companionRCError:1.3,companionWantedRS:30,companionEstimatedRS:28.4,companionRSError:1.6,companionVectoringState:1,companionWheelCorrectionValid:1,companionBrakePedal:0,companionAcceleratorPedal:.65,companionPedalRequest:.65,companionRequestedYawMoment:820,companionAllocatedYawMoment:745};
for(const [n,share,motor,grip] of [['FL',.31,-.18,.76],['FR',.22,.13,.68],['RL',.29,-.16,.82],['RR',.18,.11,.63]]){
 Object.assign(e,{[`companionTV${n}Share`]:share,[`companionTV${n}MotorUse`]:motor,[`companionTV${n}GripUse`]:grip,[`companionTV${n}TorqueNm`]:motor*740,[`companionTV${n}DeltaNm`]:motor*740,[`companionTV${n}YawMomentNm`]:share*745,[`companionTV${n}MotorLimitNm`]:740,[`companionTV${n}GripLimitNm`]:600,[`companionTV${n}LongitudinalSlip`]:grip});
}
const configs=[{id:'MiTVSDebug',folder:'MininiYawControl',helper:'readings.js',output:'mitvs-debug-hires.png',width:760,height:340,bindings:'rcRows,state,wheels,pedals,pedalRows,wheelNames,percent,percentAbs,signedPercent,wheelTitle,signed',mock:`function useStreams(names,cb){cb(${JSON.stringify({electrics:e})})}`},{id:'MininiTestBench',folder:'MininiTestBench',helper:'form.js',output:'minini-test-bench-hires.png',width:430,height:730,bindings:'form,state,names,averageYaw,averageRC,steeringLock,error,running,start,stop',mock:`function useBridge(){return {api:{engineLua(){}}}};function useEvents(){return {on(name,cb){cb({phase:'running',speed:50,rotationSpeed:50,estimatedRotationSpeed:49.4,wantedRotationSpeed:30,yawRate:22.5,rcDistance:35.4,steeringLock:480,torques:{FL:200,FR:50,RL:200,RR:50}})},off(){}}}`}];
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const c of configs){
  const source=path.join(root,'mods',c.id,'ui/modules/apps',c.folder);
  const sfc=await fs.readFile(path.join(source,'app.vue'),'utf8');
  const template=sfc.match(/<template>([\s\S]*?)<\/template>/)[1];
  const style=[...sfc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
  let script=sfc.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import[^\n]*\n/gm,'');
  if(c.id==='MininiTestBench')script=script.replace("mode:'exact',FL:'0',FR:'0',RL:'0',RR:'0',steering:'0',runup:false,speed:'50'","mode:'additional',FL:'100',FR:'-50',RL:'100',RR:'-50',steering:'120',runup:true,speed:'50'");
  const helper=(await fs.readFile(path.join(source,c.helper),'utf8')).replace(/export /g,'');
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${c.width}px;height:${c.height}px;background:transparent}#app{width:100%;height:100%}${style}</style></head><body><div id="app"></div><script>${vue}</script><script>const {shallowRef,reactive,ref,computed,watch,onMounted,onUnmounted}=Vue;${helper};${c.mock};Vue.createApp({template:${JSON.stringify(template)},setup(){${script};return {${c.bindings}}}}).mount('#app')</script></body></html>`;
  const page=await browser.newPage({viewport:{width:c.width,height:c.height},deviceScaleFactor:4});const errors=[];page.on('pageerror',err=>errors.push(String(err)));await page.setContent(html);await page.evaluate(()=>document.fonts.ready);await page.waitForSelector(c.id==='MiTVSDebug'?'.wheel-name':'.mode-buttons');if(errors.length)throw new Error(errors.join('\n'));
  await fs.mkdir(path.join(root,'docs/images'),{recursive:true});await page.screenshot({path:path.join(root,'docs/images',c.output),omitBackground:true});console.log(`Rendered ${c.id}: ${c.width*4} x ${c.height*4}`);await page.close();
 }
}finally{await browser.close()}
