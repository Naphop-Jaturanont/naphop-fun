'use strict';
// A deliberately small DOM double. These tests execute event handlers and text
// rendering, not a browser. They cannot validate layout or native input behavior.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../between-frames/index.html','utf8');
const script=html.split('<script>')[1].split('</script>')[0];
const nodes=new Map(),groups={rate:[],guess:[],frame:[]};
let document;
class Element{
 constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.style={};this.attrs={};this.listeners={};this.disabled=false;this.value='';this.textContent='';this._html=''}
 setAttribute(k,v){this.attrs[k]=String(v)}
 addEventListener(k,fn){this.listeners[k]=fn}
 focus(){document.activeElement=this}
 closest(selector){const m=selector.match(/^\[data-(\w+)\]$/);return m&&Object.hasOwn(this.dataset,m[1])?this:null}
 set innerHTML(value){this._html=value;if(this.id==='frames'){groups.frame=[...value.matchAll(/<button class="frame"[^>]*data-frame="(\d+)"([^>]*)>/g)].map(m=>{let e=new Element('',{frame:m[1]});e.disabled=/\bdisabled\b/.test(m[2]);return e})}}
 get innerHTML(){return this._html}
}
for(const id of html.matchAll(/\bid="([^"]+)"/g))nodes.set(id[1],new Element(id[1]));
for(const v of [1,1.25,2,4])groups.rate.push(new Element('',{rate:String(v)}));
for(const k of ['still','backward','forward','ambiguous'])groups.guess.push(new Element('',{guess:k}));
document={documentElement:{lang:''},activeElement:null,getElementById:id=>{assert(nodes.has(id),'Unknown DOM ID '+id);return nodes.get(id)},querySelectorAll:selector=>{const m=selector.match(/^\[data-(\w+)\]$/);assert(m&&groups[m[1]],'Unsupported selector '+selector);return groups[m[1]]},querySelector:selector=>{const m=selector.match(/^\[data-(\w+)="([^"]+)"\]$/);assert(m&&groups[m[1]],'Unsupported selector '+selector);return groups[m[1]].find(e=>e.dataset[m[1]]===m[2])}};
const ctx={document};vm.createContext(ctx);vm.runInContext(script,ctx);
const $=id=>nodes.get(id),state=()=>JSON.parse(vm.runInContext('JSON.stringify(state)',ctx));
function fire(el,event='click',target=el){el.focus();assert(el.listeners[event],`Missing ${event} handler`);el.listeners[event]({target})}
function guess(k){fire(groups.guess.find(e=>e.dataset.guess===k))}
function rate(r){const b=groups.rate.find(e=>Number(e.dataset.rate)===r);fire($('presets'),'click',b)}
function capture(){fire($('capture'))}
function frame(n){fire($('frames'),'click',groups.frame[n])}
function scrub(v){$('between').value=String(v);fire($('between'),'input')}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name)}
test('whole UI initializes in Thai with six locked frames',()=>{assert.equal(document.documentElement.lang,'th');assert.equal(groups.frame.length,6);assert(groups.frame.every(e=>e.disabled));assert($('capture').disabled);assert($('between').disabled);assert(!$('frames').innerHTML.includes('องศาตามเข็มจากด้านบน'))});
test('prediction button sets state and enables capture',()=>{guess('backward');assert.equal(state().prediction,'backward');assert(!$('capture').disabled)});
test('capture renders backward explanation and focuses first frame',()=>{capture();assert(state().revealed);assert($('resultTitle').textContent.includes('ย้อนทิศ'));assert.equal(document.activeElement.dataset.frame,'0');assert(!$('between').disabled);assert($('frames').innerHTML.includes('องศาตามเข็มจากด้านบน'))});
test('scrub updates both distinct transforms without replacing focus',()=>{scrub(50);assert.equal(state().between,50);assert.notEqual($('realHand').attrs.transform,$('aliasHand').attrs.transform);assert.equal(document.activeElement,$('between'));assert($('between').attrs['aria-valuetext'].includes('จุดจริง'))});
test('language change preserves experiment and exposes English copy',()=>{const before=state();fire($('language'));assert.equal(document.documentElement.lang,'en');assert.deepEqual(state(),before);assert($('resultTitle').textContent.includes('Backward'));assert($('sourceBody').innerHTML.includes('known speed bound'))});
test('selected frame remains focusable after rerender',()=>{const b=groups.frame[2];b.focus();$('frames').listeners.click({target:b});assert.equal(state().frame,2);assert.equal(state().between,0);assert.equal(document.activeElement.dataset.frame,'2')});
test('last frame disables scrub and avoids fictitious seventh frame',()=>{frame(5);assert($('between').disabled);assert($('between').attrs['aria-valuetext'].includes('Final frame'));assert.equal($('trueTravel').textContent,'—');assert.equal($('shortTravel').textContent,'—')});
test('rate change clears visible trial and retains journal',()=>{rate(2);assert(!state().revealed);assert.equal(state().prediction,null);assert.equal(state().discoveries.length,1);assert($('capture').disabled);assert(groups.frame.every(e=>e.disabled))});
test('half-turn boundary shows symmetric partial travel',()=>{guess('ambiguous');capture();scrub(50);assert.equal($('shortTravel').textContent,'±90°');assert.equal($('trueTravel').textContent,'90° CW');assert.equal($('aliasHand').style.display,'none')});
test('half-turn zero scrub reports zero, not full interval',()=>{scrub(0);assert.equal($('shortTravel').textContent,'±0°')});
test('all discoveries rendered and final message appears',()=>{for(const r of [1,4]){rate(r);guess('still');capture()}assert.equal(state().discoveries.length,4);assert($('conclusion').textContent.startsWith('All four found.'));assert.equal(($('stamps').innerHTML.match(/DISCOVERED/g)||[]).length,4)});
test('repeat current preset keeps captured results',()=>{rate(4);assert(state().revealed);assert.equal(state().discoveries.length,4)});
test('switching language after full journey retains all discoveries',()=>{fire($('language'));assert.equal(document.documentElement.lang,'th');assert.equal(state().discoveries.length,4)});
test('reset clears trial journal and restores default rate while retaining Thai',()=>{fire($('reset'));assert.equal(state().rate,1.25);assert.equal(state().discoveries.length,0);assert.equal(state().prediction,null);assert(!state().revealed);assert.equal(document.documentElement.lang,'th');assert($('between').disabled)});
test('range input events support minimum and maximum rates',()=>{for(const r of [.5,6]){$('sampleRate').value=String(r);fire($('sampleRate'),'input');assert.equal(state().rate,r)}assert($('rateValue').textContent.includes('6'))});
console.log(`\n${count} simulated UI state checks passed. No browser, visual, touch, or native keyboard verification is implied.`);
