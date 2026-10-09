// Render the real Vue template and CSS with sample telemetry at 4x resolution.
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source=path.join(root,'mods/CompanionWeightBalance/ui/modules/apps/CompanionWeightBalance')
const sfc=await readFile(path.join(source,'app.vue'),'utf8')
const template=sfc.match(/<template>([\s\S]*?)<\/template>/)[1]
const style=sfc.match(/<style scoped>([\s\S]*?)<\/style>/)[1]
const script=sfc.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import[^\n]*\n/gm,'')
const balance=(await readFile(path.join(source,'balance.js'),'utf8')).replace('export function','function')
const require=createRequire(import.meta.url)
const vue=await readFile(require.resolve('vue/dist/vue.global.prod.js'),'utf8')
const metadata=JSON.parse(await readFile(path.join(source,'app.json'),'utf8'))
const width=parseInt(metadata.css.width),height=parseInt(metadata.css.height)
const rows=Object.entries({FL:1638,FR:1796,RL:1855,RR:1721}).map(([name,force])=>{
  const row=Array(15).fill(0);row[0]=name;row[7]=force;row[14]='wheel';return row
})
const streams={wheelInfo:rows,sensors:{gravity:-9.815}}
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
  html,body { margin:0; width:${width}px; height:${height}px; overflow:hidden; background:transparent; }
  #app { width:100%; height:100%; }
  ${style}
  </style></head><body><div id="app"></div><script>${vue}</script><script>
  const { shallowRef }=Vue;
  ${balance}
  function useStreams(names,callback){ callback(${JSON.stringify(streams)}) }
  Vue.createApp({template:${JSON.stringify(template)},setup(){
    ${script}
    return {names,state,percent,kg};
  }}).mount('#app');
  </script></body></html>`

// A separate headless browser profile; no user's tabs, cookies or game session.
const browser=await chromium.launch(process.env.RENDER_CHROMIUM_PATH
  ? {headless:true,executablePath:process.env.RENDER_CHROMIUM_PATH}
  : {headless:true,channel:process.env.RENDER_BROWSER || 'msedge'})
try {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:4})
  const errors=[];page.on('pageerror',error=>errors.push(String(error)))
  await page.setContent(html)
  await page.waitForSelector('.readings em')
  await page.evaluate(()=>document.fonts.ready)
  if(errors.length)throw new Error(errors.join('\n'))
  const output=path.join(root,'docs/images/weight-balance-hires.png')
  await mkdir(path.dirname(output),{recursive:true})
  await page.screenshot({path:output,omitBackground:true})
  console.log(`Rendered actual widget source: ${width*4} x ${height*4} pixels`)
} finally { await browser.close() }
