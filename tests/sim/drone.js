const {Sim,blueBot}=require('./bench.js');
const s=Sim.create(9,1000,'normal',300);
// run until enemies are mid-map, then look at their base area where blue can't see
for(let i=0;i<30*20;i++)Sim.step(s,1/30);
const red=s.units.filter(u=>u.side==='red'), hidden=red.filter(u=>!s.vis.blue.has(u.id));
const tgt=hidden[0];console.log('t',s.t.toFixed(0),'hidden red',hidden.length,'charges',s.eyes.blue.charges);
console.log('eye ok',Sim.eye(s,'blue',tgt.x,tgt.y),'second (no charge)',Sim.eye(s,'blue',tgt.x,tgt.y),'NaN',Sim.eye(s,'blue',NaN,1));
Sim.step(s,1/30);console.log('revealed',s.vis.blue.has(tgt.id),'mem fresh',s.mem.blue[tgt.squad]&&(s.t-s.mem.blue[tgt.squad].t)<0.1);
for(let i=0;i<30*9;i++)Sim.step(s,1/30);console.log('expired',s.eyes.blue.active.length===0);
for(let i=0;i<30*20;i++)Sim.step(s,1/30);console.log('recharged',s.eyes.blue.charges,'prog',s.eyes.blue.prog.toFixed(2));
for(let i=0;i<30*60;i++)Sim.step(s,1/30);console.log('cap',s.eyes.blue.charges);
// AI uses eyes
let used=0;const s2=Sim.create(3,1000,'hard',300);let bi=0,prev=s2.eyes.red.charges;
while(!s2.over&&s2.t<400){Sim.step(s2,1/30);if((bi-=1/30)<=0){blueBot(s2);bi=10;}const c=s2.eyes.red.charges;if(c<prev)used++;prev=c;}
console.log('AI drones used',used,'in',Math.round(s2.t)+'s');
const kinds={};for(const k of s2.marks)kinds[k.kind]=k.who;console.log('marks carry who:',JSON.stringify(kinds));
