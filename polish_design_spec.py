from pathlib import Path
# Historical one-time source migration; not part of document generation.
p=Path(__file__).resolve().with_name('build_design_spec.py')
s=p.read_text(encoding='utf-8-sig')
old="        d.polygon(pts,fill='#173A59');d.text(pos,label,font=small,fill='#173A59',anchor='mm')"
new="""        d.polygon(pts,fill='#173A59')
        if label!='版本同步':
            x,y=start
            back=[(x,y),(x+15,y-8),(x+15,y+8)] if end[0]>start[0] else [(x,y),(x-8,y+15),(x+8,y+15)]
            d.polygon(back,fill='#173A59')
        d.text(pos,label,font=small,fill='#173A59',anchor='mm')"""
assert old in s
s=s.replace(old,new)
old='历史会话中“除了4全部都要”未保留对应编号清单，本版不据此扩张功能；以已形成的原型范围为准，定时启停暂不纳入。'
new='本版以需求基线和已形成的原型范围为准，定时启停暂不纳入；新增能力按范围变更流程评审。'
assert old in s
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')

