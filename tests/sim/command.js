const {Sim,blueBot}=require('./bench.js');
let s=Sim.create(4,1000,'normal',300);
const q=s.squads[0];console.log('temper/boss',s.squads.filter(x=>x.side==='blue').map(x=>x.boss+':'+x.temper).join(' '));
console.log('delay near HQ',Sim.orderDelay(s,q).toFixed(2));
Sim.order(s,'blue0','attack',500,300);console.log('queued, order still old:',q.order.x!==500,'outbox',s.outbox.length);
Sim.order(s,'blue0','hold',520,320);console.log('superseded, outbox',s.outbox.length,s.outbox[0].x);
let t0=s.t;while(q.order.x!==520&&s.t<20)Sim.step(s,1/30);console.log('arrived after',(s.t-t0).toFixed(2),'s');
// far squad has longer delay
q.cx=900;console.log('delay far',Sim.orderDelay(s,q).toFixed(2));
// trait delayed & pending dedupe
console.log('trait send',Sim.setTrait(s,'blue1','aggressive'),'dup',Sim.setTrait(s,'blue1','aggressive'),'now',s.squads[1].trait);
for(let i=0;i<30*9;i++)Sim.step(s,1/30);console.log('trait after',s.squads[1].trait);
// fog off => immediate
const s2=Sim.create(4,1000,'normal',300);s2.fog=false;Sim.order(s2,'blue0','attack',500,300);console.log('fog off immediate',s2.squads[0].order.x===500);
// dead squad drops message
const s3=Sim.create(4,1000,'normal',300);Sim.order(s3,'blue2','attack',500,300);s3.units=s3.units.filter(u=>u.squad!=='blue2');s3.noReinforce=true;
for(let i=0;i<30*9;i++)Sim.step(s3,1/30);console.log('dead squad msg dropped',s3.outbox.length===0,s3.squads[2].order.x!==500);
// full games: calls, answers
let tot={calls:0,answered:0,missed:0,orders:0,delay:0};
for(let i=0;i<6;i++){const g=Sim.create(50+i,1100,'normal',300);let bi=0,seen=new Set();
 while(!g.over&&g.t<900){Sim.step(g,1/30);if((bi-=1/30)<=0){blueBot(g);bi=10;}
  for(const c of g.calls)if(!seen.has(c.id)){seen.add(c.id);tot.calls++;if(i%2===0)Sim.answer(g,c.id,'hold');}}
 tot.answered+=g.log2.answered;tot.missed+=g.log2.missed;tot.orders+=g.log2.orders;tot.delay+=g.log2.delay;}
console.log('6 games: calls',tot.calls,'answered',tot.answered,'auto',tot.missed,'avg order delay',(tot.delay/tot.orders).toFixed(2)+'s');
console.log('bad answer',Sim.answer(s,999,'hold'),Sim.answer(s,1,'dance'));
console.log('hist len',s.hist.length,'sample',JSON.stringify(s.hist.at(-1).sq[4]));
