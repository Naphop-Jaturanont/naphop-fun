'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'bridge-office/index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const m={};vm.createContext(m);vm.runInContext(script.match(/\/\/ MODEL_BEGIN([\s\S]*?)\/\/ MODEL_END/)[1]+'\nthis.model={NODES,BRIDGES,activeEdges,degreeCounts,newWalk,startWalk,legalBridges,crossBridge,undoBridge,walkStatus}',m);const M=m.model;let checks=0,states=0;function test(name,f){f();checks++;console.log('PASS',name)}const json=x=>JSON.stringify(x);
function fixture(plan,start,ids){let s=M.startWalk(M.newWalk(plan),start);ids.forEach(id=>s=M.crossBridge(s,id-1));return s;}
test('parse final script',()=>assert(script.includes('render();')));
test('0, 2, 4 degree pattern',()=>{assert.equal(json(M.degreeCounts(0)),json({A:3,B:3,C:3,D:3}));assert.equal(json(M.degreeCounts(1)),json({A:4,B:4,C:3,D:3}));assert.equal(json(M.degreeCounts(2)),json({A:4,B:4,C:4,D:4}));});
test('invalid plans throw',()=>[-1,3,1.5,NaN,Infinity,'1',null].forEach(p=>assert.throws(()=>M.newWalk(p))));
test('no start means no crossing',()=>{const s=M.newWalk();assert.equal(M.walkStatus(s),'ready');assert.equal(M.legalBridges(s).length,0);assert.strictEqual(M.crossBridge(s,0),s)});
test('invalid start ignored',()=>{const s=M.newWalk();assert.strictEqual(M.startWalk(s,'Z'),s)});
test('one extra complete trail C to D',()=>{const s=fixture(1,'C',[5,1,2,3,4,7,6]);assert.equal(M.walkStatus(s),'trail');assert.equal(s.current,'D');assert.equal(s.used.length,7)});
test('two extra complete circuit',()=>{const s=fixture(2,'A',[1,2,3,4,5,8,6,7]);assert.equal(M.walkStatus(s),'circuit');assert.equal(s.current,'A');assert.equal(s.used.length,8)});
test('valid plan can still dead end at allowed endpoint',()=>{const s=fixture(1,'C',[3,4,1,6]);assert.equal(M.walkStatus(s),'stuck');assert.equal(s.used.length,4)});
test('return to start is not automatically success',()=>{const s=fixture(2,'A',[1,2,5,4,6,7]);assert.equal(M.walkStatus(s),'stuck');assert.equal(s.used.length,6)});
test('reused and nonincident edge rejected',()=>{const s=fixture(1,'C',[5]);[4,1,-1,99,NaN,.5,'0'].forEach(id=>assert.strictEqual(M.crossBridge(s,id),s));});
test('undo restores prior state',()=>{const s=fixture(1,'C',[5,1]);assert.equal(json(M.undoBridge(s)),json(fixture(1,'C',[5])));assert.equal(json(M.undoBridge(M.undoBridge(s))),json(fixture(1,'C',[])))});
test('start selection is a new walk, never teleport',()=>{const s=M.startWalk(fixture(1,'C',[5,1]),'B');assert.equal(s.used.length,0);assert.equal(json(s.visits),'["B"]');assert.equal(s.plan,1)});
test('parallel bridges distinct',()=>{const s=fixture(1,'A',[1,7]);assert.equal(s.current,'A');assert.equal(s.used.length,2)});
const totals={};for(let p=0;p<=2;p++)for(const start of M.NODES){let solutions=0;function explore(s){states++;assert.equal(new Set(s.used).size,s.used.length);assert.equal(s.visits.length,s.used.length+1);assert.equal(s.current,s.visits.at(-1));assert.equal(s.start,s.visits[0]);const legal=M.legalBridges(s);assert(legal.every(id=>!s.used.includes(id)));const status=M.walkStatus(s);if(status==='circuit'||status==='trail'){solutions++;assert.equal(s.used.length,6+p);assert.equal(legal.length,0)}else if(status==='stuck')assert.equal(legal.length,0);for(const id of legal){const next=M.crossBridge(s,id);assert.equal(json(M.undoBridge(next)),json(s));explore(next)}}explore(M.startWalk(M.newWalk(p),start));totals[p+start]=solutions;}
test('exhaustive existence matches theorem for all starts',()=>{for(const n of M.NODES){assert.equal(totals['0'+n],0);assert.equal(totals['1'+n],['C','D'].includes(n)?44:0);assert.equal(totals['2'+n],176)}});
test('native controls, live status, focus, reduced motion',()=>['<button','<details','role="status"','aria-live="polite"','focus({preventScroll:true})','prefers-reduced-motion:reduce',':focus-visible'].forEach(x=>assert(html.includes(x))));
test('TH/EN, menu and reset',()=>['lang=\'th\'','lang===\'th\'','href="../"','id="reset"','id="restart"','id="undo"'].forEach(x=>assert(html.includes(x))));
test('two cited sources and protected new tabs',()=>{assert(html.includes('https://nrich.maths.org/problems/bridges-konigsberg'));assert(html.includes('5.02%3A_Euler_Circuits_and_Walks'));assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,2)});
test('no tracking, storage, network APIs, timers or remote assets',()=>{assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|document.cookie|setInterval|setTimeout|requestAnimationFrame|<script\s+src=|<img|@import|url\(https:/.test(html))});
test('unique static ids',()=>{const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.includes('$'));assert.equal(new Set(ids).size,ids.length)});
const portal=fs.readFileSync(path.join(root,'index.html'),'utf8');new vm.Script(portal.match(/<script>([\s\S]*?)<\/script>/)[1]);
test('new card and all nine existing portal routes retained',()=>['bridge-office','between-frames','next-five','air-pocket','cosmic-reply','gravity','elevator','shadow','sa-cafe','requirements'].forEach(route=>assert(portal.includes('./'+route+'/'))));
console.log(`${checks} checks passed; ${states} reachable states validated; solution totals: ${JSON.stringify(totals)}`);
