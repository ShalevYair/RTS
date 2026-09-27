const {Sim,play}=require('./bench.js');const N=+process.argv[2]||20;
for(const fog of [false,true]){const out=[];for(const diff of ['easy','normal','hard']){let r=0,t0=Date.now();
 for(let i=0;i<N;i++){const {s}=play(700+i,[800,1100,1400][i%3],diff,300,{fog});if(s.over==='red')r++;}
 out.push(`${diff} AI ${r}/${N} (${Date.now()-t0}ms)`);}console.log('fog',fog,out.join(' | '));}
// visibility sanity: at start, enemy units far away are hidden; nearby shooter revealed
const s=Sim.create(1,1000,'normal');console.log('start: blue sees',s.vis.blue.size,'red units; red sees',s.vis.red.size);
const e=s.units.find(u=>u.side==='red');e.lastFire=s.t;Sim.step(s,1/30);console.log('fired unit revealed:',s.vis.blue.has(e.id));
