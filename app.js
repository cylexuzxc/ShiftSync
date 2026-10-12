// ShiftSync prototype logic. Uses sample data from data.js (no backend).
const S = {user:null, view:null, week:mon(new Date())};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const user = id => DB.users.find(u => u.id == id);
const shift = id => DB.shifts.find(s => s.id == id);
const emps = () => DB.users.filter(u => u.role === 'employee');
const fmtD = d => new Date(d + 'T00:00').toLocaleDateString('en', {weekday:'short', month:'short', day:'numeric'});
const pill = s => `<span class="pill" style="--c:${s.color}">${esc(s.name)} ${s.start}–${s.end}</span>`;
const badge = s => `<span class="badge ${s}">${s}</span>`;
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const NAV = {
  employee: [['dash','Dashboard'],['sched','My Schedule'],['leave','Request Leave']],
  admin: [['adash','Dashboard'],['asched','Schedules'],['aleave','Leave Requests']]
};

function toast(m, err) {
  const t = $('#toast'); t.textContent = m; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 3000);
}
const onLeave = (id, d) => DB.leaves.some(l => l.emp == id && l.status === 'approved' && l.start <= d && d <= l.end);

function leaveList(ls) {
  if (!ls.length) return '<p class="empty">No leave requests yet.</p>';
  return `<ul class="list">${ls.map(l => `<li><span><b>${esc(l.type)}</b><br><span class="muted small">${fmtD(l.start)} – ${fmtD(l.end)}${l.remarks ? ' · ' + esc(l.remarks) : ''}</span></span>${badge(l.status)}</li>`).join('')}</ul>`;
}

// Weekly schedule grid; edit=true makes cells clickable (admin)
function grid(list, edit) {
  const days = [...Array(7)].map((_, i) => add(S.week, i)), today = ymd(new Date());
  const r = d => d.toLocaleDateString('en', {month:'short', day:'numeric'});
  return `<div class="wk"><button class="btn ghost" data-act="wk" data-n="-1">‹ Prev</button><button class="btn ghost" data-act="wk" data-n="0">This week</button><button class="btn ghost" data-act="wk" data-n="1">Next ›</button><b>${r(days[0])} – ${r(days[6])}</b></div>
  <div class="scroll"><table class="grid"><thead><tr><th>Employee</th>${days.map((d, i) => `<th class="${ymd(d) == today ? 'today' : ''}">${DAYS[i]} ${d.getDate()}</th>`).join('')}</tr></thead><tbody>
  ${list.map(e => `<tr><th>${esc(e.name)}</th>${days.map(d => {
    const x = DB.schedules.find(s => s.emp == e.id && s.date == ymd(d));
    const c = x ? pill(shift(x.shift)) : onLeave(e.id, ymd(d)) ? '<span class="badge approved">On leave</span>' : '<span class="muted">—</span>';
    return `<td>${edit ? `<button class="cell" data-act="cell" data-emp="${e.id}" data-date="${ymd(d)}" aria-label="Edit shift">${c}</button>` : c}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const VIEWS = {
  dash() {
    const me = S.user, t = ymd(new Date());
    const up = DB.schedules.filter(s => s.emp == me.id && s.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const ls = DB.leaves.filter(l => l.emp == me.id).slice(-3).reverse();
    return `<div class="head"><h1>Welcome, ${esc(me.name.split(' ')[0])}</h1><button class="btn" data-act="go" data-v="leave">Request Leave</button></div>
    <div class="cols"><section class="card"><h2>Upcoming shifts</h2>${up.length ? `<ul class="list">${up.map(s => `<li><span>${fmtD(s.date)}</span>${pill(shift(s.shift))}</li>`).join('')}</ul>` : '<p class="empty">No upcoming shifts.</p>'}</section>
    <section class="card"><h2>Recent leave requests</h2>${leaveList(ls)}</section></div>
    <section class="card"><h2>My week</h2>${grid([me])}</section>`;
  },
  sched() { return `<div class="head"><h1>My Schedule</h1></div><section class="card">${grid([S.user])}</section>`; },
  leave() {
    const mine = DB.leaves.filter(l => l.emp == S.user.id).reverse();
    return `<div class="head"><h1>Request Leave</h1></div><div class="cols">
    <section class="card"><form data-form="leave" novalidate>
      <label for="lt">Leave type</label><select id="lt" name="type"><option value="">Select…</option><option>Vacation</option><option>Sick</option><option>Personal</option><option>Emergency</option></select>
      <label for="ls">Start date</label><input id="ls" name="start" type="date">
      <label for="le">End date</label><input id="le" name="end" type="date">
      <label for="lr">Reason</label><textarea id="lr" name="reason" rows="3"></textarea>
      <p class="err" id="lerr2"></p><button class="btn">Submit request</button></form></section>
    <section class="card"><h2>My requests</h2>${leaveList(mine)}</section></div>`;
  },
  adash() {
    const t = ymd(new Date()), today = DB.schedules.filter(s => s.date == t);
    const pend = DB.leaves.filter(l => l.status == 'pending').length;
    return `<div class="head"><h1>Admin Dashboard</h1></div>
    <div class="stats"><div class="card stat"><b>${emps().length}</b>Total employees</div><div class="card stat"><b>${today.length}</b>Today's shifts</div><div class="card stat"><b>${pend}</b>Pending leave requests</div></div>
    <div class="cols"><section class="card"><h2>Today's shifts</h2>${today.length ? `<ul class="list">${today.map(s => `<li><span>${esc(user(s.emp).name)}</span>${pill(shift(s.shift))}</li>`).join('')}</ul>` : '<p class="empty">No shifts today.</p>'}</section>
    <section class="card"><h2>Quick actions</h2><div class="row" style="justify-content:flex-start;margin-top:0"><button class="btn" data-act="assign">Assign shift</button><button class="btn vio" data-act="go" data-v="aleave">Review leave</button><button class="btn ghost" data-act="go" data-v="asched">View schedule</button></div></section></div>`;
  },
  asched() {
    return `<div class="head"><h1>Schedule Management</h1><div class="row" style="margin:0"><button class="btn ghost" data-act="types">Manage shift types</button><button class="btn" data-act="assign">Assign shift</button></div></div>
    <section class="card"><p class="muted small">Click any cell to add, edit, or remove an assignment.</p>${grid(emps(), true)}</section>`;
  },
  aleave() {
    const p = DB.leaves.filter(l => l.status == 'pending'), h = DB.leaves.filter(l => l.status != 'pending').reverse();
    return `<div class="head"><h1>Leave Management</h1></div>
    <section class="card"><h2>Pending requests (${p.length})</h2>${p.length ? `<div class="scroll"><table><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Remarks</th><th></th></tr></thead><tbody>${p.map(l => `<tr><td>${esc(user(l.emp).name)}</td><td>${esc(l.type)}</td><td>${fmtD(l.start)} – ${fmtD(l.end)}</td><td>${esc(l.reason)}</td><td><input id="rm${l.id}" placeholder="Optional remark"></td><td style="white-space:nowrap"><button class="btn ok" data-act="review" data-id="${l.id}" data-s="approved">Approve</button> <button class="btn no" data-act="review" data-id="${l.id}" data-s="rejected">Reject</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No pending requests. All caught up!</p>'}</section>
    <section class="card"><h2>History</h2>${h.length ? `<table><tbody>${h.map(l => `<tr><td>${esc(user(l.emp).name)}</td><td>${esc(l.type)}</td><td>${fmtD(l.start)} – ${fmtD(l.end)}</td><td>${badge(l.status)}</td><td class="muted">${esc(l.remarks)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No reviewed requests.</p>'}</section>`;
  }
};

function go(v) {
  S.view = v; $('#side').classList.remove('open');
  $('#nav').innerHTML = NAV[S.user.role].map(([k, n]) => `<button class="${k == v ? 'on' : ''}" data-act="go" data-v="${k}">${n}</button>`).join('');
  $('#view').innerHTML = VIEWS[v]();
}

function login(email, pw) {
  const u = DB.users.find(u => u.email == String(email).trim().toLowerCase());
  if (!email || !pw) { $('#lerr').textContent = 'Email and password are required.'; return; }
  if (!u || pw !== 'demo123') { $('#lerr').textContent = 'Invalid login. Demo password is demo123.'; return; }
  S.user = u; S.week = mon(new Date()); $('#lerr').textContent = '';
  $('#login').hidden = true; $('#app').hidden = false;
  $('#who').textContent = `${u.name} (${u.role})`;
  go(u.role == 'admin' ? 'adash' : 'dash');
}

function assign(emp, date, fromCell) {
  const x = fromCell ? DB.schedules.find(s => s.emp == emp && s.date == date) : null;
  const opt = (arr, sel, lab) => arr.map(o => `<option value="${o.id}" ${o.id == sel ? 'selected' : ''}>${esc(lab(o))}</option>`).join('');
  $('#dlg').innerHTML = `<h2>${x ? 'Edit' : 'Assign'} shift</h2><form data-form="shift" novalidate><input type="hidden" name="id" value="${x ? x.id : ''}">
    <label>Employee</label><select name="emp"><option value="">Select…</option>${opt(emps(), emp, u => u.name)}</select>
    <label>Date</label><input type="date" name="date" value="${date || ''}">
    <label>Shift</label><select name="shift"><option value="">Select…</option>${opt(DB.shifts, x && x.shift, s => `${s.name} ${s.start}–${s.end}`)}</select>
    <label>Notes</label><input name="notes" value="${x ? esc(x.notes) : ''}">
    <div class="row">${x ? `<button type="button" class="btn no" data-act="del" data-id="${x.id}">Delete</button>` : ''}<button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">Save</button></div></form>`;
  $('#dlg').showModal();
}

function types(id) {
  const x = DB.shifts.find(s => s.id == id) || {name:'', start:'09:00', end:'17:00', color:'#2563eb'};
  $('#dlg').innerHTML = `<h2>Shift types</h2><ul class="list">${DB.shifts.map(s => `<li>${pill(s)}<button class="btn ghost" data-act="etype" data-id="${s.id}">Edit</button></li>`).join('')}</ul>
    <form data-form="type" novalidate><h2 style="margin-top:16px">${id ? 'Edit' : 'Add'} shift type</h2><input type="hidden" name="id" value="${id || ''}">
    <label>Name</label><input name="name" value="${esc(x.name)}"><label>Start</label><input type="time" name="start" value="${x.start}">
    <label>End</label><input type="time" name="end" value="${x.end}"><label>Color</label><input type="color" name="color" value="${x.color}">
    <div class="row"><button type="button" class="btn ghost" data-act="close">Close</button><button class="btn">${id ? 'Update' : 'Add'}</button></div></form>`;
  if (!$('#dlg').open) $('#dlg').showModal();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const d = b.dataset, a = d.act;
  if (a == 'go') go(d.v);
  else if (a == 'wk') { S.week = d.n == 0 ? mon(new Date()) : add(S.week, 7 * d.n); go(S.view); }
  else if (a == 'close') $('#dlg').close();
  else if (a == 'cell') assign(d.emp, d.date, true);
  else if (a == 'assign') assign();
  else if (a == 'types') types();
  else if (a == 'etype') types(d.id);
  else if (a == 'del') { DB.schedules = DB.schedules.filter(s => s.id != d.id); $('#dlg').close(); toast('Shift removed.'); go(S.view); }
  else if (a == 'review') {
    const l = DB.leaves.find(x => x.id == d.id), r = $('#rm' + d.id).value.trim();
    if (d.s == 'rejected' && !r) return toast('Please add a remark when rejecting.', 1);
    l.status = d.s; l.remarks = r; toast('Request ' + d.s + '.'); go(S.view);
  }
  else if (a == 'demo') login(d.e, 'demo123');
  else if (a == 'logout') { S.user = null; $('#app').hidden = true; $('#login').hidden = false; }
  else if (a == 'menu') $('#side').classList.toggle('open');
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const k = e.target.dataset.form; if (!k) return;
  const v = Object.fromEntries(new FormData(e.target));
  const nextId = arr => Math.max(0, ...arr.map(x => x.id)) + 1;
  if (k == 'login') login(v.email, v.pw);
  if (k == 'leave') {
    const er = !v.type ? 'Choose a leave type.' : !v.start || !v.end ? 'Start and end dates are required.' : v.end < v.start ? 'End date cannot be before start date.' : v.reason.trim().length < 5 ? 'Please give a reason (at least 5 characters).' : '';
    if (er) { $('#lerr2').textContent = er; return toast(er, 1); }
    DB.leaves.push({id:nextId(DB.leaves), emp:S.user.id, type:v.type, start:v.start, end:v.end, reason:v.reason.trim(), status:'pending', remarks:''});
    toast('Leave request submitted (status: pending).'); go('leave');
  }
  if (k == 'shift') {
    if (!v.emp || !v.date || !v.shift) return toast('Employee, date, and shift are required.', 1);
    if (DB.schedules.some(s => s.emp == v.emp && s.date == v.date && s.id != v.id)) return toast('That employee already has a shift on this date. Edit it instead.', 1);
    if (onLeave(v.emp, v.date)) return toast('Employee is on approved leave that day.', 1);
    const rec = {emp:+v.emp, shift:+v.shift, date:v.date, notes:v.notes.trim()};
    if (v.id) Object.assign(DB.schedules.find(s => s.id == v.id), rec); else DB.schedules.push({id:nextId(DB.schedules), ...rec});
    $('#dlg').close(); toast('Shift saved.'); go(S.view);
  }
  if (k == 'type') {
    if (!v.name.trim() || !v.start || !v.end || v.start == v.end) return toast('Enter a name and different start/end times.', 1);
    const rec = {name:v.name.trim(), start:v.start, end:v.end, color:v.color};
    if (v.id) Object.assign(shift(v.id), rec); else DB.shifts.push({id:nextId(DB.shifts), ...rec});
    $('#dlg').close(); toast('Shift type saved.'); go(S.view);
  }
});
