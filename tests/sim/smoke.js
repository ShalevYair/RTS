const Sim=require('../load-sim.js')();
// blue bot = old naive AI (nearest point, air hunts first tank)
function blueBot(s){const taken=new Set();const bl=s.squads.filter(q=>q.side==='blue'&&!q.dead&&!q.retreating);
 for(const sq of bl.filter(q=>q.type!=='air')){let best=null,bs=1e9;for(const p of s.points){let sc=Math.hypot(sq.cx-p.x,sq.cy-p.y);if(p.owner==='blue'&&!p.contested)sc+=350;if(taken.has(p))sc+=200;if(sc<bs){bs=sc;best=p;}}
  taken.add(best);const t=best.owner==='blue'&&!best.contested?'hold':'attack';if(sq.order.x!==best.x||sq.order.y!==best.y||sq.order.type!==t)Sim.order(s,sq.id,t,best.x,best.y,true);}
 for(const sq of bl.filter(q=>q.type==='air')){const prey=s.squads.find(q=>q.side==='red'&&!q.dead&&q.type==='tank');let tgt=prey?{x:prey.cx,y:prey.cy}:null;
  if(!tgt){let bs=1e9;for(const p of s.points){if(p.owner==='blue'&&!p.contested)continue;const d=Math.hypot(sq.cx-p.x,sq.cy-p.y);if(d<bs){bs=d;tgt=p;}}}
  if(tgt)Sim.order(s,sq.id,'attack',tgt.x,tgt.y,true);}}
const N=+process.argv[2]||20;
for(const diff of ['easy','normal','hard']){let w={blue:0,red:0,none:0},T=0,t0=Date.now();
 for(let i=0;i<N;i++){const s=Sim.create(1000+i,[800,1100,1400][i%3],diff);let bi=0;
  while(!s.over&&s.t<1500){Sim.step(s,1/30);if((bi-=1/30)<=0){blueBot(s);bi=10;}}
  w[s.over||'none']++;T+=s.t;}
 console.log(diff.padEnd(7),'red(AI) wins',w.red,'/',N,' blue',w.blue,' draw',w.none,' avg len',Math.round(T/N)+'s',(Date.now()-t0)+'ms');}
// edge cases
const s=Sim.create(1,1000,'bogus');console.log('bad diff ->',s.diff);
Sim.step(s,0);Sim.step(s,-1);Sim.step(s,NaN);console.log('t after bad dt',s.t);
for(const sq of s.squads)if(sq.side==='red')s.units=s.units.filter(u=>u.squad!==sq.id);s.noReinforce=true;
for(let i=0;i<400;i++)Sim.step(s,1/30);console.log('no red units ok, t=',s.t.toFixed(1),'ai ran',s.aiIn>0);
const s2=Sim.create(2,1000,'hard');for(const sq of s2.squads)if(sq.side==='blue')s2.units=s2.units.filter(u=>u.squad!==sq.id);s2.noReinforce=true;
for(let i=0;i<30*60;i++)Sim.step(s2,1/30);console.log('no blue units: red score',Math.round(s2.score.red));
