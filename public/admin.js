let token = localStorage.getItem('adminToken');
const api = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body) }).then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error || 'err'); return d; }));
function showPanel() { document.getElementById('loginBox').style.display = 'none'; document.getElementById('panelBox').style.display = 'block'; }
if (token) showPanel();
document.getElementById('loginBtn').onclick = async () => {
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('au').value, password: document.getElementById('ap').value }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    token = d.token; localStorage.setItem('adminToken', token); showPanel();
  } catch (e) { document.getElementById('err').textContent = e.message; }
};
document.getElementById('giveBtn').onclick = async () => {
  try {
    await api('/api/admin/give', { username: document.getElementById('g_user').value, pera: +document.getElementById('g_pera').value, energiya: +document.getElementById('g_en').value, kristal: +document.getElementById('g_kristal').value, xp: +document.getElementById('g_xp').value });
    document.getElementById('msg').textContent = 'Resources given!';
  } catch (e) { document.getElementById('msg').textContent = e.message; }
};
document.getElementById('announceBtn').onclick = async () => {
  try {
    await api('/api/admin/announce', { message: document.getElementById('a_msg').value });
    document.getElementById('msg').textContent = 'Announcement broadcasted!';
  } catch (e) { document.getElementById('msg').textContent = e.message; }
};