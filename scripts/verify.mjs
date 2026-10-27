import fs from 'node:fs';
import assert from 'node:assert/strict';
import {prepareIndex,searchItems,normalize,highlightText,matchRanges} from '../docs/search.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../docs/content.json',import.meta.url)));
const index=prepareIndex(data.items);
assert.equal(data.subjects.length,5);assert.equal(data.sources.length,7);
for(const [id,n] of Object.entries({nls:166,hcm:861,ai:175,ktvm:96}))assert.equal(index.filter(i=>i.subject===id&&i.type==='question').length,n);
assert.equal(new Set(index.map(i=>i.id)).size,index.length);
for(const q of ['quyen rieng tu','so nhan','dai doan ket','MVP','K-means'])assert.ok(searchItems(index,{query:q}).length>0,q);
for(const [id,q] of Object.entries({nls:'an toan',hcm:'doc lap',ktvm:'GDP',startup:'MVP',ai:'Big Data'})){
 const result=searchItems(index,{subject:id,query:q});assert.ok(result.length);assert.ok(result.every(i=>i.subject===id));
}
assert.deepEqual(searchItems(index,{query:'zzzxxyyww-no-match'}),[]);
const x=searchItems(index,{subject:'ktvm',query:'so nhan'}).map(i=>i.id);
assert.deepEqual(x,searchItems(index,{subject:'ktvm',query:'số nhân'}).map(i=>i.id));
assert.deepEqual(searchItems(index,{view:'saved',saved:['nls-q-001']}).map(i=>i.id),['nls-q-001']);
assert.equal(searchItems(index,{subject:'hcm',view:'check',type:'question'}).length,8);
assert.equal(searchItems(index,{subject:'ai',view:'check',type:'question'}).length,4);
assert.equal(searchItems(index,{subject:'nls',view:'check',type:'question'}).length,2);
assert.ok(searchItems(index,{subject:'nls',type:'theory'}).every(i=>i.type==='theory'));
assert.equal(normalize('ĐẠO ĐỨC'),'dao duc');
assert.equal(highlightText('Quyền riêng tư','quyen'),'<mark>Quyền</mark> riêng tư');
assert.equal(highlightText('<script>đạo</script>','dao'),'&lt;script&gt;<mark>đạo</mark>&lt;/script&gt;');
assert.deepEqual(matchRanges('Số nhân và số nhân','so nhan'),[[0,2],[3,7],[11,13],[14,18]]);
for(const i of data.items){
 assert.ok(data.subjects.some(s=>s.id===i.subject));assert.ok(data.sources.some(s=>s.id===i.source));
 if(i.type==='question')assert.ok(i.answerHtml.trim(),i.id);
 if(i.image)assert.ok(fs.existsSync(new URL('../docs/'+i.image,import.meta.url)));
}
for(const s of data.sources)assert.ok(fs.existsSync(new URL('../docs/'+s.url,import.meta.url)));
console.log(`Validated ${index.length} items, all five subject scopes, accent-insensitive search, highlights, bookmarks, and 14 flagged questions.`);
