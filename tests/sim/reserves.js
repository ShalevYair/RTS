const {play}=require('./bench.js');const N=+process.argv[2]||20;
for(const tune of JSON.parse(process.argv[3])){const out=[];
 for(const diff of ['easy','hard']){let r=0,fl=0,m=0,T=0,rein=0,stW=0,stL=0;
  for(let i=0;i<N;i++){const {s,firstLead}=play(900+i,[800,1100,1400][i%3],diff,300,{tune:{...tune}});
   if(s.over==='red')r++;if(firstLead&&firstLead===s.over)fl++;m+=Math.min(s.score.blue,s.score.red)/s.WIN;T+=s.t;rein+=s.stats.rein.blue+s.stats.rein.red;
   const w=s.over||'blue',l=w==='blue'?'red':'blue';stW+=s.starved[w]/s.t;stL+=s.starved[l]/s.t;}
  out.push(`${diff}: AI ${r}/${N} lead ${Math.round(100*fl/N)}% loser ${Math.round(100*m/N)}% len ${Math.round(T/N)}s rein ${Math.round(rein/N)} starved W/L ${Math.round(100*stW/N)}/${Math.round(100*stL/N)}%`);}
 console.log(JSON.stringify(tune).padEnd(34),out.join(' || '));}
