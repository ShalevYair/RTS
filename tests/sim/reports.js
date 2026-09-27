const {Sim,blueBot}=require('./bench.js');
const s=Sim.create(5,1000,'normal',300);let bi=0,reps=0,last={},gaps=[],devs=[],marks={};
while(!s.over&&s.t<600){Sim.step(s,1/30);if((bi-=1/30)<=0){blueBot(s);bi=10;}
 for(const q of s.squads)if(q.side==='blue'){const r=s.rep[q.id];if(last[q.id]!==r.t){if(last[q.id]!==undefined)gaps.push(r.t-last[q.id]);last[q.id]=r.t;reps++;}
  if(!q.dead)devs.push(Math.hypot(r.x-q.cx,r.y-q.cy));}
 for(const k of s.marks)marks[k.kind+k.t]=k.kind;}
const cnt={};for(const k of Object.values(marks))cnt[k]=(cnt[k]||0)+1;
gaps.sort((a,b)=>a-b);devs.sort((a,b)=>a-b);
console.log('game',s.over,Math.round(s.t)+'s','reports',reps,'gap median',gaps[gaps.length>>1].toFixed(1),'max',gaps.at(-1).toFixed(1));
console.log('reported-vs-true distance median',devs[devs.length>>1].toFixed(0),'p90',devs[Math.floor(devs.length*.9)].toFixed(0),'max',devs.at(-1).toFixed(0));
console.log('marks',cnt,'live marks now',s.marks.length);
const m=Object.values(s.mem.blue)[0];console.log('mem sample',m&&Object.keys(m).join(','));
