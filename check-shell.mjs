import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const preferences=source.slice(source.indexOf('function sidebarPreferences('),source.indexOf('let ui='));
const layout=source.slice(source.indexOf('function saveSidebarPreferences('),source.indexOf('function courseSelector('));
const listeners={},storage=new Map(),properties={},classes=new Set();
let mobile=false;
const toggle={attributes:{},setAttribute(key,value){this.attributes[key]=value;}};
const handle={...toggle,attributes:{},listeners:{},matches:value=>value==='.sidebar-resizer',closest:()=>handle,setPointerCapture(){},addEventListener(key,fn){this.listeners[key]=fn;},removeEventListener(key){delete this.listeners[key];}};
const shell={style:{setProperty(key,value){properties[key]=value;}},classList:{toggle(key,on){on?classes.add(key):classes.delete(key);},remove:key=>classes.delete(key)}};
const sidebar={},main={},bodyClasses=new Set();
const context=vm.createContext({
 localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
 matchMedia:()=>({matches:mobile,addEventListener(){}}),
 document:{querySelector:selector=>({'.shell':shell,'.sidebar-toggle':toggle,'.sidebar-resizer':handle,'.sidebar':sidebar,'.main-area':main})[selector],addEventListener:(key,fn)=>listeners[key]=fn,body:{classList:{add:key=>bodyClasses.add(key),remove:key=>bodyClasses.delete(key),toggle:(key,on)=>on?bodyClasses.add(key):bodyClasses.delete(key)}}},
 ui:{sidebarWidth:250,sidebarCollapsed:false,menu:false}
});
vm.runInContext(preferences+layout,context);
assert.equal(context.sidebarPreferences().sidebarWidth,250);
storage.set('learnio.sidebar','broken JSON');
assert.equal(context.sidebarPreferences().sidebarCollapsed,false);
context.applySidebarLayout();
assert.equal(properties['--sidebar-width'],'250px');
context.ui.sidebarCollapsed=true;context.applySidebarLayout();context.saveSidebarPreferences();
assert.ok(classes.has('sidebar-collapsed'));
assert.equal(toggle.attributes['aria-label'],'Expand sidebar');
assert.equal(context.sidebarPreferences().sidebarCollapsed,true,'Collapsed state survives a fresh preference read.');
context.ui.sidebarCollapsed=false;
listeners.pointerdown({target:handle,button:0,clientX:250,pointerId:1,preventDefault(){}});
handle.listeners.pointermove({clientX:900,pointerId:1});
assert.equal(context.ui.sidebarWidth,400,'Dragging is bounded at the maximum width.');
handle.listeners.pointerup({pointerId:1});
assert.ok(!bodyClasses.has('sidebar-resizing'));
assert.equal(context.sidebarPreferences().sidebarWidth,400,'Drag completion saves the width.');
listeners.keydown({target:handle,key:'Home',preventDefault(){}});
assert.equal(context.ui.sidebarWidth,220);
listeners.keydown({target:handle,key:'ArrowRight',preventDefault(){}});
assert.equal(context.ui.sidebarWidth,230,'The resize separator supports keyboard adjustment.');
listeners.keydown({target:handle,key:'ArrowLeft',preventDefault(){}});
assert.equal(context.ui.sidebarWidth,220);
mobile=true;context.ui.menu=true;context.applySidebarLayout();context.syncMobileNavigation();
assert.equal(toggle.attributes['aria-label'],'Close navigation');
assert.equal(main.inert,true);assert.equal(sidebar.inert,false);
context.ui.menu=false;context.syncMobileNavigation();
assert.equal(main.inert,false);assert.equal(sidebar.inert,true);
storage.set('learnio.sidebar','{"width":100000,"collapsed":true}');
assert.equal(context.sidebarPreferences().sidebarWidth,400);
console.log('Application shell checks passed: bounded drag, keyboard resize, persisted collapse/width, and mobile focus isolation.');
