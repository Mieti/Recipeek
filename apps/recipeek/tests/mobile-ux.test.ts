import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalUnit,formatUnit,isKnownUnit,unitGroups} from '../lib/units.ts';
import {adjacentStep,stepTapDirection,type StepTap} from '../lib/cooking-navigation.ts';
import {fieldScrollDelta,visibleViewport} from '../lib/viewport.ts';

test('kitchen measures have stable values, aliases and singular labels',()=>{
  assert.equal(canonicalUnit(' TBSP '),'cucchiai');
  assert.equal(canonicalUnit('cucchiaino'),'cucchiaini');
  assert.equal(canonicalUnit('misurini'),'scoop');
  assert.equal(formatUnit('tbsp',1),'cucchiaio');
  assert.equal(formatUnit('cucchiaio',2),'cucchiai');
  assert.equal(formatUnit('g',null),'');
  const values=unitGroups.flatMap<readonly [string,string,string]>(group=>group.units).map(unit=>unit[0]);
  assert.equal(new Set(values).size,values.length);
  for(const unit of ['scoop','cucchiaini','cucchiai','tazze','pizzichi','g','ml'])assert.ok(values.includes(unit));
});

test('legacy custom units remain readable without silently changing them',()=>{
  assert.equal(canonicalUnit('mezzo guscio'),'mezzo guscio');
  assert.equal(formatUnit('mezzo guscio',2),'mezzo guscio');
  assert.equal(isKnownUnit('mezzo guscio'),false);
  assert.equal(isKnownUnit('tsp'),true);
  assert.equal(isKnownUnit(''),true);
});

const start:StepTap={x:350,y:200,time:0,scroll:0};
test('cooking taps navigate on the sides and leave the centre available',()=>{
  assert.equal(stepTapDirection(start,{...start,time:100},390),'next');
  const left={...start,x:20};
  assert.equal(stepTapDirection(left,{...left,time:100},390),'previous');
  const centre={...start,x:195};
  assert.equal(stepTapDirection(centre,{...centre,time:100},390),null);
  assert.equal(adjacentStep(0,3,'previous'),0);
  assert.equal(adjacentStep(2,3,'next'),2);
  assert.equal(adjacentStep(1,3,'previous'),0);
  assert.equal(adjacentStep(1,3,'next'),2);
});

test('scrolling, long presses, controls and selection cannot advance a step',()=>{
  for(const end of [{...start,y:220,time:100},{...start,scroll:20,time:100},{...start,time:600}]){
    assert.equal(stepTapDirection(start,end,390),null);
  }
  assert.equal(stepTapDirection(start,{...start,time:100},390,true),null);
});

test('keyboard viewport follows the visible area and does not treat pinch zoom as typing',()=>{
  assert.deepEqual(visibleViewport(844,390,20),{height:390,top:20,keyboard:true});
  assert.deepEqual(visibleViewport(844,844,0),{height:844,top:0,keyboard:false});
  assert.equal(visibleViewport(844,390,20,2).keyboard,false);
});

test('the active field moves above the keyboard while tall textareas align at the top',()=>{
  assert.equal(fieldScrollDelta(310,360,20,340),20);
  assert.equal(fieldScrollDelta(50,100,20,340),0);
  assert.equal(fieldScrollDelta(0,50,20,340),-20);
  assert.equal(fieldScrollDelta(100,600,20,340),80);
  assert.equal(fieldScrollDelta(0,600,20,340),-20);
});
