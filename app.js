const STORAGE_KEY = 'scaia_records_v1';
const USERS_KEY = 'scaia_teachers_v1';
const SESSION_KEY = 'scaia_session_v1';
const $ = (id) => document.getElementById(id);
let currentUser = null;
let records = [];
let filteredRecords = [];
let deleteTarget = null;

// Persistência e utilitários de apresentação.
function loadRecords() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${currentUser.id}`)) || []; }
  catch { return []; }
}
function saveRecords() { if (currentUser) localStorage.setItem(`${STORAGE_KEY}_${currentUser.id}`, JSON.stringify(records)); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalize(value = '') { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function formatDate(date) { if (!date) return '—'; return new Intl.DateTimeFormat('pt-BR', { timeZone:'UTC' }).format(new Date(date + 'T00:00:00Z')); }
function uniqueValues(field) { return [...new Set(records.map(r => r[field]).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR')); }
function statusClass(status) { return `status-${status.replaceAll(' ', '-')}`; }

// Contas locais: cada professor possui sessão e registros independentes.
function loadUsers() {
  const officialUsers = [
    { id:'prof-joao-vitor', name:'João Vitor', password:'joao123' },
    { id:'prof-dani', name:'Dani', password:'dani123' }
  ];
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    if (Array.isArray(saved) && saved.length) {
      // Remove a antiga demonstração, preserva contas criadas e garante as duas contas oficiais.
      const users = saved.filter(user => user.id !== 'prof-ana');
      officialUsers.forEach(official => {
        const index = users.findIndex(user => user.id === official.id);
        if (index >= 0) users[index] = official; else users.push(official);
      });
      const oldRecords = localStorage.getItem(`${STORAGE_KEY}_prof-ana`);
      const joaoKey = `${STORAGE_KEY}_prof-joao-vitor`;
      if (oldRecords && !localStorage.getItem(joaoKey)) localStorage.setItem(joaoKey, oldRecords);
      localStorage.removeItem(`${STORAGE_KEY}_prof-ana`);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return users;
    }
  } catch {}
  localStorage.setItem(USERS_KEY, JSON.stringify(officialUsers));
  return officialUsers;
}
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function renderTeacherOptions(selectedId = '') {
  const users = loadUsers();
  $('loginTeacher').innerHTML = users.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>`).join('');
  if (selectedId && users.some(user => user.id === selectedId)) $('loginTeacher').value = selectedId;
}
function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
function openApp(user) {
  currentUser = user;
  sessionStorage.setItem(SESSION_KEY, user.id);
  const scopedKey = `${STORAGE_KEY}_${user.id}`;
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!localStorage.getItem(scopedKey) && legacy) {
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(STORAGE_KEY);
  }
  records = loadRecords(); filteredRecords = [...records];
  $('loggedUserName').textContent = user.name;
  $('userAvatar').textContent = initials(user.name);
  $('loginScreen').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  resetForm(); render();
}
function showLogin() {
  currentUser = null; records = []; filteredRecords = [];
  sessionStorage.removeItem(SESSION_KEY);
  $('appShell').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  $('loginForm').classList.remove('hidden'); $('registerForm').classList.add('hidden'); $('demoAccess').classList.remove('hidden');
  $('loginTitle').textContent = 'Bem-vindo de volta'; $('loginSubtitle').textContent = 'Entre para acessar suas turmas e atividades.';
  $('loginPassword').value = ''; $('loginError').classList.add('hidden'); renderTeacherOptions();
}
$('loginForm').addEventListener('submit', event => {
  event.preventDefault();
  const user = loadUsers().find(item => item.id === $('loginTeacher').value && item.password === $('loginPassword').value);
  if (!user) { $('loginError').classList.remove('hidden'); $('loginPassword').focus(); return; }
  $('loginError').classList.add('hidden'); openApp(user);
});
$('showRegister').addEventListener('click', () => {
  $('loginForm').classList.add('hidden'); $('registerForm').classList.remove('hidden'); $('demoAccess').classList.add('hidden');
  $('loginTitle').textContent = 'Novo professor'; $('loginSubtitle').textContent = 'Crie um acesso simples para separar suas turmas.'; $('registerName').focus();
});
$('backToLogin').addEventListener('click', showLogin);
$('registerForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('registerName').value.trim(), password = $('registerPassword').value, confirm = $('registerConfirm').value;
  const error = $('registerError'), users = loadUsers();
  if (password !== confirm) { error.textContent='As senhas não são iguais.'; error.classList.remove('hidden'); return; }
  if (users.some(user => normalize(user.name) === normalize(name))) { error.textContent='Já existe um professor com esse nome.'; error.classList.remove('hidden'); return; }
  const user = { id:`prof-${Date.now()}`, name, password };
  users.push(user); saveUsers(users); error.classList.add('hidden'); $('registerForm').reset(); openApp(user); showToast(`Bem-vindo, ${name}!`);
});
document.querySelectorAll('.show-password').forEach(button => button.addEventListener('click', () => {
  const input = $(button.dataset.target); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? '◉' : '◌';
}));
$('logoutButton').addEventListener('click', showLogin);

// Atualiza painel, opções de filtro e tabela a partir da fonte única de dados.
function render() {
  updateStats();
  updateFilterOptions();
  applyCurrentFilters();
}
function updateStats() {
  const students = new Set(records.map(r => normalize(`${r.studentName}|${r.className}|${r.grade}`)));
  $('totalStudents').textContent = students.size;
  $('totalPending').textContent = records.filter(r => r.status === 'Pendente').length;
  $('totalLate').textContent = records.filter(r => r.status === 'Atrasada').length;
  $('totalDelivered').textContent = records.filter(r => r.status === 'Entregue').length;
  $('totalNotDone').textContent = records.filter(r => r.status === 'Não realizada').length;
}
function updateFilterOptions() {
  updateSelect('filterClass', uniqueValues('className'), 'Todas as turmas');
  updateSelect('filterSubject', uniqueValues('subject'), 'Todas as disciplinas');
}
function updateSelect(id, values, label) {
  const select = $(id), current = select.value;
  select.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (values.includes(current)) select.value = current;
}
function applyCurrentFilters() {
  const query = normalize($('search').value), className = $('filterClass').value, subject = $('filterSubject').value, status = $('filterStatus').value;
  filteredRecords = records.filter(r => (!query || normalize(r.studentName).includes(query)) && (!className || r.className === className) && (!subject || r.subject === subject) && (!status || r.status === status));
  renderTable();
}
function renderTable() {
  $('resultSummary').textContent = `${filteredRecords.length} ${filteredRecords.length === 1 ? 'registro encontrado' : 'registros encontrados'}`;
  $('emptyState').classList.toggle('hidden', filteredRecords.length > 0);
  $('recordsBody').innerHTML = filteredRecords.map(r => `<tr class="${r.status === 'Atrasada' ? 'row-late' : r.status === 'Não realizada' ? 'row-not-done' : ''}">
    <td class="student-cell"><strong>${escapeHtml(r.studentName)}</strong><small>${escapeHtml(r.notes || 'Sem observações')}</small></td>
    <td><strong>${escapeHtml(r.className)}</strong><br><small>${escapeHtml(r.grade)}</small></td>
    <td>${escapeHtml(r.subject)}</td><td class="activity-cell"><strong>${escapeHtml(r.activity)}</strong></td>
    <td>${formatDate(r.dueDate)}</td><td><span class="status-badge ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
    <td><div class="actions"><button class="action-btn" onclick="editRecord('${r.id}')" title="Editar" aria-label="Editar registro">✎</button><button class="action-btn delete" onclick="askDelete('${r.id}')" title="Excluir" aria-label="Excluir registro">♲</button></div></td></tr>`).join('');
}

// Cadastro e edição compartilham o mesmo formulário.
$('studentForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = $('recordId').value;
  const data = { id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), studentName:$('studentName').value.trim(), className:$('className').value.trim(), grade:$('grade').value.trim(), subject:$('subject').value.trim(), activity:$('activity').value.trim(), dueDate:$('dueDate').value, status:$('status').value, notes:$('notes').value.trim(), updatedAt:new Date().toISOString() };
  if (id) { records = records.map(r => r.id === id ? data : r); showToast('Registro atualizado com sucesso.'); }
  else { records.unshift(data); showToast('Aluno e atividade cadastrados com sucesso.'); }
  saveRecords(); resetForm(); render(); $('acompanhamento').scrollIntoView({behavior:'smooth'});
});
function editRecord(id) {
  const r = records.find(item => item.id === id); if (!r) return;
  Object.entries({recordId:r.id,studentName:r.studentName,className:r.className,grade:r.grade,subject:r.subject,activity:r.activity,dueDate:r.dueDate,status:r.status,notes:r.notes}).forEach(([key,value]) => $(key).value = value || '');
  $('formTitle').textContent = 'Editar aluno e atividade'; $('saveButton').textContent = '✓ Salvar alterações'; $('cancelEdit').classList.remove('hidden');
  $('studentForm').classList.remove('hidden'); $('collapseForm').textContent = '⌃'; $('cadastro').scrollIntoView({behavior:'smooth'}); setTimeout(() => $('studentName').focus(), 350);
}
function resetForm() { $('studentForm').reset(); $('recordId').value=''; $('formTitle').textContent='Cadastrar aluno e atividade'; $('saveButton').textContent='＋ Cadastrar registro'; $('cancelEdit').classList.add('hidden'); }
$('cancelEdit').addEventListener('click', resetForm);
function askDelete(id) { const r=records.find(item=>item.id===id); if(!r)return; deleteTarget=id; $('deleteName').textContent=r.studentName; $('confirmModal').classList.remove('hidden'); }
$('cancelDelete').addEventListener('click', () => { deleteTarget=null; $('confirmModal').classList.add('hidden'); });
$('confirmDelete').addEventListener('click', () => { records=records.filter(r=>r.id!==deleteTarget); saveRecords(); render(); deleteTarget=null; $('confirmModal').classList.add('hidden'); showToast('Registro excluído.'); });
$('confirmModal').addEventListener('click', e => { if(e.target === $('confirmModal')) $('cancelDelete').click(); });

// Busca instantânea e filtros combináveis.
$('applyFilters').addEventListener('click', applyCurrentFilters);
$('search').addEventListener('input', applyCurrentFilters);
['filterClass','filterSubject','filterStatus'].forEach(id => $(id).addEventListener('change', applyCurrentFilters));
$('clearFilters').addEventListener('click', () => { $('search').value=''; $('filterClass').value=''; $('filterSubject').value=''; $('filterStatus').value=''; applyCurrentFilters(); });
$('heroAdd').addEventListener('click', () => { resetForm(); $('studentForm').classList.remove('hidden'); $('cadastro').scrollIntoView({behavior:'smooth'}); setTimeout(()=>$('studentName').focus(),350); });
$('collapseForm').addEventListener('click', () => { const hidden=$('studentForm').classList.toggle('hidden'); $('collapseForm').textContent=hidden?'⌄':'⌃'; $('collapseForm').title=hidden?'Expandir formulário':'Recolher formulário'; });

// Relatório respeita os filtros atuais e inclui apenas inadimplências.
$('reportButton').addEventListener('click', openReport);
function openReport() {
  const inadimplentes = filteredRecords.filter(r => ['Pendente','Atrasada','Não realizada'].includes(r.status));
  const filterText = [ $('filterClass').value && `Turma: ${$('filterClass').value}`, $('filterSubject').value && `Disciplina: ${$('filterSubject').value}`, $('filterStatus').value && `Status: ${$('filterStatus').value}` ].filter(Boolean).join(' • ') || 'Todos os registros inadimplentes';
  $('reportContent').innerHTML = `<p class="report-meta">Gerado em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeStyle:'short'}).format(new Date())} • ${escapeHtml(filterText)}</p><div class="report-summary"><span><strong>${inadimplentes.length}</strong> atividade(s) inadimplente(s)</span><span><strong>${new Set(inadimplentes.map(r=>normalize(r.studentName))).size}</strong> aluno(s)</span></div>${inadimplentes.length ? `<div class="table-scroll"><table class="report-table"><thead><tr><th>Aluno</th><th>Turma</th><th>Disciplina</th><th>Atividade</th><th>Entrega</th><th>Status</th></tr></thead><tbody>${inadimplentes.map(r=>`<tr><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.className)} — ${escapeHtml(r.grade)}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.activity)}</td><td>${formatDate(r.dueDate)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h3>Nenhuma inadimplência encontrada</h3><p>Não há registros pendentes, atrasados ou não realizados para os filtros atuais.</p></div>'}`;
  $('reportModal').classList.remove('hidden');
}
$('closeReport').addEventListener('click', ()=>$('reportModal').classList.add('hidden'));
$('reportModal').addEventListener('click', e => {if(e.target===$('reportModal')) $('closeReport').click();});
$('printReport').addEventListener('click', () => window.print());
document.addEventListener('keydown', e => { if(e.key==='Escape'){ $('confirmModal').classList.add('hidden'); $('reportModal').classList.add('hidden'); }});
function showToast(message, isError=false) { const toast=$('toast'); toast.textContent=message; toast.className=`toast show${isError?' error':''}`; clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.className='toast',2800); }
renderTeacherOptions();
const savedUserId = sessionStorage.getItem(SESSION_KEY);
const savedUser = loadUsers().find(user => user.id === savedUserId);
if (savedUser) openApp(savedUser); else showLogin();
