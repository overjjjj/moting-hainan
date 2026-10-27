from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
VIZ = ROOT / 'previews'

def components(name):
    source = (VIZ / name).read_text(encoding='utf-8')
    return source.split('<style>')[0], re.search(r'<style>(.*?)</style>', source, re.S).group(1)

mini, mini_css = components('inverter-mini-preview.html')
mini = mini.replace('客户小程序', '手机小程序')
admin, admin_css = components('inverter-admin-preview.html')
admin = admin.replace('<button type="button" data-page="permissions">', '<button type="button" data-page="reports"><i data-lucide="table-2" aria-hidden="true"></i><span>统计报表</span></button><button type="button" data-page="income"><i data-lucide="wallet" aria-hidden="true"></i><span>收款明细</span></button><button type="button" data-page="permissions">')
shell = (ROOT / 'workflow-shell.html').read_text(encoding='utf-8')
admin = admin.replace('<button type="button" data-page="permissions">', '<button type="button" data-page="backup"><i data-lucide="hard-drive" aria-hidden="true"></i><span>用户数据与备份</span></button><button type="button" data-page="permissions">')
shell = shell.replace('<!-- MINI_MARKUP -->', mini).replace('<!-- ADMIN_MARKUP -->', admin)
extra = (ROOT / 'workflow-extra.css').read_text(encoding='utf-8') + '\n' + (ROOT / 'unified-theme.css').read_text(encoding='utf-8-sig')
model = (ROOT / 'workflow-model.js').read_text(encoding='utf-8')
model += '\n' + (ROOT / 'user-backup-model.js').read_text(encoding='utf-8')
controller = (ROOT / 'workflow-controller.js').read_text(encoding='utf-8')
controller = controller.replace('  function renderMini(){', (ROOT / 'mobile-inventory-controller.inc.js').read_text(encoding='utf-8') + '\n  function renderMini(){if(M.canInventory(store,ui.user)){renderStaffMini();return;}mini.classList.remove("wf-staff");')
controller = controller.replace('  function renderAdmin()', (ROOT / 'income-controller.inc.js').read_text(encoding='utf-8') + '\n  function renderAdmin()')
controller = controller.replace('  function renderAdmin()', (ROOT / 'reports-controller.inc.js').read_text(encoding='utf-8') + '\n  function renderAdmin()')
controller = controller.replace('  function renderAdmin()', (ROOT / 'user-backup-controller.inc.js').read_text(encoding='utf-8') + '\n  function renderAdmin()')
controller = controller.replace('leases:adminLeases,permissions:', 'leases:adminLeases,income:adminIncome,reports:adminReports,backup:adminUserBackup,permissions:')
output = shell + '\n<style>\n' + mini_css + '\n' + admin_css + '\n' + extra + '\n</style>\n<script>\n' + model + '\n' + controller + '\n</script>\n'
target = VIZ / 'inverter-rental-workflow.html'
target.write_text(output, encoding='utf-8')
print(target)

