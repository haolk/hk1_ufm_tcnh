export function normalize(value='') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
}
export function terms(query) { return [...new Set(normalize(query).split(/\s+/).filter(Boolean))]; }
export function prepareIndex(items) {
  return items.map(item=>({...item,_title:normalize(item.title+' '+item.label),_text:normalize(item.text+' '+item.label)}));
}
export function searchItems(items, {query='',subject='all',type='all',chapter='',view='all',saved=[],learned=[]}={}) {
  const q=normalize(query),tokens=terms(q),fav=new Set(saved),done=new Set(learned);
  return items.filter(i=>(subject==='all'||i.subject===subject)&&(type==='all'||i.type===type)&&(!chapter||i.chapter===chapter)&&(view!=='saved'||fav.has(i.id))&&(view!=='check'||i.status==='check')&&(view!=='learned'||done.has(i.id))&&tokens.every(t=>i._text.includes(t))).map(i=>({item:i,score:q?(i._title.includes(q)?100:0)+tokens.reduce((n,t)=>n+(i._title.includes(t)?10:0),0)+(i.type==='question'?3:0):0})).sort((a,b)=>b.score-a.score).map(x=>x.item);
}
export function escapeHTML(s='') {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function stripHTML(h=''){return h.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/\s+/g,' ').trim();}
export function matchRanges(text,query) {
  const map=[],norm=[];let offset=0;
  for(const c of text){const s=normalize(c);for(const v of s){norm.push(v);map.push([offset,offset+c.length]);}if(!s&&/\s/.test(c)){norm.push(' ');map.push([offset,offset+c.length]);}offset+=c.length;}
  const haystack=norm.join(''),ranges=[];
  for(const t of terms(query)){let p=0;while((p=haystack.indexOf(t,p))!==-1){ranges.push([map[p][0],map[p+t.length-1][1]]);p+=t.length;}}
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}return merged;
}
export function highlightText(text,query) {
  let pos=0,out='';for(const [a,b] of matchRanges(text,query)){out+=escapeHTML(text.slice(pos,a))+'<mark>'+escapeHTML(text.slice(a,b))+'</mark>';pos=b;}return out+escapeHTML(text.slice(pos));
}
export function excerpt(text,query='',length=190){
  const ranges=matchRanges(text,query);const start=Math.max(0,(ranges[0]?.[0]||0)-55),end=Math.min(text.length,start+length);return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
}
