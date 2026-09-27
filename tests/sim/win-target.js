const Sim=require('../load-sim.js')();
for (const w of [150,300,undefined,0,-5,NaN,1e9]) { const s=Sim.create(3,1000,'normal',w); let n=0; while(!s.over&&s.t<2000){Sim.step(s,1/30);} console.log(String(w).padEnd(9),'WIN',s.WIN,'over',s.over,'t',Math.round(s.t),'score',Math.round(s.score.blue),Math.round(s.score.red)); }
