const {Sim,blueBot}=require('./bench.js');const N=+process.argv[2]||20;
for(const res of [false,true])for(const tr of ['cautious','balanced','aggressive']){let w=0,rein=0,sc=0;
 for(let i=0;i<N;i++){const s=Sim.create(300+i,[800,1100,1400][i%3],'normal',300);if(!res){s.tune.resEvery=1e-9;s.tune.resMax=1e9;}
  for(const q of s.squads)if(q.side==='blue')q.trait=tr;let bi=0;
  while(!s.over&&s.t<2000){Sim.step(s,1/30);if((bi-=1/30)<=0){blueBot(s);bi=10;}}
  if(s.over==='blue')w++;rein+=s.stats.rein.blue;sc+=s.score.blue;}
 console.log(res?'reserves ':'unlimited',tr.padEnd(10),'blue wins',w+'/'+N,'blue rein/game',Math.round(rein/N),'blue score',Math.round(sc/N));}
