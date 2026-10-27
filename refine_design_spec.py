from pathlib import Path
# Historical one-time source migration; not part of document generation.
p=Path(__file__).resolve().with_name('build_design_spec.py')
s=p.read_text(encoding='utf-8-sig')
s=s.replace("doc.add_page_break();doc.add_heading(title,1);chapters.append(title)","para=doc.add_heading(title,1);para.paragraph_format.page_break_before=True;chapters.append(title)")
s=s.replace("p('第一所有人、租期和权限保存变更历史，不只存当前值。财务与命令保留提交时的必要快照，便于用户资料变更后追溯。设备历史按稳定deviceId关联，不因4G模块更换而拆散。')\nh('未知值')\np('缺失的日期、温度或状态不得用“今天”、0或“正常”补齐。保存null和原因，在页面显示未登记、未提供或待确认，并在统计时单独处理。')","p('归属、租期和权限保存变更历史；财务与命令保留必要的提交快照。设备历史按稳定deviceId关联。未知日期、测点和状态保存null及原因，页面显示未登记、未提供或待确认，不用今天、0或正常补齐。')")
s=s.replace("p('错误应区分无权限、设备未入库、重复模块、合同冲突、租期已过、设备离线、同步未完成和执行结果待确认；禁止只返回统一“操作失败”。',True)","")
s=s.replace("st.paragraph_format.line_spacing=1.16","st.paragraph_format.line_spacing=1.16\n    st.font.italic=False")
p.write_text(s,encoding='utf-8')

