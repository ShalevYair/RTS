const loadSim=require('../load-sim.js');
const Sim=loadSim();
function blueBot(s){const taken=new Set();const vis=q=>!s.vis||s.squads.filter(x=>x.side==='red').includes(q);
 const bl=s.squads.filter(q=>q.side==='blue'&&!q.dead&&!q.retreating);
 for(const sq of bl.filter(q=>q.type!=='air')){let best=null,bs=1e9;for(const p of s.points){let sc=Math.hypot(sq.cx-p.x,sq.cy-p.y);if(p.owner==='blue'&&!p.contested)sc+=350;if(taken.has(p))sc+=200;if(sc<bs){bs=sc;best=p;}}
  taken.add(best);const t=best.owner==='blue'&&!best.contested?'hold':'attack';if(sq.order.x!==best.x||sq.order.y!==best.y||sq.order.type!==t)Sim.order(s,sq.id,t,best.x,best.y,true);}
 for(const sq of bl.filter(q=>q.type==='air')){const prey=s.squads.find(q=>q.side==='red'&&!q.dead&&q.type==='tank'&&(!s.fog||(s.mem.blue[q.id]&&s.t-s.mem.blue[q.id].t<20)));const pm=prey&&(s.fog?s.mem.blue[prey.id]:{x:prey.cx,y:prey.cy});let tgt=pm?{x:pm.x,y:pm.y}:null;
  if(!tgt){let bs=1e9;for(const p of s.points){if(p.owner==='blue'&&!p.contested)continue;const d=Math.hypot(sq.cx-p.x,sq.cy-p.y);if(d<bs){bs=d;tgt=p;}}}
  if(tgt)Sim.order(s,sq.id,'attack',tgt.x,tgt.y,true);}}
function play(seed,W,diff,win,opts={}){const s=Sim.create(seed,W,diff,win);const {tune,...rest}=opts;Object.assign(s,rest);if(tune)Object.assign(s.tune,tune);s.starved={blue:0,red:0};let bi=0,firstLead=null,changes=0,lead=null;
 while(!s.over&&s.t<2000){Sim.step(s,1/30);if(s.reserve)for(const k of ["blue","red"])if(s.reserve[k]<2)s.starved[k]+=1/30;if((bi-=1/30)<=0){blueBot(s);bi=10;}
  if(!firstLead){if(s.score.blue>=s.WIN/3)firstLead='blue';else if(s.score.red>=s.WIN/3)firstLead='red';}
  const l=s.score.blue-s.score.red>5?'blue':s.score.red-s.score.blue>5?'red':lead; if(l!==lead){if(lead)changes++;lead=l;}}
 return {s,firstLead,changes};}
module.exports={Sim,blueBot,play};
if(require.main===module){const N=+process.argv[2]||30;
 for(const diff of (process.argv[3]||'easy,normal,hard').split(',')){let r={red:0,blue:0,none:0},fl=0,ch=0,margin=0,T=0,rein=0;
  for(let i=0;i<N;i++){const {s,firstLead,changes}=play(500+i,[800,1100,1400][i%3],diff,300);r[s.over||'none']++;if(firstLead&&firstLead===s.over)fl++;ch+=changes;
   margin+=Math.min(s.score.blue,s.score.red)/s.WIN;T+=s.t;rein+=(s.stats?s.stats.rein.blue+s.stats.rein.red:0);}
  console.log(diff.padEnd(7),`AI wins ${r.red}/${N}`,`| early leader wins ${Math.round(100*fl/N)}%`,`| lead changes ${(ch/N).toFixed(1)}`,`| loser reached ${Math.round(100*margin/N)}%`,`| len ${Math.round(T/N)}s`,rein?`| rein/game ${(rein/N).toFixed(0)}`:'');}}
