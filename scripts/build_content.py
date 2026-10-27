from pathlib import Path
import json, re, html, shutil, unicodedata
import fitz
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table

ROOT = Path(__file__).resolve().parents[1]
UPLOAD = ROOT / 'input'
DIST = ROOT / 'docs'
(DIST / 'sources').mkdir(parents=True, exist_ok=True)
(DIST / 'pages').mkdir(exist_ok=True)
items, sources = [], []
E = html.escape
def plain(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]*>', ' ', s))).strip()
def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD',s.lower().replace('đ','d')) if unicodedata.category(c) != 'Mn')
def add(**v):
    v.setdefault('status','normal'); v.setdefault('bodyHtml',''); v.setdefault('answerHtml','')
    v.setdefault('titleHtml', E(v['title'])); v.setdefault('label','')
    v['text'] = plain(' '.join([v['titleHtml'], v['bodyHtml'], v['answerHtml'], v.get('noteHtml','')]))
    v['id'] = v.get('id') or f"{v['source']}-{len(items)+1}"
    items.append(v); return v
def source(filename, sid, subject, title):
    p=UPLOAD/filename; target=sid+p.suffix
    if not p.exists():p=DIST/'sources'/target
    if p.resolve()!=(DIST/'sources'/target).resolve():shutil.copyfile(p,DIST/'sources'/target)
    v={'id':sid,'subject':subject,'title':title,'filename':filename,'url':'sources/'+target,'format':p.suffix[1:].upper()}
    if p.suffix=='.pdf': v['pages']=len(fitz.open(p))
    sources.append(v); return p
def span_html(s):
    t=E(s['text']); return '<strong>'+t+'</strong>' if 'bold' in s['font'].lower() else t
def line_text(l): return ''.join(s['text'] for s in l['spans']).strip()
def line_html(l): return ''.join(span_html(s) for s in l['spans']).strip()
def block_html(b): return ' '.join(line_html(l) for l in b['lines'])
def blocks(page, top=40, bottom=None):
    return [b for b in page.get_text('dict',sort=True)['blocks'] if b.get('lines') and b['bbox'][1]>=top and b['bbox'][3]<(bottom or page.rect.height-42)]
def block_text(b): return ' '.join(line_text(l) for l in b['lines']).strip()
def strip_prefix(markup, pattern):
    # Prefixes can share a bold run with the first keyword.
    t=plain(markup); m=re.match(pattern,t)
    if not m: return markup
    target=m.end(); visible=0; out=[]
    for tok in re.split('(<[^>]+>)',markup):
        if tok.startswith('<'):out.append(tok);continue
        raw=html.unescape(tok)
        if visible+len(raw)<=target:visible+=len(raw);continue
        cut=max(0,target-visible);out.append(E(raw[cut:]));visible+=len(raw)
    return ''.join(out).strip()

subjects=[
 {'id':'ktvm','name':'Kinh tế vĩ mô','short':'Kinh tế vĩ mô','icon':'chart','color':'#b66c40','bg':'#fbecdf','description':'Lý thuyết chương 1–4, câu hỏi và bài tập có lời giải.','hints':['GDP','số nhân','lạm phát','chính sách tài khóa'],'note':'Các đáp án phân tích và giả định được giữ theo tài liệu bạn gửi; phần mở rộng được đánh dấu riêng.'},
 {'id':'nls','name':'Năng lực số','short':'Năng lực số','icon':'monitor','color':'#46775c','bg':'#e7f0e9','description':'166 câu hỏi theo 10 nhóm kiến thức, kèm đáp án tham khảo.','hints':['công dân số','tìm kiếm','quyền riêng tư','LMS'],'note':'Câu hỏi và đáp án tham khảo theo bản tổng hợp đã gửi. Câu 44 và 45 cần đối chiếu với giảng viên; mã đề gốc được giữ để tra lại.'},
 {'id':'hcm','name':'Tư tưởng Hồ Chí Minh','short':'Tư tưởng Hồ Chí Minh','icon':'book','color':'#b65f5d','bg':'#f7e9e7','description':'861 mục ôn tập thuộc 6 chương, giữ số câu và từ khóa.','hints':['độc lập dân tộc','đại đoàn kết','đạo đức','Đại hội VII'],'note':'8 mục thiếu hoặc mâu thuẫn đáp án được gắn nhãn Cần đối chiếu. Các dấu * và ghi chú hiệu chỉnh được giữ theo tài liệu.'},
 {'id':'startup','name':'Khởi nghiệp và đổi mới sáng tạo','short':'Đổi mới sáng tạo','icon':'bulb','color':'#a58032','bg':'#f7efda','description':'Chương 1–3, câu tự luyện và lời giải đề mẫu StudyQuiet.','hints':['MVP','BMC','xoay trục','tư duy thiết kế'],'note':'Lời giải và tình huống trong tài liệu phục vụ ôn tập, không phải đáp án chấm thi chính thức.'},
 {'id':'ai','name':'TTNTTKD · Dữ liệu và học máy','short':'TTNT trong kinh doanh','icon':'nodes','color':'#6b68a0','bg':'#eeecf7','description':'175 câu về dữ liệu, thống kê, phân lớp và phân cụm.','hints':['K-means','Big Data','Min-Max','phân lớp'],'note':'Giữ khóa đáp án của tài liệu; câu 129, 158 và 173 có lưu ý quan trọng. Câu 87 cũng cần đọc điều kiện trong phần giải thích.'}
]

# Question banks in PDF: preserve original bold keywords and complete answers.
nls_chapters=['Năng lực số và công dân số','Xã hội số và chuyển đổi số','Giao tiếp trên không gian số','Học tập số','Cộng tác trên không gian số','Nhu cầu thông tin và tìm kiếm','Đánh giá và sử dụng thông tin','Tổ chức thông tin và xử lý dữ liệu','Nội dung số và sáng tạo','An toàn thông tin và quyền riêng tư']
hcm_chapters=['Khái niệm và phương pháp nghiên cứu','Hình thành và phát triển tư tưởng','Độc lập dân tộc và chủ nghĩa xã hội','Đảng và Nhà nước của nhân dân','Đại đoàn kết và đoàn kết quốc tế','Văn hóa, đạo đức, con người']
for subject,filename,sid in [('nls','Nang_Luc_So_Cau_Hoi_Va_Dap_An(1).pdf','nls-qa'),('hcm','TuTuongHCM_OnTap_TuKhoa_DapAn(1).pdf','hcm-qa')]:
    p=source(filename,sid,subject,'Câu hỏi và đáp án Năng lực số' if subject=='nls' else 'Tư tưởng Hồ Chí Minh · Từ khóa và đáp án')
    doc=fitz.open(p); current=None; chapter=''; qparts=[]; aparts=[]; notes=[]; source_notes=[]; in_source_notes=False
    def flush():
        nonlocal_dummy=None
        if current:
            qh=' '.join(qparts); ah=''.join('<p>'+x+'</p>' for x in aparts)
            add(**current,title=plain(qh),titleHtml=qh,answerHtml=ah,bodyHtml=''.join('<p>'+x+'</p>' for x in notes))
    for pi,pg in enumerate(doc):
        if pi==0:continue
        if subject=='hcm' and pi>=86:
            bs=blocks(pg)
            add(subject=subject,source=sid,page=pi+1,type='note',chapter='Ghi chú và đối chiếu',title=('Câu cần đối chiếu và hiệu chỉnh' if pi==86 else 'Ghi chú hiệu chỉnh và nguồn đối chiếu')+f' · trang {pi+1}',bodyHtml=''.join('<p>'+block_html(b)+'</p>' for b in bs))
            continue
        for b in blocks(pg,bottom=748 if subject=='nls' else None):
            tx=block_text(b); bh=block_html(b)
            if subject=='nls' and tx=='Nguồn đối chiếu và phạm vi tài liệu':
                flush();current=None;in_source_notes=True;continue
            if in_source_notes:
                source_notes.append('<p>'+bh+'</p>');continue
            mx=max(s['size'] for l in b['lines'] for s in l['spans'])
            if mx>=14:
                if subject=='nls':
                    m=re.match(r'(\d+)\s+(.+)',tx)
                    if m:chapter=f"Nhóm {m[1]} · {m[2]}"
                continue
            if re.match(r'\d+ mục ôn tập',tx):continue
            if tx.startswith('Ghi nhớ:'):
                add(subject=subject,source=sid,page=pi+1,type='theory',chapter=chapter,title='Ghi nhớ · '+chapter.split(' · ')[-1],bodyHtml='<p>'+bh+'</p>');continue
            pat=r'^(\d{3})\.\s*' if subject=='nls' else r'^Câu\s+(\d+\.\d+[a-z]?)\.\s*'
            m=re.match(pat,tx)
            if m:
                flush(); num=m[1]
                if subject=='hcm':chapter=f"Chương {num.split('.')[0]} · {hcm_chapters[int(num.split('.')[0])-1]}"
                current={'subject':subject,'source':sid,'page':pi+1,'type':'question','chapter':chapter,'label':'Câu '+num,'id':subject+'-q-'+num,'status':'normal'}
                qparts=[strip_prefix(bh,pat)];aparts=[];notes=[]
            elif current:
                if tx.startswith('Đáp án:'):
                    aparts.append(strip_prefix(bh,r'^Đáp án:\s*'))
                elif tx.startswith(('Theo định nghĩa chuẩn:','Gợi ý theo lựa chọn của đề:')):
                    aparts.append(bh);current['status']='check'
                elif tx.startswith('CẦN ĐỐI CHIẾU'):
                    notes.append(bh);current['status']='check'
                elif tx.startswith('Cần đối chiếu:'):
                    current['status']='check';aparts.append(bh)
                elif tx.startswith(('Lưu ý:','Ghi chú:')):
                    notes.append(bh)
                elif aparts:notes.append(bh)
                else:qparts.append(bh)
    flush()
    if source_notes:add(subject=subject,source=sid,page=len(doc),type='note',chapter='Ghi chú và đối chiếu',title='Nguồn đối chiếu và phạm vi tài liệu',bodyHtml=''.join(source_notes))

def read_doc(p):
    d=Document(p); out=[]
    def pr(p):
        h=''.join(('<strong>'+E(r.text)+'</strong>') if r.bold else ('<em>'+E(r.text)+'</em>') if r.italic else E(r.text) for r in p.runs)
        return h or E(p.text)
    for el in d.element.body:
        if el.tag.endswith('}p'):
            pp=Paragraph(el,d);out.append({'type':'p','text':pp.text,'style':pp.style.name,'html':pr(pp)})
        elif el.tag.endswith('}tbl'):
            t=Table(el,d); rows=[]
            for row in t.rows:rows.append(['<br>'.join(pr(p) for p in c.paragraphs) for c in row.cells])
            h='<div class="table-scroll"><table>'+''.join('<tr>'+''.join(('<th>' if i==0 else '<td>')+c+('</th>' if i==0 else '</td>') for c in row)+'</tr>' for i,row in enumerate(rows))+'</table></div>'
            out.append({'type':'table','html':h,'text':plain(h),'rows':rows})
    return out
def doc_html(bs):
    out=[]
    for b in bs:
        if not b['text'].strip():continue
        if b['type']=='table':out.append(b['html'])
        else:
            tag='h3' if b['style'].startswith('Heading') else 'p'
            cl=' class="bullet"' if b['style']=='List Bullet' else ''
            out.append(f'<{tag}{cl}>'+b['html']+f'</{tag}>')
    return ''.join(out)

# TTNTTKD includes one explanatory answer per question, not the four distractors.
p=source('TTNTTKD_Phan_tich_va_dap_an_175_cau.docx','ai-qa','ai','TTNTTKD · Phân tích và đáp án 175 câu')
bs=read_doc(p); ch=''; current=None; warning={}; wn=None
for b in bs[19:35]:
    m=re.match(r'Câu (129|158|173) về',b['text'])
    if m:wn=m[1];warning[wn]=[]
    elif wn and b.get('style')=='Normal' and b['text']:warning[wn].append('<p>'+b['html']+'</p>')
    elif b['text']=='Các lưu ý bổ sung':wn=None
for i,b in enumerate(bs):
    if b.get('style')=='Heading 2' and re.match(r'Câu \d+ đến',b['text']):ch=b['text'].replace('Câu ','Nhóm ')
    m=re.match(r'Câu (\d+)\.\s*(.*)',b['text'])
    if m and b.get('style')=='Normal':
        n=m[1];ans=bs[i+1]
        ah=strip_prefix(ans['html'],r'^Đáp án\s+[ABCD]\*?\.\s*')
        key=re.search(r'Đáp án\s+([ABCD])',ans['text'])
        add(id='ai-q-'+n,subject='ai',source='ai-qa',type='question',chapter=ch,label='Câu '+n,title=m[2],titleHtml=strip_prefix(b['html'],r'^Câu \d+\.\s*'),answerHtml='<p>'+ah+'</p>',key=key[1] if key else '',status='check' if n in ['129','158','173','87'] else 'normal',noteHtml=''.join(warning.get(n,[])))
    if b['type']=='table' and i==36:
        for row in b['rows'][1:]:add(subject='ai',source='ai-qa',type='theory',chapter='Kiến thức cần nhớ',title=plain(row[0]),bodyHtml='<p>'+row[1]+'</p>')
add(subject='ai',source='ai-qa',type='note',chapter='Ghi chú và đối chiếu',title='Những câu cần làm rõ trước khi học thuộc',bodyHtml=doc_html(bs[19:35]),status='check')
add(subject='ai',source='ai-qa',type='note',chapter='Ghi chú và đối chiếu',title='Nguồn đối chiếu các lưu ý chuyên môn',bodyHtml=doc_html(bs[398:]))

# Startup chapter sections, preserving rich text and tables.
p=source('DoiMoiSangTao_On_tap_chuyen_sau_Khoi_nghiep_Chuong_1_2_3.docx','startup-theory','startup','Khởi nghiệp và đổi mới sáng tạo · Ôn chuyên sâu chương 1–3')
bs=read_doc(p); chapter='Hướng dẫn ôn tập'; root_title=''; section=[]; heading='Cách sử dụng tài liệu'
def add_startup_section():
    if any(b['text'].strip() for b in section):add(subject='startup',source='startup-theory',type='theory',chapter=chapter,title=heading,bodyHtml=doc_html(section),context=root_title)
for b in bs[:308]:
    if b.get('style')=='Title':continue
    if b.get('style')=='Heading 1':
        add_startup_section();section=[];root_title=b['text'];heading=root_title
        m=re.match(r'Chương (\d+)',root_title)
        chapter={'1':'Chương 1 · Bản chất khởi nghiệp','2':'Chương 2 · Ý tưởng và kiểm chứng','3':'Chương 3 · Mô hình kinh doanh'}.get(m[1] if m else '',chapter)
    elif b.get('style')=='Heading 2':add_startup_section();section=[];heading=b['text']
    else:section.append(b)
add_startup_section()
questions={}
for b in bs[308:333]:
    m=re.match(r'Câu (\d+)\.\s*(.*)',b['text'])
    if m:questions[int(m[1])]=m[2]
answers={}; active=None
for b in bs[333:372]:
    if b.get('style')=='Heading 2':
        m=re.fullmatch(r'Câu (\d+)',b['text']);active=int(m[1]) if m else None
        if active:answers[active]=[]
    elif b.get('style')=='Normal' and re.match(r'Câu \d+:',b['text']):
        m=re.match(r'Câu (\d+):\s*(.*)',b['text']);answers[int(m[1])]=[dict(b,html=E(m[2]),text=m[2])]
    elif active and b.get('style')!='Heading 1':answers[active].append(b)
for n,q in questions.items():
    add(id='startup-practice-'+str(n),subject='startup',source='startup-theory',type='exercise',chapter='Câu tự luyện · Chương '+('1' if n<=6 else '2' if n<=12 else '3'),label='Câu tự luyện '+str(n),title=q,answerHtml=doc_html(answers[n]))
add(subject='startup',source='startup-theory',type='note',chapter='Hướng dẫn ôn tập',title='Bảng kiểm và tài liệu đối chiếu',bodyHtml=doc_html(bs[372:]))
p=source('DoiMoiSangTao_De_mau_nanana_va_loi_giai_chi_tiet.docx','startup-exam','startup','Đề mẫu nanana · Tình huống StudyQuiet và lời giải')
bs=read_doc(p)
for label,qi,a,b in [('1a',3,14,32),('1b',4,33,40),('1c',5,40,49),('2.1',8,49,62),('2.2',9,62,75),('2.3',10,75,89),('2.4',11,89,len(bs))]:
    q=re.sub(r'^(?:[abc]|\d+)\.\s*','',bs[qi]['text'])
    add(id='startup-exam-'+label,subject='startup',source='startup-exam',type='exercise',chapter='Đề mẫu · StudyQuiet',label='Câu '+label,title=q,bodyHtml=('<h3>Tình huống StudyQuiet</h3><p>'+bs[7]['html']+'</p>' if label.startswith('2') else ''),answerHtml=doc_html(bs[a:b]))

# Reconstruct PDF tables from the actual row rules and header positions.
def pdf_tables(pg,bs):
    drawings=pg.get_drawings();heads=[];rules=[]
    for d in drawings:
        r=d['rect']
        if r.y0<45 or r.y1>780 or r.width<200:continue
        if d['fill'] and d['fill'][2]>.85 and d['fill'][0]<d['fill'][2] and 10<r.height<70:heads.append(r)
        if d['type']=='s' and r.height<1:rules.append(r)
    heads.sort(key=lambda r:r.y0); tables=[]
    for hi,h in enumerate(heads):
        hlines=[l for b in bs for l in b['lines'] if h.y0<=l['bbox'][1]<h.y1]
        # Headers start each column; continuation lines share x coordinates.
        starts=[]
        for l in sorted(hlines,key=lambda l:l['bbox'][0]):
            x=l['bbox'][0]
            if not starts or x-starts[-1]>18:starts.append(x)
        if len(starts)<2:continue
        endlimit=heads[hi+1].y0 if hi+1<len(heads) else 780
        ys=sorted(set(round(r.y0,2) for r in rules if abs(r.x0-h.x0)<2 and h.y1-.1<=r.y0<endlimit))
        if not ys:continue
        # Tables have consecutive ruled rows, no huge empty gap.
        end=ys[0]
        for y in ys[1:]:
            if y-end>120:break
            end=y
        bounds=[h.x0]+[s-4 for s in starts[1:]]+[h.x1+2]
        ybounds=[h.y0]+[y for y in ys if y<=end]
        rows=[]
        for a,b in zip(ybounds,ybounds[1:]):
            cells=[]
            for x0,x1 in zip(bounds,bounds[1:]):
                ls=[l for bb in bs for l in bb['lines'] if a<=l['bbox'][1]<b and x0<=l['bbox'][0]<x1]
                ls.sort(key=lambda l:(round(l['bbox'][1],1),l['bbox'][0]))
                cells.append(' '.join(line_html(l) for l in ls))
            rows.append(cells)
        th='<div class="table-scroll"><table>'+''.join('<tr>'+''.join(('<th>' if i==0 else '<td>')+x+('</th>' if i==0 else '</td>') for x in row)+'</tr>' for i,row in enumerate(rows))+'</table></div>'
        tables.append({'y0':h.y0,'y1':end,'rows':rows,'html':th})
    return tables
def page_content(pg,bs,tables):
    parts=[(t['y0'],t['html']) for t in tables]
    for b in bs:
        if any(t['y0']<=b['bbox'][1]<t['y1'] for t in tables):continue
        size=max(s['size'] for l in b['lines'] for s in l['spans'])
        tag='h3' if size>=11.8 else 'p'
        parts.append((b['bbox'][1],f'<{tag}>'+block_html(b)+f'</{tag}>'))
    return ''.join(v for _,v in sorted(parts))

for filename,sid,title in [('KTVM_On_tap_ly_thuyet_KTVM_UFM_Chuong_1_4.pdf','ktvm-theory','Kinh tế vĩ mô · Lý thuyết chương 1–4'),('KTVM_Bai_tap_tu_luan_KTVM_UFM_Chuong_1_4.pdf','ktvm-exercises','Kinh tế vĩ mô · Bài tập tự luận có lời giải')]:
    p=source(filename,sid,'ktvm',title);doc=fitz.open(p)
    for i,pg in enumerate(doc):
        bs=blocks(pg); tables=pdf_tables(pg,bs)
        headings=[b for b in bs if max(s['size'] for l in b['lines'] for s in l['spans'])>=17]
        title=' '.join(block_text(b) for b in headings) or 'Tài liệu · trang '+str(i+1)
        bh=page_content(pg,[b for b in bs if b not in headings],tables)
        pno=i+1
        if sid=='ktvm-theory':
            m=re.match(r'([1-4])[AB]\.',title)
            chapter=('Chương '+m[1]+' · '+{'1':'Tổng quan và chỉ tiêu','2':'Hạch toán quốc gia','3':'Sản lượng cân bằng','4':'Chính sách tài khóa'}[m[1]]) if m else ('Câu hỏi K1 · Chương 3–4' if 11<=pno<=12 else 'Câu hỏi K2 · Chương 1–4' if 13<=pno<=15 else 'Câu hỏi K3 · Chương 1–2' if 16<=pno<=17 else 'Đề A và kiến thức nền' if pno>=18 else 'Hướng dẫn và công thức')
            typ='theory' if pno<=10 else 'note'
        else:
            cn=1 if 3<=pno<=7 else 2 if 8<=pno<=15 else 3 if 16<=pno<=19 else 4 if 20<=pno<=25 else None
            chapter='Chương '+str(cn)+' · Bài tập tự luận' if cn else 'Công thức và phụ lục'
            typ='exercise' if 3<=pno<=30 else 'theory' if pno==2 else 'note'
        # Keep all source pages, including data tables and diagrams.
        from PIL import Image
        pix=pg.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False)
        img=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
        image_url=f'pages/{sid}-{pno}.webp';img.save(DIST/image_url,'WEBP',quality=88)
        entry=add(id=f'{sid}-p{pno}',subject='ktvm',source=sid,page=pno,type=typ,chapter=chapter,title=title,bodyHtml=bh,image=image_url)
        # Individual table questions are searchable on their own as well.
        if sid=='ktvm-theory' and 11<=pno<=21:
            for tab in tables:
                for row in tab['rows'][1:]:
                    code=plain(row[0])
                    if not re.fullmatch(r'(?:K[123]\.\d+|D\.\d+|M\d+)',code):continue
                    qh=row[1];qt=plain(qh)
                    # Answer is bold in the second column. Preserve complete interpretation alongside it.
                    mm=re.search(r'([ABCD][*.]?\s*(?:\.|\*|là)[\s\S]*)',qt)
                    if mm:
                        question=qt[:mm.start()].strip();answer=mm[1]
                    else:question=qt;answer=''
                    add(id='ktvm-'+code,subject='ktvm',source=sid,page=pno,type='question',chapter=chapter,label=code,title=question or qt,answerHtml=('<p><strong>'+E(answer)+'</strong></p>' if answer else '')+''.join('<p>'+x+'</p>' for x in row[2:]),status='note' if '*' in qt else 'normal')

# Attach editorial explanations to the eight unresolved HCM questions.
hcm_doc=fitz.open(DIST/'sources'/'hcm-qa.pdf')
for b in blocks(hcm_doc[86]):
    t=block_text(b);m=re.match(r'Câu (\d+\.\d+[a-z]?)\.\s*(.*)',t)
    if m:
        for item in items:
            if item['id']=='hcm-q-'+m[1] and item['status']=='check':item['noteHtml']='<p>'+E(m[2])+'</p>'

for s in subjects:
    si=[i for i in items if i['subject']==s['id']]
    s['chapters']=list(dict.fromkeys(i['chapter'] for i in si))
    s['counts']={t:sum(i['type']==t for i in si) for t in ['question','theory','exercise','note']}
    s['count']=len(si)
for i in items:i['text']=plain(' '.join([i['titleHtml'],i['bodyHtml'],i['answerHtml'],i.get('noteHtml','')]))
data={'title':'Góc ôn tập','subjects':subjects,'sources':sources,'items':items,'version':1}
(DIST/'content.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'total':len(items),'subjects':[{s['id']:s['counts']} for s in subjects],'checks':sum(i['status']=='check' for i in items)},ensure_ascii=False,indent=2))
assert len([i for i in items if i['subject']=='hcm' and i['type']=='question'])==861
assert len([i for i in items if i['subject']=='nls' and i['type']=='question'])==166
assert len([i for i in items if i['subject']=='ai' and i['type']=='question'])==175
assert len(set(i['id'] for i in items))==len(items)
assert all(i['title'].strip() and i['text'].strip() for i in items)
