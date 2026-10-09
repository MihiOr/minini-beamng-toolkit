import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateBalance } from '../mods/CompanionWeightBalance/ui/modules/apps/CompanionWeightBalance/balance.js'

const row=(name,force,type='wheel')=>{
  const value=Array(15).fill(0);value[0]=name;value[7]=force;value[14]=type;return value
}

test('corner names are stable when stream order changes and extra objects exist',()=>{
  const state=calculateBalance({wheelInfo:[row('RR',1000),row('FL',3000),row('Spare',9000),row('FR',2000),row('RL',4000),row('FL',9999,'rotator')]})
  assert.equal(state.total,10000)
  assert.equal(state.front,50)
  assert.equal(state.left,70)
  assert.equal(state.shares.FL,30)
  assert.equal(state.shares.RR,10)
  assert.ok(state.dot.x<0)
})
test('unloaded or incomplete data never invents a balance',()=>{
  for(const data of [[],[row('FL',1000)],['FL','FR','RL','RR'].map(n=>row(n,0))]) {
    const state=calculateBalance({wheelInfo:data})
    assert.equal(state.front,null)
    assert.equal(state.left,null)
    assert.equal(state.dot,null)
  }
})
test('negative loads clamp to zero and invalid force does not count as a wheel reading',()=>{
  const state=calculateBalance({wheelInfo:[row('FL',-5),row('FR',NaN),row('RL',1),row('RR',2)]})
  assert.equal(state.wheels.FL,0)
  assert.equal(state.wheels.FR,null)
  assert.equal(state.complete,false)
})
test('front/rear and left/right dot direction follows load, not vehicle axes',()=>{
  const state=calculateBalance({wheelInfo:{a:row('FL',1),b:row('FR',1),c:row('RL',1),d:row('RR',7)},sensors:{gravity:-9.81}})
  assert.equal(state.rear,80)
  assert.equal(state.right,80)
  assert.ok(state.dot.x>0 && state.dot.y>0)
  assert.ok(Math.hypot(state.dot.x,state.dot.y)<=1)
  assert.equal(state.gravity,9.81)
  assert.equal(calculateBalance({sensors:{gravity:0}}).gravity,null)
})
