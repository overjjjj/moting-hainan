from pathlib import Path

target = Path(__file__).with_name('workflow-controller.js')
source = target.read_text(encoding='utf-8')
changes = [
    ("rent:'',paid:'',reference:'',start:", "rent:'',paid:'',paidAt:M.NOW.slice(0,10),reference:'',start:"),
    ("['device','phone','number','rent','paid','reference','start','end']", "['device','phone','number','rent','paid','paidAt','reference','start','end']"),
    ("<label class=\"ia-field\">付款记录编号<input id=\"wf-contract-reference\"", "<label class=\"ia-field\">实际收款日期 *<input id=\"wf-contract-paidAt\" type=\"date\" max=\"'+M.NOW.slice(0,10)+'\" value=\"'+esc(contractDraft.paidAt)+'\"></label><label class=\"ia-field\">付款记录编号<input id=\"wf-contract-reference\""),
    ("['本期实收','¥ '+v.paid.toFixed(2)]", "['本期实收','¥ '+v.paid.toFixed(2)],['实际收款日期',v.paidAt]"),
    ("<label class=\"wf-check-line\"><input id=\"wf-renew-confirmed\"", "<label class=\"ia-field\">实际收款日期<input id=\"wf-renew-paidAt\" type=\"date\" max=\"'+M.NOW.slice(0,10)+'\" value=\"'+M.NOW.slice(0,10)+'\"></label><label class=\"ia-field\">付款记录编号<input id=\"wf-renew-reference\" placeholder=\"选填\"></label><label class=\"wf-check-line\"><input id=\"wf-renew-confirmed\""),
    ("root.querySelector('#wf-renew-confirmed').checked);", "root.querySelector('#wf-renew-confirmed').checked,root.querySelector('#wf-renew-paidAt').value,root.querySelector('#wf-renew-reference').value);"),
    ("['本期实收','¥ '+c.paid.toFixed(2)]", "['首次登记实收','¥ '+c.paid.toFixed(2)],['首次收款日期',c.paidAt||'未登记日期']"),
    ('月租 / 本期实收', '月租 / 首次实收'),
    ('<small>本期实收 ¥ ', '<small>首次实收 ¥ '),
]
for old, new in changes:
    assert source.count(old) == 1, (old, source.count(old))
    source = source.replace(old, new)
target.write_text(source, encoding='utf-8')
