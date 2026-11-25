const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function start(file,extra={}){
 const html=read(file), ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]), elements={};
 let focus='', seq=0, frames=new Map(), reduced=false;
 for(const id of ids){assert(!elements[id],id+' must be unique');elements[id]={id,attrs:{},setAttribute(k,v){this.attrs[k]=v},focus(){focus=id}}}
 const document={documentElement:{},getElementById:id=>elements[id],querySelector:s=>s==='.filters'?elements.filters:undefined};elements.filters={};
 const sandbox={document,location:{},window:{},matchMedia(){return {matches:reduced}},requestAnimationFrame(fn){frames.set(++seq,fn);return seq},cancelAnimationFrame(id){frames.delete(id)},...extra};
 const c=vm.createContext(sandbox), run=s=>vm.runInContext(s,c);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
 return {els:elements,run,focus:()=>focus,reduced:()=>{reduced=true},frames,click:id=>elements[id].onclick(),document,html};
}
(async()=>{
 const calls=[],stops=[],value=()=>({setValueAtTime(v){calls.push(v)},exponentialRampToValueAtTime(){}}); class Audio{
 constructor(){this.state='running';this.currentTime=0;this.destination={}} createGain(){return {gain:value(),connect(){},disconnect(){}}} createOscillator(){return {frequency:value(),connect(x){return x},start(){},stop(x){stops.push(x)},disconnect(){}}}}
 const a=start('half-a-string/index.html',{window:{AudioContext:Audio}}), e=a.els;
 assert.equal(a.document.documentElement.lang,'th');assert(e.predict.hidden&&e.results.hidden&&e.transfer.hidden);assert.equal(e.sound.attrs['aria-pressed'],'false');
 a.click('low');assert(e.predict.hidden);a.click('between');assert(e.transfer.hidden);
 a.click('pluck');assert.equal(calls.length,0);assert.equal(a.focus(),'low');assert(!e.predict.hidden);assert(e.results.hidden);assert.equal(e.pluck.attrs['aria-disabled'],'true');
 a.click('pluck');assert.equal(a.run('stage'),1);
 a.click('same');assert.equal(a.focus(),'pluck');assert(e.predict.hidden&&!e.stop.hidden);assert.match(e.length.textContent,/32/);assert.equal(e.string.attrs.d,'M46 64H320');assert.equal(a.frames.size,0);
 a.click('lang');assert.equal(a.document.documentElement.lang,'en');assert.equal(e.pluck.textContent,'Pluck 32 cm');assert.equal(e.question.textContent,'Press the string at 32 cm. What happens to the pitch?');
 a.click('sound');assert.equal(e.sound.attrs['aria-pressed'],'true');a.click('pluck');assert.match(e.status.textContent,/rises by an octave/);assert(!e.results.hidden&&!e.transfer.hidden);assert.deepEqual(calls.filter(x=>x>1),[440,880,1320]);
 a.click('compare');assert.equal(e.length.textContent,'64 cm');assert(e.stop.hidden);assert.equal(e.string.attrs.d,'M46 64H594');assert.deepEqual(calls.filter(x=>x>1).slice(-3),[220,440,660]);
 a.click('compare');assert.equal(e.length.textContent,'32 cm');assert(!e.stop.hidden);
 a.click('below');assert.match(e.transferMsg.textContent,/Reveal: 48 cm ≈ 293.3 Hz/);a.click('between');assert.match(e.transferMsg.textContent,/Correct!/);assert.equal(e.between.attrs['aria-pressed'],'true');assert.equal(e.below.attrs['aria-pressed'],'false');
 a.click('sound');assert.equal(e.sound.attrs['aria-pressed'],'false');assert(stops.includes(undefined));
 a.click('reset');assert.equal(a.focus(),'pluck');assert(e.transfer.hidden&&e.results.hidden);assert.equal(e.string.attrs.d,'M46 64H594');assert.equal(a.frames.size,0);
 a.reduced();a.click('pluck');assert.equal(a.frames.size,0);a.click('high');a.click('pluck');assert.equal(a.frames.size,0);assert.match(e.status.textContent,/Correct!/);
 assert.equal(a.run('freq(64)'),220);assert.equal(a.run('freq(32)'),440);assert.equal(a.run('freq(48)').toFixed(1),'293.3');
 for(const [node,hz] of [[e.waveLong,220],[e.waveShort,440]]){
  const pts=[...node.attrs.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m=>+m[2]);
  const signs=pts.map(y=>Math.sign(y-20)).filter(Boolean); const crosses=signs.slice(1).filter((x,i)=>x!==signs[i]).length;
  assert.equal(crosses,hz*.1-1);
 }
 const b=start('half-a-string/index.html');b.click('sound');b.click('pluck');assert.match(b.els.audioHint.textContent,/เล่นเสียงไม่ได้/);b.click('low');b.click('pluck');assert(!b.els.results.hidden);
 assert.match(a.html,/href="\.\.\/"/);assert.match(a.html,/max-width:450px/);assert.match(a.html,/min-height:44px/);
 const index=start('index.html');assert.match(index.els.grid.innerHTML,/href="\.\/half-a-string\/"/);
 index.run("setFilter('learn')");assert.match(index.els.grid.innerHTML,/Half a String/);
 index.run("setFilter('play')");assert.doesNotMatch(index.els.grid.innerHTML,/Half a String/);
 index.run("setFilter('all')");index.els.search.oninput({target:{value:'Half a String'}});assert.equal((index.els.grid.innerHTML.match(/class="tile"/g)||[]).length,1);
 console.log('PASS: stage, guard, focus calls, Thai/English, two frequencies, equal-time waves, A/B replay, transfer, mute, reset, reduced motion, audio failure, portal route/filter/search.');
})().catch(e=>{console.error(e);process.exitCode=1});
