const { chromium } = require('playwright'); const path=require('path'); const dir=__dirname;   // run from a folder holding these files + lilita.woff2 (design/fonts); writes the 3 covers
const page=(w,h,img,bgPos,bgSize,title)=>`<!doctype html><html><head><style>
@font-face{font-family:L;src:url(lilita.woff2)}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
.bg{position:absolute;inset:0;background:url(${img}) ${bgPos}/${bgSize} no-repeat}
.t{position:absolute;${title.pos};font-family:L;line-height:.92;text-align:center;transform:rotate(-4deg);transform-origin:center}
.t span{display:block;font-size:${title.size}px;letter-spacing:2px;-webkit-text-stroke:${title.size*0.11}px #1d1530;paint-order:stroke fill;
 text-shadow:0 ${title.size*0.07}px 0 #1d1530, 0 ${title.size*0.12}px ${title.size*0.12}px rgba(20,10,40,.35)}
.a{color:#fff}.b{color:#ffd23f}
</style></head><body><div class=bg></div><div class=t><span class=a>CLIFF</span><span class=b>EDGE</span></div></body></html>`;
(async()=>{const b=await chromium.launch();
 const jobs=[
  ['cover-landscape-1920x1080',1920,1080,'land.webp','left center','cover',{pos:'left:150px;top:150px',size:200}],
  ['cover-portrait-800x1200',800,1200,'port.webp','center bottom','cover',{pos:'left:0;right:0;top:70px',size:150}],
  ['cover-square-800x800',800,800,'land.webp','-262px center','auto 100%',{pos:'left:28px;top:36px',size:112}],
 ];
 for (const [name,w,h,img,pos,size,title] of jobs){ const p=await b.newPage({viewport:{width:w,height:h}});
  require('fs').writeFileSync(path.join(dir,name+'.html'),page(w,h,img,pos,size,title));
  await p.goto('file://'+path.join(dir,name+'.html')); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(dir,name+'.png')}); await p.close(); }
 await b.close();})();
