import {prepareIndex,searchItems,normalize,escapeHTML as esc,stripHTML,highlightText,excerpt,matchRanges} from './search.mjs';

const paths={
 book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
 chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/><path d="M17 5h4v4"/>',
 monitor:'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5M8 8l2 2-2 2m5 0h3"/>',
 bulb:'<path d="M8 16c-6-4-3-13 4-13s10 9 4 13l-1 2H9Zm1 5h6m-5-9 2 2 2-2m-2 2v4"/>',
 nodes:'<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 7 3 3m4 4 3 3M7 17l3-3m4-4 3-3"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 alert:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
 folder:'<path d="M3 7V4h7l2 3h9v13H3z"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 file:'<path d="M14 3H5v18h14V8Zm0 0v6h5M8 13h8m-8 4h6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 question:'<path d="M4 4h16v13H9l-5 4zM9 8a3 3 0 0 1 5 1c0 2-2 2-2 3m0 2h.01"/>',
 pen:'<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.book}</svg>`;}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(n=>{n.innerHTML=icon(n.dataset.icon);n.removeAttribute('data-icon');});}
hydrateIcons();
const $=s=>document.querySelector(s), fmt=n=>n.toLocaleString('vi-VN');
const key='goc-on-tap-v1';let memory={saved:[],learned:[],hideAnswers:false};
try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored){memory={saved:Array.isArray(stored.saved)?stored.saved:[],learned:Array.isArray(stored.learned)?stored.learned:[],hideAnswers:!!stored.hideAnswers};}}catch{}
const state={subject:'all',query:'',type:'all',chapter:'',view:'all',page:1};
let data,index,subjectMap,sourceMap,itemMap,results=[],currentItem=null,readerAnswerVisible=true,pageView='text',toastTimer;
const perPage=12;
const typeLabels={all:'Tất cả',theory:'Lý thuyết',question:'Câu hỏi',exercise:'Tự luận',note:'Ghi chú'};
const typeIcons={theory:'book',question:'question',exercise:'pen',note:'file'};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2200);}
function persist(){try{localStorage.setItem(key,JSON.stringify(memory));}catch{toast('Trình duyệt chưa lưu được tiến độ. Thay đổi chỉ có trong lần mở này.');}}
function cssVars(s){return `--subject:${s.color};--subject-bg:${s.bg}`;}
function highlightHTML(html,query){
  if(!query.trim())return html;
  const t=document.createElement('template');t.innerHTML=html;
  const walker=document.createTreeWalker(t.content,NodeFilter.SHOW_TEXT),nodes=[];let n;while(n=walker.nextNode())nodes.push(n);
  for(const node of nodes){const ranges=matchRanges(node.textContent,query);if(!ranges.length)continue;const fragment=document.createElement('template');fragment.innerHTML=highlightText(node.textContent,query);node.replaceWith(fragment.content);}
  return t.innerHTML;
}
function updateURL(){const p=new URLSearchParams();if(state.subject!=='all')p.set('mon',state.subject);if(state.query)p.set('q',state.query);if(state.type!=='all')p.set('loai',state.type);if(state.chapter)p.set('chuong',state.chapter);if(state.view!=='all')p.set('xem',state.view);if(currentItem)p.set('muc',currentItem.id);history.replaceState(null,'',location.pathname+(p.toString()?'#'+p:''));}
function readURL(){const p=new URLSearchParams(location.hash.slice(1));state.subject=subjectMap[p.get('mon')]?p.get('mon'):'all';state.query=p.get('q')||'';state.type=typeLabels[p.get('loai')]?p.get('loai'):'all';state.chapter=p.get('chuong')||'';state.view=['saved','check','learned'].includes(p.get('xem'))?p.get('xem'):'all';return p.get('muc');}
function renderNavigation(){
  $('#subject-tabs').innerHTML=[{id:'all',short:'Tổng quan',icon:'grid'},...data.subjects].map(s=>`<button id="tab-${s.id}" role="tab" aria-selected="${state.subject===s.id}" aria-controls="subject-panel" tabindex="${state.subject===s.id?'0':'-1'}" class="subject-tab ${state.subject===s.id?'active':''}" data-subject="${s.id}">${icon(s.icon)}<span>${esc(s.short)}</span></button>`).join('');
  $('#subject-panel').setAttribute('aria-labelledby','tab-'+state.subject);
  $('#subject-nav').innerHTML=data.subjects.map(s=>`<button class="nav-item ${state.subject===s.id&&state.view==='all'?'active':''}" data-subject="${s.id}" style="${cssVars(s)}"><span class="subject-dot"></span>${esc(s.short)}</button>`).join('');
  document.querySelector('.main-nav').classList.toggle('active',state.subject==='all'&&state.view==='all');
  document.querySelectorAll('.sidebar [data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===state.view));
  $('#saved-count').textContent=memory.saved.length;
  $('#check-count').textContent=index.filter(i=>i.status==='check').length;
  const learned=memory.learned.length,pct=Math.round(100*learned/index.length);
  $('#progress-percent').textContent=pct+'%';$('#progress-bar').style.width=pct+'%';
  $('#progress-label').textContent=learned?`${fmt(learned)} / ${fmt(index.length)} nội dung đã nhớ.`:'Bắt đầu từ một nội dung nhỏ.';
}
const bookArt=`<svg viewBox="0 0 270 195" fill="none" aria-hidden="true"><ellipse cx="145" cy="171" rx="98" ry="12" fill="#e8eddf"/><path d="M207 140c-12-29-4-60 18-90" stroke="#8b9f76" stroke-width="2"/><path d="M216 79c-26-6-29-22-26-32 21 4 28 15 26 32Z" fill="#c1cdae"/><path d="M212 96c5-22 18-31 33-27-2 20-16 27-33 27Z" fill="#94ab81"/><path d="M205 118c-17-2-28-13-26-28 19 0 27 13 26 28Z" fill="#b2c29e"/><path d="m197 136 27 0-5 30h-17Z" fill="#e8e4cf"/><g transform="rotate(-7 125 100)"><path d="M64 55c21-6 40-3 58 8 18-11 37-14 58-8v99c-21-6-40-3-58 8-18-11-37-14-58-8Z" fill="#345b47"/><path d="M69 49c19-4 38 0 53 11v93c-17-10-33-13-53-9Z" fill="#e8ecd8"/><path d="M175 49c-19-4-38 0-53 11v93c17-10 33-13 53-9Z" fill="#fcf9e9"/><path d="M122 60v93" stroke="#d3ddc1"/><path d="m80 70 30 8m-30 7 30 8m-30 7 30 8m-30 7 30 8" stroke="#b7c5a3" stroke-width="2" stroke-linecap="round"/><path d="m135 78 28-8m-28 23 28-8m-28 23 28-8" stroke="#c4cdb1" stroke-width="2" stroke-linecap="round"/><path d="M146 55v44l7-8 7 4V52" fill="#d5b975"/></g><path d="m46 36 2 8 8 2-8 2-2 8-2-8-8-2 8-2Z" fill="#c3cfae"/><circle cx="191" cy="32" r="4" fill="#dcc692"/><path d="m46 130 7-5 3 9" stroke="#adc09b" stroke-width="2" stroke-linecap="round"/></svg>`;
function renderHero(){
  const subject=subjectMap[state.subject],special={saved:['Những điều cần nhớ.','Các nội dung bạn đã đánh dấu để quay lại nhanh hơn.'],check:['Đọc kỹ trước khi nhớ.','Các câu có lưu ý, thiếu dữ kiện hoặc cần đối chiếu được giữ đúng theo tài liệu.'],learned:['Từng chút một, đã nhớ.','Những nội dung bạn đã tự đánh dấu là đã nhớ. Bạn có thể bỏ đánh dấu khi muốn ôn lại.']}[state.view];
  const hero=$('#hero');hero.classList.toggle('subject-hero',!!subject||!!special);
  if(special){hero.innerHTML=`<div><div class="eyebrow">Góc cá nhân</div><h1>${special[0]}</h1><p class="hero-description">${special[1]}</p></div><div class="subject-emblem" style="--subject:#668354;--subject-bg:#e9efdf">${icon(state.view==='saved'?'bookmark':state.view==='check'?'alert':'check')}</div>`;}
  else if(subject){hero.innerHTML=`<div><div class="eyebrow">Ôn tập theo môn</div><h1>${esc(subject.name)}</h1><p class="hero-description">${esc(subject.description)}</p><div class="subject-meta"><span>${icon('file')}${sourcesFor(subject.id).length} tài liệu</span><span>${icon('book')}${subject.chapters.length} nhóm nội dung</span><span>${icon('search')}${fmt(subject.count)} mục tra cứu</span></div></div><div class="subject-emblem" style="${cssVars(subject)}">${icon(subject.icon)}</div>`;}
  else{hero.innerHTML=`<div><div class="eyebrow">Không gian ôn tập của bạn</div><h1>Sẵn sàng cho<br><em>kỳ thi sắp tới.</em></h1><p class="hero-description">5 môn học, tất cả ở đây. Chọn một môn hoặc tìm ngay<br class="desktop-break"> điều bạn cần nhớ trong tài liệu.</p></div><div class="hero-art">${bookArt}<div class="hero-count"><strong>${fmt(index.filter(i=>i.type==='question').length)}</strong><span>câu hỏi<br>để ôn tập</span></div></div>`;}
  $('#breadcrumb').textContent=special?({saved:'Đã đánh dấu',check:'Cần đối chiếu',learned:'Phần đã nhớ'}[state.view]):subject?.short||'Tổng quan ôn tập';
  $('#subject-section').hidden=!!subject||!!special;
  $('#subject-grid').innerHTML=data.subjects.map(s=>`<button class="subject-card" data-subject="${s.id}" style="${cssVars(s)}"><span class="card-arrow">↗</span><span class="card-icon">${icon(s.icon)}</span><h3>${esc(s.short)}</h3><p>${s.counts.question?fmt(s.counts.question)+' câu hỏi':s.counts.theory+' phần lý thuyết'} · ${sourcesFor(s.id).length} tài liệu</p></button>`).join('');
}
function sourcesFor(id){return data.sources.filter(s=>id==='all'||s.subject===id);}
function renderControls(){
  const subject=subjectMap[state.subject];$('#search').placeholder=subject?`Tìm từ khóa trong ${subject.short}…`:'Bạn đang cần tìm kiến thức gì?';
  if($('#search').value!==state.query)$('#search').value=state.query;
  $('#clear-search').hidden=!state.query;
  $('#search-hints').innerHTML='<span class="hint-label">THỬ TÌM</span>'+(subject?.hints||['GDP','MVP','độc lập dân tộc','Big Data']).map(t=>`<button class="hint-button" data-hint="${esc(t)}">${esc(t)}</button>`).join('');
  $('#type-tabs').innerHTML=Object.entries(typeLabels).filter(([type])=>type==='all'||!subject||subject.counts[type]>0).map(([type,label])=>`<button class="type-tab ${state.type===type?'active':''}" data-type="${type}" aria-pressed="${state.type===type}">${label}</button>`).join('');
  const ch=subject?subject.chapters:data.subjects.flatMap(s=>s.chapters);
  $('#chapter').innerHTML='<option value="">Tất cả chương / nhóm</option>'+[...new Set(ch)].map(c=>`<option value="${esc(c)}" ${c===state.chapter?'selected':''}>${esc(c)}</option>`).join('');
  $('#hide-answers').checked=memory.hideAnswers;
  $('#subject-notice').hidden=!subject;
  if(subject)$('#subject-notice').innerHTML=icon('help')+`<span>${esc(subject.note)}</span>`;
}
function renderResults(){
  results=searchItems(index,{...state,saved:memory.saved,learned:memory.learned});
  const max=Math.max(1,Math.ceil(results.length/perPage));state.page=Math.min(state.page,max);
  $('#results-title').textContent=state.query?`Kết quả cho “${state.query}”`:state.view==='saved'?'Nội dung đã đánh dấu':state.view==='check'?'Các mục cần đọc kỹ':state.view==='learned'?'Nội dung đã nhớ':'Nội dung ôn tập';
  $('#results-count').textContent=fmt(results.length)+(state.query?' kết quả':' mục');
  const shown=results.slice((state.page-1)*perPage,state.page*perPage);
  if(!shown.length){$('#results-list').innerHTML=`<div class="empty-state">${icon(state.view==='saved'?'bookmark':'search')}<h3>${state.query?'Chưa tìm thấy nội dung.':state.view==='saved'?'Để dành điều cần ôn lại.':state.view==='learned'?'Bắt đầu từ một phần nhỏ.':'Chưa có mục phù hợp.'}</h3><p>${state.view==='saved'&&!state.query?'Bấm biểu tượng đánh dấu ở cạnh câu hỏi hoặc lý thuyết. Nội dung sẽ được gom lại tại đây.':state.view==='learned'&&!state.query?'Mở một nội dung và chọn “Đánh dấu đã nhớ” sau khi bạn đã hiểu.':'Thử một từ khóa ngắn hơn, bỏ bộ lọc chương hoặc tìm trong tất cả môn học.'}</p><button data-action="reset">Xem tất cả nội dung</button></div>`;}
  else $('#results-list').innerHTML=shown.map(i=>{
    const s=subjectMap[i.subject],src=sourceMap[i.source],saved=memory.saved.includes(i.id),learned=memory.learned.includes(i.id);
    let body=state.query?i.text:stripHTML(i.answerHtml||i.bodyHtml||i.text);
    let prefix=i.answerHtml&&!state.query?'Đáp án: ':'';
    if(memory.hideAnswers&&i.answerHtml){body=state.query&&normalize(i.text).includes(normalize(state.query))?'Có nội dung phù hợp. Mở mục để tự trả lời và xem đáp án.':'Mở mục để tự trả lời, rồi đối chiếu đáp án.';prefix='';}
    return `<article class="result-row" style="${cssVars(s)}"><button class="result-open" data-item="${esc(i.id)}"><div class="result-eyebrow"><span class="type-tag">${icon(typeIcons[i.type])}${typeLabels[i.type]}</span><span>${state.subject==='all'?esc(s.short):esc(i.chapter.split(' · ')[0])}</span><span>·</span><span>${esc(i.label||('Trang '+(i.page||'')+(i.page?'':'nội dung')).replace('Trang nội dung','Theo chủ đề'))}</span>${i.status==='check'?'<span class="check-tag">Cần đối chiếu</span>':''}${learned?`<span class="read-check">${icon('check')}Đã nhớ</span>`:''}</div><h3 class="result-title">${highlightHTML(i.titleHtml,state.query)}</h3><p class="result-excerpt">${prefix?`<span class="excerpt-label">${prefix}</span>`:''}${highlightText(excerpt(body,memory.hideAnswers&&i.answerHtml?'':state.query),memory.hideAnswers&&i.answerHtml?'':state.query)}</p></button><div class="row-actions"><button class="bookmark-button ${saved?'active':''}" data-save="${esc(i.id)}" aria-label="${saved?'Bỏ đánh dấu':'Đánh dấu'} ${esc(i.label||i.title.slice(0,55))}" aria-pressed="${saved}">${icon('bookmark')}</button><span class="row-chevron">↗</span></div></article>`;
  }).join('');
  $('#pagination').innerHTML=results.length>perPage?`<button data-page="${state.page-1}" ${state.page===1?'disabled':''}>← Trước</button><span>Trang ${state.page} / ${max}</span><button data-page="${state.page+1}" ${state.page===max?'disabled':''}>Tiếp →</button>`:'';
}
function render(){renderNavigation();renderHero();renderControls();renderResults();updateURL();}
function goSubject(id){Object.assign(state,{subject:id,view:'all',query:'',chapter:'',type:'all',page:1});render();closeMenu();$('#tab-'+id).scrollIntoView({block:'nearest',inline:'nearest'});window.scrollTo({top:0,behavior:'smooth'});}
function goView(view){Object.assign(state,{view,subject:'all',query:'',chapter:'',type:'all',page:1});render();closeMenu();window.scrollTo({top:0,behavior:'smooth'});}
function toggleSaved(id){const pos=memory.saved.indexOf(id);if(pos===-1)memory.saved.push(id);else memory.saved.splice(pos,1);persist();renderNavigation();renderResults();if(currentItem?.id===id)updateReaderButtons();toast(pos===-1?'Đã lưu vào phần đánh dấu.':'Đã bỏ đánh dấu.');}
function updateReaderButtons(){
  if(!currentItem)return;
  const saved=memory.saved.includes(currentItem.id),done=memory.learned.includes(currentItem.id);
  $('#reader-bookmark').classList.toggle('active',saved);$('#reader-bookmark').setAttribute('aria-label',saved?'Bỏ đánh dấu nội dung':'Đánh dấu nội dung');$('#reader-bookmark').setAttribute('aria-pressed',saved);
  $('#mark-learned').innerHTML=icon('check')+(done?'Đã nhớ · Bỏ đánh dấu':'Đánh dấu đã nhớ');$('#mark-learned').classList.toggle('done',done);
  $('#next-item').disabled=results.indexOf(currentItem)===results.length-1||results.length<2;
}
function readerHTML(i){
  const source=sourceMap[i.source],s=subjectMap[i.subject];
  const warning=i.status==='check'?`<div class="reader-note"><strong>${icon('alert').replace('<svg ','<svg style="display:inline;width:14px;height:14px;vertical-align:-2px;margin-right:5px" ')}Cần đối chiếu trước khi học thuộc</strong><div>${highlightHTML(i.noteHtml||'<p>Đọc kỹ điều kiện và lưu ý trong đáp án của tài liệu.</p>',state.query)}</div></div>`:'';
  const body=i.image&&i.type==='exercise'&&!readerAnswerVisible?'<section class="reader-answer"><div class="answer-hidden">Trang này trình bày đề bài và lời giải cùng nhau.<button data-answer="show">Hiện bài tập và lời giải</button></div></section>':i.image&&pageView==='original'?`<img class="source-page" src="${i.image}" alt="Trang ${i.page} của tài liệu ${esc(source.title)}"><p class="original-caption">Trang gốc giữ đầy đủ bảng số liệu, công thức và đồ thị. Chọn “Nội dung dễ đọc” để xem từ khóa được tô sáng.</p>`:`<div class="reader-body">${highlightHTML(i.bodyHtml,state.query)}</div>`;
  const answer=i.answerHtml?`<section class="reader-answer"><div class="answer-heading"><span>${i.type==='exercise'?'Lời giải tham khảo':'Đáp án theo tài liệu'}</span>${readerAnswerVisible?'<button data-answer="hide">Ẩn để tự kiểm tra</button>':''}</div>${readerAnswerVisible?`<div class="answer-text">${highlightHTML(i.answerHtml,state.query)}</div>`:'<div class="answer-hidden">Thử trả lời trước khi xem nhé.<button data-answer="show">Hiện đáp án / lời giải</button></div>'}</section>`:'';
  return `<div class="reader-meta" style="${cssVars(s)}"><span class="type-tag">${icon(typeIcons[i.type])}${typeLabels[i.type]}</span><span>${esc(i.chapter)}</span>${i.label?`<span>· ${esc(i.label)}</span>`:''}</div><h1>${highlightHTML(i.titleHtml,state.query)}</h1>${i.image?`<div class="view-tabs"><button data-page-view="text" class="${pageView==='text'?'active':''}">Nội dung dễ đọc</button><button data-page-view="original" class="${pageView==='original'?'active':''}">Bản gốc có bảng & đồ thị</button></div>`:''}${warning}${body}${answer}${i.noteHtml&&i.status!=='check'?`<div class="reader-note">${highlightHTML(i.noteHtml,state.query)}</div>`:''}<div class="source-line"><span>${esc(source.title)}${i.page?' · Trang '+i.page:''}</span><a href="${source.url}${source.format==='PDF'&&i.page?'#page='+i.page:''}" target="_blank" rel="noopener" ${source.format==='DOCX'?'download':''}>${source.format==='PDF'?'Mở tài liệu gốc ↗':'Tải bản Word ↓'}</a></div>`;
}
function renderReader(scrollToMatch=false){
  const i=currentItem;$('#reader-label').innerHTML=icon(subjectMap[i.subject].icon)+esc(subjectMap[i.subject].short);
  $('#reader-content').innerHTML=readerHTML(i);updateReaderButtons();
  if(scrollToMatch){$('#reader-scroll').scrollTop=0;if(state.query)requestAnimationFrame(()=>{const match=$('#reader-content .reader-body mark')||$('#reader-content .answer-text mark')||$('#reader-content h1 mark');if(match)match.scrollIntoView({block:'center',behavior:'instant'});});}
}
function openItem(id){
  const i=itemMap[id];if(!i)return;currentItem=i;readerAnswerVisible=!memory.hideAnswers;pageView='text';renderReader(false);
  if(!$('#reader').open){$('#reader').showModal();document.body.style.overflow='hidden';}
  $('#reader-scroll').scrollTop=0;updateURL();
  if(state.query)requestAnimationFrame(()=>{const m=$('#reader-content .reader-body mark')||$('#reader-content .answer-text mark')||$('#reader-content h1 mark');if(m)m.scrollIntoView({block:'center',behavior:'instant'});});
}
function closeReader(){if($('#reader').open)$('#reader').close();currentItem=null;document.body.style.overflow='';updateURL();}
function showInfo(kind){
  if(kind==='sources'){$('#info-title').textContent='7 tài liệu của bạn';$('#info-body').innerHTML='<p>Các nội dung trên trang được sắp xếp từ những tài liệu dưới đây. Mở bản gốc để đối chiếu số câu, bảng số liệu và công thức.</p>'+data.sources.map(s=>`<div class="source-card"><span class="file-badge">${s.format}</span><div><strong>${esc(s.title)}</strong><small>${esc(subjectMap[s.subject].short)}${s.pages?' · '+s.pages+' trang':''}</small></div><a href="${s.url}" target="_blank" rel="noopener" ${s.format==='DOCX'?'download':''}>${s.format==='PDF'?'Mở ↗':'Tải ↓'}</a></div>`).join('');}
  else{$('#info-title').textContent='Ôn tập theo cách của bạn';$('#info-body').innerHTML='<h3>1. Chọn môn, rồi tìm kiến thức</h3><p>Chọn một trong 5 môn ở thanh bên. Nhập từ khóa có dấu hoặc không dấu, ví dụ “so nhan”, “MVP”, “dai doan ket”. Tìm kiếm cả câu hỏi, đáp án và phần lý thuyết; mọi từ bạn nhập đều phải có trong nội dung.</p><h3>2. Mở đúng đoạn cần đọc</h3><p>Bấm một kết quả để mở nội dung và tô sáng từ khóa. Dùng bộ lọc chương và Lý thuyết / Câu hỏi / Tự luận để thu hẹp. Với Kinh tế vĩ mô, có thể chuyển sang bản gốc để nhìn rõ đồ thị và bảng.</p><h3>3. Tự trả lời, rồi đối chiếu</h3><p>Bật “Ẩn đáp án” trước khi ôn. Sau khi tự trả lời, bấm “Hiện đáp án / lời giải”. Các câu gắn nhãn “Cần đối chiếu” có điểm chưa rõ trong tài liệu: đọc kỹ lưu ý trước khi học thuộc.</p><h3>4. Để dành phần cần ôn lại</h3><p>Bấm biểu tượng đánh dấu để gom nội dung vào “Đã đánh dấu”. Sau khi đã hiểu, chọn “Đánh dấu đã nhớ”. Dùng phím / để đến ô tìm kiếm, Esc để đóng nội dung.</p><p class="help-note">Dấu trang, trạng thái đã nhớ và lựa chọn ẩn đáp án được lưu trong trình duyệt này. Chúng chưa đồng bộ giữa các thiết bị và có thể mất nếu bạn xóa dữ liệu trình duyệt. Nội dung ôn tập giữ theo các tài liệu bạn đã cung cấp.</p>';}
  $('#info-dialog').showModal();closeMenu();
}
function closeMenu(){$('#sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');}
document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el||!data)return;
  if(el.dataset.subject)goSubject(el.dataset.subject);
  else if(el.dataset.view)goView(el.dataset.view);
  else if(el.dataset.type){state.type=el.dataset.type;state.page=1;renderControls();renderResults();updateURL();}
  else if(el.dataset.hint){state.query=el.dataset.hint;state.page=1;renderControls();renderResults();updateURL();$('#search').focus();}
  else if(el.dataset.item)openItem(el.dataset.item);
  else if(el.dataset.save)toggleSaved(el.dataset.save);
  else if(el.dataset.page){state.page=Number(el.dataset.page);renderResults();$('.results-toolbar').scrollIntoView({block:'start',behavior:'smooth'});}
  else if(el.dataset.answer){readerAnswerVisible=el.dataset.answer==='show';const y=$('#reader-scroll').scrollTop;renderReader();$('#reader-scroll').scrollTop=y;}
  else if(el.dataset.pageView){pageView=el.dataset.pageView;renderReader();$('#reader-scroll').scrollTop=0;}
  else if(el.dataset.action==='reset'){goSubject('all');}
  else if(el.dataset.action)showInfo(el.dataset.action);
});
let searchTimer;$('#search').addEventListener('input',e=>{state.query=e.target.value;state.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{renderControls();renderResults();updateURL();},90);});
$('#clear-search').addEventListener('click',()=>{state.query='';state.page=1;renderControls();renderResults();updateURL();$('#search').focus();});
$('#chapter').addEventListener('change',e=>{state.chapter=e.target.value;state.page=1;renderResults();updateURL();});
$('#hide-answers').addEventListener('change',e=>{memory.hideAnswers=e.target.checked;persist();renderResults();});
$('#reader-close').addEventListener('click',closeReader);
$('#reader').addEventListener('cancel',e=>{e.preventDefault();closeReader();});
$('#reader').addEventListener('click',e=>{if(e.target===$('#reader')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeReader();}});
$('#reader-bookmark').addEventListener('click',()=>currentItem&&toggleSaved(currentItem.id));
$('#mark-learned').addEventListener('click',()=>{if(!currentItem)return;const id=currentItem.id,pos=memory.learned.indexOf(id);if(pos<0)memory.learned.push(id);else memory.learned.splice(pos,1);persist();renderNavigation();renderResults();updateReaderButtons();toast(pos<0?'Đã ghi nhận một nội dung bạn đã nhớ.':'Đã bỏ trạng thái đã nhớ.');});
$('#next-item').addEventListener('click',()=>{const n=results.indexOf(currentItem);if(n>=0&&n<results.length-1)openItem(results[n+1].id);});
$('#info-close').addEventListener('click',()=>$('#info-dialog').close());
$('#menu-button').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',open);});
$('#mobile-overlay').addEventListener('click',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#reader').open&&!$('#info-dialog').open){e.preventDefault();$('#search').focus();}if(e.key==='Escape')closeMenu();});
$('#subject-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...$('#subject-tabs').querySelectorAll('[role="tab"]')];let n=tabs.indexOf(document.activeElement);if(n<0)return;e.preventDefault();n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(n+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;const id=tabs[n].dataset.subject;goSubject(id);$('#tab-'+id).focus();});
window.addEventListener('hashchange',()=>{if(!data)return;const id=readURL();state.page=1;render();if(id)openItem(id);});
async function boot(){try{const r=await fetch('./content.json');if(!r.ok)throw Error('content');data=await r.json();index=prepareIndex(data.items);subjectMap=Object.fromEntries(data.subjects.map(s=>[s.id,s]));sourceMap=Object.fromEntries(data.sources.map(s=>[s.id,s]));itemMap=Object.fromEntries(index.map(i=>[i.id,i]));memory.saved=memory.saved.filter(x=>itemMap[x]);memory.learned=memory.learned.filter(x=>itemMap[x]);const id=readURL();render();if(id)openItem(id);}catch(error){$('#hero').innerHTML='<h1>Nội dung chưa tải được.</h1>';$('#results-list').innerHTML='<div class="empty-state"><p>Kết nối có thể đang gián đoạn. Hãy tải lại trang để tiếp tục.</p><button id="retry">Tải lại trang</button></div>';$('#retry').onclick=()=>location.reload();console.error('Unable to load study content',error);}}
boot();
