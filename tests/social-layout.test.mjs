import test from 'node:test';
import assert from 'node:assert/strict';
import {boxViolations} from '../social-layout.mjs';
test('the former text origin is detected as left of the actual frame centre',()=>{
 assert.ok(boxViolations({x:200,y:400,width:584,height:60}).includes('not_centered'));
 assert.deepEqual(boxViolations({x:248,y:400,width:584,height:60}),[]);
});
test('top navigation, right controls and bottom captions remain protected',()=>{
 for(const box of [{x:240,y:180,width:600,height:100},{x:170,y:400,width:740,height:60},{x:240,y:1470,width:600,height:60}])assert.ok(boxViolations(box).includes('danger_zone'));
});
test('glyph outlines count at the safe boundary and the caption profile fits',()=>{
 assert.ok(boxViolations({x:200,y:300,width:680,height:60},{stroke:6}).includes('danger_zone'));
 assert.deepEqual(boxViolations({x:198,y:1295,width:684,height:63},{stroke:6}),[]);
});
