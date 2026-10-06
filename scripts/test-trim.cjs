// Synthetic DOM/runner harness. Executes the app's actual event
// bindings, range functions, processing controls, argument builder, and create flow.
// It never opens a browser, loads media, or runs FFmpeg/WASM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const sourcePath = process.argv[2] || path.join(__dirname, '../src/index.template.html');
const html = fs.readFileSync(sourcePath, 'utf8');

class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase(); this.id = attrs.id || '';
    this.value = attrs.value || ''; this.checked = 'checked' in attrs;
    this.disabled = 'disabled' in attrs; this.hidden = 'hidden' in attrs;
    this.name = attrs.name; this.type = attrs.type; this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    this.classes = new Set((attrs.class || '').split(/\s+/));
    this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, flag) => { if (flag) this.classes.add(c); else this.classes.delete(c); } };
    this.events = new Map(); this.style = {}; this.children = []; this.textContent = '';
    this.paused = true; this.ended = false; this.currentTime = 0; this.duration = 10;
  }
  addEventListener(type, fn) { this.events.set(type, [...(this.events.get(type) || []), fn]); }
  removeEventListener() {}
  dispatch(type) { for (const fn of this.events.get(type) || []) fn({target:this, preventDefault(){}, stopPropagation(){}}); }
  getContext() { return null; }
  click() { if (!this.disabled) for (const fn of this.events.get('click') || []) fn({target:this, preventDefault(){}, stopPropagation(){}}); }
  setAttribute(k, v) { this[k] = v; }
  removeAttribute(k) { delete this[k]; }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
  load() {}
  focus() {}
  scrollIntoView() {}
  appendChild(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  remove() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; }
function makeHarness(format = 'webp') {
  const nodes = [];
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const a of match[2].matchAll(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g)) attrs[a[1]] = a[2] || '';
    nodes.push(new Element(match[1], attrs));
  }
  const byId = new Map(nodes.filter(n => n.id).map(n => [n.id, n]));
  function matches(node, selector) {
    selector = selector.trim();
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    if (selector.startsWith('.')) return node.classes.has(selector.slice(1));
    if (selector.startsWith('input[')) {
      if (node.tagName !== 'INPUT') return false;
      const name = /name="([^"]+)"/.exec(selector)?.[1];
      const value = /value="([^"]+)"/.exec(selector)?.[1];
      return (!name || name === node.name) && (!value || value === node.value) && (!selector.includes(':checked') || node.checked);
    }
    if (selector.startsWith('[data-')) { const key = selector.slice(1,-1).slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key in node.dataset; }
    return node.tagName === selector.toUpperCase();
  }
  const queryAll = selector => nodes.filter(n => selector.split(',').some(s => matches(n, s)));
  const document = {querySelector:s=>queryAll(s)[0] || null, querySelectorAll:queryAll, getElementById:id=>byId.get(id), createElement:t=>new Element(t), documentElement:{}, body:new Element('body')};
  const coreGate = deferred(); const runGate = deferred(); const captured = [];
  const runner = { run: async opts => { captured.push(opts); await runGate.promise; return {files:[{name:opts.outputs[0],data:new Uint8Array(20)}]}; }, dispose(){} };
  const errors = [];
  const sandbox = {console:{...console,error:e=>errors.push(e)}, document, CSS:{escape:String}, navigator:{language:'en'}, HTMLElement:Element, Blob, File, Uint8Array, Response, DecompressionStream, URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}}, setTimeout:()=>1, clearTimeout(){}, requestAnimationFrame(){}, localStorage:{getItem(){return null;},setItem(){}}, BrowserFFmpeg:{isSupported:()=>true,videoToGifArgs:o=>o,videoToWebpArgs:o=>o}, __coreGate:coreGate};
  sandbox.window = {addEventListener(){},matchMedia:()=>({matches:true}),innerWidth:1024};
  vm.createContext(sandbox);
  let script = html.slice(html.lastIndexOf('  <script>\n    (() => {') + '  <script>'.length).split('</script>')[0];
  script = script.replace('__APP_CONFIG_JSON__', JSON.stringify({slug:'synthetic',defaultLanguage:'en'})).replace('__BUILD_MANIFEST_JSON__', '{}');
  script = script.replace('      init();', '      loadSelectedRunner = async () => globalThis.__coreGate.promise; globalThis.app = {state,bindEvents,setProcessing,createAnimation,getRange,profileArgs,updateTrimUi,applyLanguage,setVideoFile,removeVideo,adjustRangePoint,settingsObject};');
  vm.runInContext(script, sandbox, {filename:sourcePath});
  const app = sandbox.app;
  for (const n of nodes.filter(n => n.name === 'format')) n.checked = n.value === format;
  for (const [id,value] of Object.entries({startInput:'0:00.000',endInput:'0:05.000',gifColors:'128',gifDither:'sierra2_4a',webpQuality:'75',webpCompression:'4',outputFilename:'synthetic.'+format})) byId.get(id).value = value;
  app.state.file = {name:'synthetic.mp4',size:1024,lastModified:0};
  app.state.format = format; app.state.previewDuration = 10; app.state.language = 'en'; app.state.fineTuneStep = 'tenths';
  app.bindEvents();
  app.updateTrimUi();
  app.applyLanguage();
  return {app,byId,nodes,coreGate,runGate,runner,captured,errors};
}

const tick = () => new Promise(resolve=>setImmediate(resolve));
function range(h) { return {...h.app.getRange()}; }
function selectRange(h,start,end) { h.byId.get('startInput').value=String(start); h.byId.get('endInput').value=String(end); h.app.updateTrimUi(); }
function metadata(h,duration) { h.byId.get('videoPreview').duration=duration; h.byId.get('videoPreview').dispatch('loadedmetadata'); }
function trimButtons(h) { return [...h.nodes.filter(n=>n.classes.has('nudge-button')),h.byId.get('setStartHere'),h.byId.get('setEndHere'),h.byId.get('useFullVideo')].filter(Boolean); }
async function finish(h,done) { h.coreGate.resolve(h.runner); await tick(); h.runGate.resolve(); await done; assert.equal(h.errors.length,0); }
function assertJob(h,start,end) {
  assert.equal(h.captured.length,1);
  assert.equal(h.captured[0].args.start,start); assert.equal(h.captured[0].args.end,end);
  assert.equal(h.app.state.outputMeta.duration,end-start);
  const signature=JSON.parse(h.app.state.lastRunSignature);
  assert.equal(signature.start,start); assert.equal(signature.end,end);
  assert.equal(h.captured[0].files[0].data,h.app.state.file); assert.equal(h.captured[0].files[0].workerfs,true);
}

test('Use full video selects known duration, pauses/seeks, preserves settings and is idempotent',()=>{
  const h=makeHarness(); selectRange(h,2,5);
  const before=JSON.stringify(h.app.settingsObject());
  const button=h.byId.get('useFullVideo'); assert.ok(button,'full-video shortcut exists');
  const video=h.byId.get('videoPreview');video.currentTime=3;video.paused=false;h.app.state.rangePlayback=true;
  assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.disabled,false);
  button.click();assert.deepEqual(range(h),{start:0,end:10});assert.equal(video.currentTime,0);assert.equal(video.paused,true);assert.equal(h.app.state.rangePlayback,false);
  assert.equal(h.byId.get('startRange').value,'0');assert.equal(h.byId.get('endRange').value,'10');
  assert.match(h.byId.get('timelineSelection').textContent,/0:10.000/);assert.match(h.byId.get('runSummary').textContent,/10.00/);
  button.click();assert.deepEqual(range(h),{start:0,end:10});assert.equal(JSON.stringify(h.app.settingsObject()),before);assert.equal(h.captured.length,0);
  h.byId.get('endInput').value='6';h.byId.get('endInput').dispatch('change');assert.equal(range(h).end,6);
});

for(const duration of [1.234,0.02,10.1234]) test(`full range follows millisecond precision for duration ${duration}`,()=>{
  const h=makeHarness();metadata(h,duration);const button=h.byId.get('useFullVideo');assert.ok(button);button.click();
  assert.deepEqual(range(h),{start:0,end:Math.round(duration*1000)/1000});
});
for(const duration of [0,-1,NaN,Infinity]) test(`full-range shortcut is disabled and guarded for duration ${duration}`,()=>{
  const h=makeHarness();h.app.state.previewDuration=duration;selectRange(h,1,4);
  const button=h.byId.get('useFullVideo');assert.ok(button);assert.equal(button.disabled,true);button.dispatch('click');assert.deepEqual(range(h),{start:1,end:4});
});
test('source removal/replacement updates availability and keeps five-second default',()=>{
  const h=makeHarness();h.app.removeVideo();const button=h.byId.get('useFullVideo');assert.ok(button);assert.equal(button.disabled,true);
  const before=range(h);button.dispatch('click');assert.deepEqual(range(h),before);
  h.app.setVideoFile({name:'replacement.mp4',size:10,lastModified:1});assert.equal(button.disabled,true);assert.deepEqual(range(h),{start:0,end:5});
  metadata(h,12);assert.equal(button.disabled,false);assert.deepEqual(range(h),{start:0,end:5});button.click();assert.deepEqual(range(h),{start:0,end:12});
  h.app.setVideoFile({name:'short.mp4',size:10,lastModified:2});assert.equal(button.disabled,true);metadata(h,2.5);assert.deepEqual(range(h),{start:0,end:2.5});
});
test('language switching localizes shortcut/help without changing selected range/settings',()=>{
  const h=makeHarness();selectRange(h,2,8);const before=JSON.stringify(h.app.settingsObject());
  const button=h.byId.get('useFullVideo');assert.ok(button);assert.equal(button.textContent,'Use full video');
  h.byId.get('languageButton').click();assert.equal(button.textContent,'動画全体を選択');assert.match(h.byId.get('helpDialog') ? h.nodes.find(n=>n.dataset.i18n==='helpStep1').textContent : '',/動画全体/);
  assert.deepEqual(range(h),{start:2,end:8});assert.equal(JSON.stringify(h.app.settingsObject()),before);
  h.byId.get('languageButton').click();assert.equal(button.textContent,'Use full video');
});

const mutations={
  'nudge start':h=>h.nodes.find(n=>n.dataset.nudgeTarget==='start'&&n.dataset.nudgeDirection==='1').dispatch('click'),
  'nudge end':h=>h.nodes.find(n=>n.dataset.nudgeTarget==='end'&&n.dataset.nudgeDirection==='-1').dispatch('click'),
  'Use current start':h=>{h.byId.get('videoPreview').currentTime=3;h.byId.get('setStartHere').dispatch('click');},
  'Use current end':h=>{h.byId.get('videoPreview').currentTime=3;h.byId.get('setEndHere').dispatch('click');},
  'full video':h=>h.byId.get('useFullVideo')?.dispatch('click'),
  'late metadata':h=>metadata(h,2),
  'late metadata then language':h=>{metadata(h,2);h.byId.get('languageButton').click();},
  'slider event':h=>{h.byId.get('endRange').value='3';h.byId.get('endRange').dispatch('input');},
  'direct nudge helper':h=>h.app.adjustRangePoint('end',-.1),
  'no interaction':()=>{}
};
for(const format of ['gif','webp']) for(const timing of ['core loading','runner']) for(const [name,mutate] of Object.entries(mutations)) test(`${format}: ${name} cannot mutate captured range during ${timing}`,async()=>{
  const h=makeHarness(format);selectRange(h,1,5);const done=h.app.createAnimation();assert.equal(h.app.state.processing,true);
  if(timing==='runner'){h.coreGate.resolve(h.runner);await tick();}
  mutate(h);assert.deepEqual(range(h),{start:1,end:5});
  await finish(h,done);assertJob(h,1,5);assert.equal(h.app.state.processing,false);
});
for(const format of ['gif','webp']) test(`${format}: argument builder uses captured range even if raw DOM values change`,async()=>{
  const h=makeHarness(format);selectRange(h,1.234,5.678);const done=h.app.createAnimation();
  h.byId.get('startInput').value='2';h.byId.get('endInput').value='3';
  await finish(h,done);assertJob(h,1.234,5.678);
});
for(const outcome of ['success','load error','run error']) test(`trim controls disabled and restored after ${outcome}`,async()=>{
  const h=makeHarness();const done=h.app.createAnimation();
  for(const button of trimButtons(h))assert.equal(button.disabled,true,button.id||'nudge');
  for(const id of ['startInput','endInput','startRange','endRange'])assert.equal(h.byId.get(id).disabled,true,id);
  if(outcome==='load error')h.coreGate.reject(new Error('synthetic load failure'));
  else {h.coreGate.resolve(h.runner);await tick();if(outcome==='run error')h.runGate.reject(new Error('synthetic run failure'));else h.runGate.resolve();}
  await done;assert.equal(h.app.state.processing,false);
  for(const button of trimButtons(h))assert.equal(button.disabled,false,button.id||'nudge');
  for(const id of ['startInput','endInput','startRange','endRange'])assert.equal(h.byId.get(id).disabled,false,id);
  assert.equal(h.errors.length,outcome==='success'?0:1);
  selectRange(h,2,5);h.byId.get('useFullVideo').click();assert.deepEqual(range(h),{start:0,end:10});
});
for(const format of ['gif','webp']) test(`${format}: heavy whole-video confirmation cancellation preserves existing output`,async()=>{
  const h=makeHarness(format);metadata(h,30);const button=h.byId.get('useFullVideo');assert.ok(button);button.click();
  const previous=new Uint8Array([1,2,3]);h.app.state.output=previous;h.app.state.lastRunSignature='older';
  const done=h.app.createAnimation();assert.equal(h.byId.get('appConfirmDialog').open,true);assert.match(h.byId.get('appConfirmTitle').textContent,/heavy/i);assert.equal(h.app.state.processing,false);
  h.byId.get('appConfirmCancel').click();await done;assert.equal(h.captured.length,0);assert.equal(h.app.state.output,previous);assert.equal(h.app.state.processing,false);
});
for(const format of ['gif','webp']) test(`${format}: accepting heavy whole-video confirmation preserves helper settings and export`,async()=>{
  const h=makeHarness(format);metadata(h,30);const button=h.byId.get('useFullVideo');assert.ok(button);button.click();
  const settings=h.app.settingsObject();const done=h.app.createAnimation();h.byId.get('appConfirmOk').click();await tick();await finish(h,done);assertJob(h,0,30);
  const args=h.captured[0].args;assert.equal(args.maxWidth,settings.width);assert.equal(args.fps,settings.fps);assert.equal(args.input,'/workerfs/input.bin');assert.equal(args.output,`/output.${format}`);
  if(format==='gif'){assert.equal(args.colors,settings.gifColors);assert.equal(args.dither,settings.gifDither);}else{assert.equal(args.quality,settings.webpQuality);assert.equal(args.compressionLevel,settings.webpCompression);assert.equal(args.lossless,settings.webpLossless);}
  assert.equal(h.app.state.outputExt,format);assert.equal(h.app.state.outputMeta.loop,settings.loop);assert.match(h.byId.get('resultFilename').textContent,new RegExp(`\\.${format}$`));
});
for(const action of ['replacement','removal']) test(`source ${action} cannot reset trim during conversion`,async()=>{
  const h=makeHarness();selectRange(h,1,5);const source=h.app.state.file;const done=h.app.createAnimation();
  if(action==='replacement')h.app.setVideoFile({name:'new.mp4',size:30});else h.app.removeVideo();
  assert.equal(h.app.state.file,source);assert.deepEqual(range(h),{start:1,end:5});await finish(h,done);assertJob(h,1,5);
});
test('captured range uses the controls millisecond precision consistently',async()=>{
  const h=makeHarness();h.byId.get('startInput').value='1.2346';h.byId.get('endInput').value='5.6786';
  const done=h.app.createAnimation();await finish(h,done);assertJob(h,1.235,5.679);
});
test('nonfinite manually entered range cannot start a conversion',async()=>{
  const h=makeHarness();h.byId.get('endInput').value='9'.repeat(400);const done=h.app.createAnimation();
  assert.match(h.byId.get('statusMessage').textContent,/end/i);assert.equal(h.app.state.processing,false);await done;assert.equal(h.captured.length,0);
});
test('durationchange enables the shortcut for a newly known duration without resetting manual trim',()=>{
  const h=makeHarness();metadata(h,Infinity);selectRange(h,2,8);const button=h.byId.get('useFullVideo');assert.equal(button.disabled,true);
  const video=h.byId.get('videoPreview');video.duration=10;video.dispatch('durationchange');
  assert.equal(h.app.state.previewDuration,10);assert.equal(button.disabled,false);assert.deepEqual(range(h),{start:2,end:8});button.click();assert.deepEqual(range(h),{start:0,end:10});
  video.duration=3;video.dispatch('durationchange');button.click();assert.deepEqual(range(h),{start:0,end:3});
  video.duration=Infinity;video.dispatch('durationchange');assert.equal(button.disabled,true);button.dispatch('click');assert.deepEqual(range(h),{start:0,end:3});
});
for(const format of ['gif','webp']) test(`${format}: durationchange during processing refreshes availability without mutating the captured range`,async()=>{
  const h=makeHarness(format);metadata(h,Infinity);selectRange(h,1,5);const done=h.app.createAnimation();
  const video=h.byId.get('videoPreview');video.duration=2;video.dispatch('durationchange');assert.equal(h.app.state.previewDuration,2);assert.equal(h.byId.get('useFullVideo').disabled,true);assert.deepEqual(range(h),{start:1,end:5});
  await finish(h,done);assertJob(h,1,5);assert.equal(h.byId.get('useFullVideo').disabled,false);h.byId.get('useFullVideo').click();assert.deepEqual(range(h),{start:0,end:2});
});
