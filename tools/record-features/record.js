// Records looping product clips from the real speed. app for the website's feature cards.
// node record.js <scene|all> [probe]
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const FF=require('ffmpeg-static');const EXE=process.env.EXE;const APP='http://localhost:5199';
const OUT='/Users/kanyin/Documents/Claude/Projects/Speed (1)/speed-site/assets/media/features/';
const HC=JSON.parse(fs.readFileSync(path.join(__dirname,'handcoins.json'),'utf8'));
const W=1280,H=960;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// crop: css px region [x,y,w,h] at 4:3
const SCENES={
 customers:{route:'customers',crop:[296,30,880,660],act:async(p,c)=>{await c.hover(p,'text=Owing you');await sleep(500);await c.click(p,'text=Owing you');await sleep(1700);await c.click(p,'text=By segment');await sleep(1700);await c.click(p,'text=All customers');await sleep(1300);}},
 sales:{route:'messages',crop:[384,240,880,660],act:async(p,c)=>{await sleep(700);await c.hover(p,'text=/Create invoice/');await sleep(700);await c.click(p,'text=/Create invoice/');await sleep(1300);await c.hover(p,'text=Line items');await sleep(700);await c.hover(p,'text=/Asokoro Accent Chair/');await sleep(900);await c.hover(p,'text=Subtotal');await sleep(700);await c.hover(p,'text=/^Total$/');await sleep(1300);}},
 finance:{route:'payments',crop:[296,30,880,660],act:async(p,c)=>{await c.hover(p,'text=Kemi Bankole');await sleep(700);await c.hover(p,'text=Halima Sani');await sleep(700);await c.click(p,'text=Unmatched');await sleep(1800);await c.click(p,'text=All payments');await sleep(1500);}},
 'pricing-inventory':{route:'cost-of-sales',crop:[296,30,880,660],act:async(p,c)=>{await c.hover(p,'text=Lagos Lounge Sofa');await sleep(700);await c.click(p,'text=Low margin');await sleep(1800);await c.click(p,'text=All products');await sleep(1500);}},
 accounting:{route:'month-end',crop:[296,30,880,660],act:async(p,c)=>{await c.hover(p,'text=Issue all draft invoices');await sleep(800);await c.hover(p,'text=Post or void draft journals');await sleep(800);await c.hover(p,'text=Review profit & loss');await sleep(800);await c.hover(p,'text=Close & lock period');await sleep(1400);}},
 insights:{route:'',crop:[300,30,880,660],act:async(p,c)=>{await c.hover(p,'text=GROWTH');await sleep(800);await c.hover(p,'text=SALES');await sleep(800);await c.hover(p,'text=CUSTOMERS');await sleep(800);await c.wheel(p,0,420);await sleep(1600);await c.wheel(p,0,-420);await sleep(900);}},
 tax:{route:'reports/tax-summary',crop:[296,40,880,660],act:async(p,c)=>{await c.hover(p,'text=Output VAT (on sales)');await sleep(800);await c.hover(p,'text=Net payable to FIRS');await sleep(900);await c.click(p,'text=This month');await sleep(1500);await p.keyboard.press('Escape');await sleep(500);await c.hover(p,'text=Net VAT due this period');await sleep(1300);}},
 teaming:{route:'settings/team',crop:[400,50,880,660],act:async(p,c)=>{await sleep(400);await c.click(p,'text=Roles & permissions');await sleep(1700);await c.click(p,'text=DM assignment');await sleep(1700);await c.click(p,'text=Members');await sleep(1300);}},
};
// cursor helpers: move along a smooth path, then act
const cur={x:W*0.7,y:H*0.75};
async function moveTo(p,x,y,ms=500){const steps=Math.max(8,Math.round(ms/16));const sx=cur.x,sy=cur.y;for(let i=1;i<=steps;i++){const t=i/steps,e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;await p.mouse.move(sx+(x-sx)*e,sy+(y-sy)*e);await sleep(ms/steps);}cur.x=x;cur.y=y;}
async function centre(p,sel){const el=p.locator(sel).first();await el.waitFor({state:'visible',timeout:5000});const b=await el.boundingBox();return [b.x+Math.min(b.width/2,60),b.y+b.height/2];}
const C={hover:async(p,sel)=>{const [x,y]=await centre(p,sel);await moveTo(p,x,y);},
 click:async(p,sel)=>{const [x,y]=await centre(p,sel);await moveTo(p,x,y);await p.evaluate(()=>window.__ripple&&window.__ripple());await p.mouse.down();await sleep(90);await p.mouse.up();},
 wheel:async(p,dx,dy)=>{for(let i=0;i<10;i++){await p.mouse.wheel(dx/10,dy/10);await sleep(30);}}};
async function prep(p,route){
 await p.goto(APP+'/signin');await p.evaluate(()=>localStorage.setItem('speed.session','1'));
 await p.goto(APP+'/dashboard/'+route,{waitUntil:'networkidle'});await sleep(700);
 const off=p.getByText('Turn off Learn mode').first();if(await off.count()&&await off.isVisible()){await off.click();await sleep(300);}
 await p.goto(APP+'/dashboard/'+route,{waitUntil:'networkidle'});await sleep(900);
 await p.evaluate(({HC})=>{
  // Deck rules for screens: the money item reads "Money" with the hand-coins icon; no provider brands or bank wording.
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const swaps=[[/^Banking$/,'Money'],[/Flutterwave|Paystack|Monnify|Moniepoint|Opay|Kuda/g,'Payment link'],[/Bank Transfer/g,'Transfer'],[/Reconcile all bank accounts/,'Reconcile all accounts'],[/Bank charges & transfer fees/,'Transfer fees']];
  let n;while(n=walk.nextNode()){for(const [a,b] of swaps){if(a.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(a,b);}}
  const lab=[...document.querySelectorAll('nav *, aside *')].find(e=>e.childElementCount===0&&e.textContent.trim()==='Money');
  if(lab){const btn=lab.closest('a,button')||lab.parentElement;const svg=btn&&btn.querySelector('svg');if(svg){svg.innerHTML=HC.map(([t,a])=>'<'+t+' '+Object.entries(a).map(([k,v])=>k+'="'+v+'"').join(' ')+'/>').join('');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');}}
  // Hide floating learn button and toasts
  const st=document.createElement('style');st.textContent='[class*="learn"] , .fixed.bottom-4.right-4 {} ';document.head.appendChild(st);
  // Drawn cursor with click ripple
  const c=document.createElement('div');c.id='__cur';c.innerHTML='<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 20 L7 15.5 L10.5 23 L13.5 21.6 L10 14.3 L17 14 Z" fill="#1D1D1F" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  Object.assign(c.style,{position:'fixed',left:'0',top:'0',zIndex:2147483647,pointerEvents:'none',transform:'translate(-100px,-100px)',filter:'drop-shadow(0 2px 3px rgba(0,0,0,.25))'});document.body.appendChild(c);
  const r=document.createElement('div');Object.assign(r.style,{position:'fixed',width:'36px',height:'36px',margin:'-18px 0 0 -18px',borderRadius:'50%',background:'rgba(212,246,79,.55)',zIndex:2147483646,pointerEvents:'none',opacity:'0',transform:'scale(.3)',transition:'transform 380ms cubic-bezier(.22,1,.36,1), opacity 380ms ease'});document.body.appendChild(r);
  let lx=0,ly=0;document.addEventListener('mousemove',e=>{lx=e.clientX;ly=e.clientY;c.style.transform='translate('+(lx-2)+'px,'+(ly-2)+'px)';},true);
  window.__ripple=()=>{r.style.transition='none';r.style.left=lx+'px';r.style.top=ly+'px';r.style.opacity='1';r.style.transform='scale(.3)';void r.offsetWidth;r.style.transition='transform 380ms cubic-bezier(.22,1,.36,1), opacity 380ms ease';r.style.transform='scale(1.4)';r.style.opacity='0';};
 },{HC});
 // remove the floating learn-mode book button in the bottom-right corner
 await p.evaluate(()=>{for(const el of document.querySelectorAll('button,div')){const r=el.getBoundingClientRect();if(r.width<70&&r.height<70&&r.width>30&&r.right>innerWidth-80&&r.bottom>innerHeight-80&&getComputedStyle(el).position==='fixed')el.style.display='none';}});
}
async function record(name,probe){
 const s=SCENES[name];cur.x=W*0.7;cur.y=H*0.8;
 const b=await chromium.launch({executablePath:EXE});const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await prep(p,s.route);await p.mouse.move(cur.x,cur.y);await sleep(300);
 if(probe){fs.mkdirSync(path.join(__dirname,".rec"),{recursive:true});await p.screenshot({path:path.join(__dirname,`.rec/probe-${name}-0.png`)});await s.act(p,C);await p.screenshot({path:path.join(__dirname,`.rec/probe-${name}-1.png`)});await b.close();console.log(name,'probe',errs.join(';')||'ok');return;}
 const cdp=await ctx.newCDPSession(p);const frames=[];
 cdp.on('Page.screencastFrame',async f=>{frames.push({t:f.metadata.timestamp,d:f.data});try{await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId})}catch(e){}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:W*2,maxHeight:H*2,everyNthFrame:1});
 await sleep(600);const t0=Date.now()/1000;await s.act(p,C);await sleep(200);const t1=Date.now()/1000;
 await cdp.send('Page.stopScreencast');await b.close();
 // frames -> concat list with durations
 const dir=path.join(__dirname,'.rec',name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
 const fr=frames.filter(f=>f.t>=t0-0.25);if(!fr.length)throw new Error('no frames '+name);
 const start=fr[0].t;let list='';fr.forEach((f,i)=>{const fn=`f${String(i).padStart(4,'0')}.jpg`;fs.writeFileSync(path.join(dir,fn),Buffer.from(f.d,'base64'));const next=i<fr.length-1?fr[i+1].t:t1;list+=`file '${fn}'\nduration ${Math.max(0.001,next-f.t).toFixed(4)}\n`;});
 list+=`file 'f${String(fr.length-1).padStart(4,'0')}.jpg'\n`;fs.writeFileSync(path.join(dir,'list.txt'),list);
 const D=t1-start;const [cx,cy,cw,ch]=s.crop.map(v=>v);
 const base=`[0:v]fps=30,crop=${cw}:${ch}:${cx}:${cy},scale=880:660:flags=lanczos,format=yuv420p,setsar=1[v];[1:v]crop=${cw}:${ch}:${cx}:${cy},scale=880:660:flags=lanczos,format=yuva420p,fade=in:st=${(D-0.5).toFixed(2)}:d=0.5:alpha=1[f];[v][f]overlay=shortest=1:format=auto[o]`;
 fs.mkdirSync(OUT,{recursive:true});
 const first=path.join(dir,'f0000.jpg');
 const common=['-y','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-loop','1','-t',D.toFixed(2),'-i',first];
 execFileSync(FF,[...common,'-filter_complex',base,'-map','[o]','-t',D.toFixed(2),'-an','-c:v','libx264','-preset','slow','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',OUT+name+'.mp4'],{stdio:'ignore'});
 execFileSync(FF,['-y','-i',OUT+name+'.mp4','-an','-c:v','libvpx-vp9','-b:v','0','-crf','38','-row-mt','1','-deadline','good',OUT+name+'.webm'],{stdio:'ignore'});
 execFileSync(FF,['-y','-i',first,'-vf',`crop=${cw}:${ch}:${cx}:${cy},scale=880:660:flags=lanczos`,'-c:v','libwebp','-quality','82',OUT+name+'-poster.webp'],{stdio:'ignore'});
 execFileSync(FF,['-y','-i',OUT+name+'.mp4','-vf','fps=12,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',OUT+name+'.gif'],{stdio:'ignore'});
 const kb=f=>Math.round(fs.statSync(OUT+f).size/1024);
 console.log(name,D.toFixed(1)+'s',frames.length+'f','mp4',kb(name+'.mp4'),'webm',kb(name+'.webm'),'gif',kb(name+'.gif'),'poster',kb(name+'-poster.webp'),errs.join(';')||'');
}
(async()=>{const a=process.argv[2]||'all';const probe=process.argv[3]==='probe';for(const n of (a==='all'?Object.keys(SCENES):a.split(',')))await record(n,probe);})().catch(e=>{console.error(e.message);process.exit(1)});
