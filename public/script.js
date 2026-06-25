// PWA Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW Reg failed:', err));
  });
}

let currentLevel = 'all';
let currentStudent = null;
let userProgress = [];
let userFavorites = [];
let userTheme = 'dark';

async function login() {
  const p = document.getElementById('passwordInput').value.trim();
  const e = document.getElementById('loginError');
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: p })
    });
    
    if (res.ok) {
      const u = await res.json();
      localStorage.setItem('yv_input_access', 'granted');
      localStorage.setItem('yv_input_password_version', PASSWORD_VERSION);
      localStorage.setItem('yv_input_student', JSON.stringify(u));
      await loadUserData(u.id);
      showApp(u);
    } else {
      e.textContent = 'Senha incorreta.';
    }
  } catch (err) {
    e.textContent = 'Erro ao conectar ao servidor.';
    console.error(err);
  }
}

async function checkLogin() {
  const a = localStorage.getItem('yv_input_access');
  const v = localStorage.getItem('yv_input_password_version');
  const s = localStorage.getItem('yv_input_student');
  if(a === 'granted' && v === PASSWORD_VERSION && s) {
    const studentData = JSON.parse(s);
    // If old cache, require re-login
    if (!studentData.id) {
      localStorage.removeItem('yv_input_student');
      return showLogin();
    }
    await loadUserData(studentData.id);
    showApp(studentData);
  } else {
    showLogin();
  }
}

async function loadUserData(userId) {
  try {
    const res = await fetch(`/api/userdata/${userId}`);
    if (res.ok) {
      const data = await res.json();
      userProgress = data.progress || [];
      userFavorites = data.favorites || [];
      userTheme = data.theme || 'dark';
      applyTheme(userTheme);
    }
  } catch (err) {
    console.error("Failed to load user data from API:", err);
  }
}

function showApp(u) {
  currentStudent = u;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('welcomeText').textContent = `Welcome, ${u.name}.`;
  
  if (u.plan === 'master') {
    document.getElementById('adminBtn').style.display = 'inline-block';
  } else {
    document.getElementById('adminBtn').style.display = 'none';
  }
  
  renderLibrary('all');
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function logout() {
  localStorage.removeItem('yv_input_access');
  localStorage.removeItem('yv_input_password_version');
  localStorage.removeItem('yv_input_student');
  location.reload();
}

function scrollToTop() {
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function filterLevel(l, b) {
  currentLevel = l;
  document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
  if(b) b.classList.add('active');
  renderLibrary(l);
}

function filterByTag(tag, event) {
  if(event) event.stopPropagation();
  document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
  const allTab = Array.from(document.querySelectorAll('.level-tab')).find(t => t.textContent === 'All');
  if (allTab) allTab.classList.add('active');
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = tag;
  currentLevel = 'all';
  backToLibrary();
  renderLibrary('all');
  scrollToTop();
}

function renderLibrary(levelFilter = 'all') {
  const c = document.getElementById('episodesContainer');
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let h = '';

  const renderSection = (levelKey, levelData, epsList) => {
    let eps = epsList;
    if(q) {
      eps = eps.filter(ep => [ep.title, ep.source, ep.type, ...(ep.tags||[])].join(' ').toLowerCase().includes(q));
    }
    if(!eps.length) return;
    h += `<section class="level-section"><p class="section-kicker">Library</p><h2>${levelData.title}</h2><p class="level-description">${levelData.description}</p><div class="episodes-grid">${eps.map(card).join('')}</div></section>`;
  };

  if (levelFilter === 'favorites') {
    const favEpisodes = EPISODES.filter(ep => userFavorites.includes(ep.id));
    renderSection('favorites', { title: 'My Favorites', description: 'Your saved episodes' }, favEpisodes);
  } else if (levelFilter === 'grammar') {
    const gramEpisodes = EPISODES.filter(ep => ep.type === 'Grammar');
    renderSection('grammar', { title: 'Grammar Lab', description: 'Grammar focused lessons' }, gramEpisodes);
  } else {
    Object.keys(LEVELS).forEach(k => {
      if(levelFilter !== 'all' && levelFilter !== k) return;
      renderSection(k, LEVELS[k], EPISODES.filter(ep => ep.level === k));
    });
  }

  c.innerHTML = h || '<p class="note">No content found.</p>';
}

function card(ep) {
  const isFav = userFavorites.includes(ep.id);
  const isComp = userProgress.includes(ep.id);
  return `
    <article class="episode-card" onclick="openEpisode('${ep.id}')">
      <div class="card-header-icons" style="display:flex; justify-content:space-between; margin-bottom:10px;">
        <button class="icon-btn fav-icon" onclick="toggleFavorite('${ep.id}', event)" aria-label="Favorite" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer;">${isFav ? '❤️' : '🤍'}</button>
        ${isComp ? '<span class="icon-badge comp-icon" style="font-size:1.2rem;">✅</span>' : ''}
      </div>
      <p class="episode-type">${ep.type}</p>
      <h3>${ep.title}</h3>
      <p class="episode-source">${ep.source}</p>
      <div class="episode-meta">
        <span class="pill">${LEVELS[ep.level].title}</span>
        <span class="pill">${ep.estimatedTime}</span>
        ${(ep.tags||[]).slice(0,3).map(t => `<span class="pill tag-pill" onclick="filterByTag('${t}', event)">${t}</span>`).join('')}
      </div>
    </article>
  `;
}

function openEpisode(id) {
  const ep = EPISODES.find(x => x.id === id);
  if(!ep) return;
  document.getElementById('libraryView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('episodeView').style.display = 'block';
  document.getElementById('episodeContent').innerHTML = renderEpisode(ep);
  scrollToTop();
}

function backToLibrary() {
  document.getElementById('episodeView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('libraryView').style.display = 'block';
  scrollToTop();
}

async function toggleFavorite(episodeId, event) {
  if(event) event.stopPropagation();
  const isFav = userFavorites.includes(episodeId);
  if (isFav) {
    userFavorites = userFavorites.filter(id => id !== episodeId);
  } else {
    userFavorites.push(episodeId);
  }
  renderLibrary(currentLevel);
  if(document.getElementById('episodeView').style.display === 'block') {
    const favBtn = document.getElementById('favBtnHeader');
    if(favBtn) favBtn.innerHTML = userFavorites.includes(episodeId) ? '❤️ Favorited' : '🤍 Add to Favorites';
  }
  try {
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentStudent.id, episodeId })
    });
  } catch(err) { console.error(err); }
}

async function toggleProgress(episodeId, event) {
  if(event) event.stopPropagation();
  const isCompleted = userProgress.includes(episodeId);
  if (isCompleted) {
    userProgress = userProgress.filter(id => id !== episodeId);
  } else {
    userProgress.push(episodeId);
  }
  renderLibrary(currentLevel);
  if(document.getElementById('episodeView').style.display === 'block') {
    const compBtn = document.getElementById('compBtnHeader');
    if(compBtn) compBtn.innerHTML = userProgress.includes(episodeId) ? '✅ Completed' : '☑️ Mark as Complete';
  }
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentStudent.id, episodeId })
    });
  } catch(err) { console.error(err); }
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if(btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

async function toggleTheme() {
  userTheme = userTheme === 'dark' ? 'light' : 'dark';
  applyTheme(userTheme);
  if (currentStudent && currentStudent.id) {
    try {
      await fetch('/api/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentStudent.id, theme: userTheme })
      });
    } catch(err) { console.error(err); }
  }
}

function renderEpisode(ep) {
  const isFav = userFavorites.includes(ep.id);
  const isComp = userProgress.includes(ep.id);

  const actionButtons = `
    <div class="episode-actions" style="display:flex; gap:10px;">
      <button id="favBtnHeader" onclick="toggleFavorite('${ep.id}')" class="toggle-btn" style="margin-top:0">${isFav ? '❤️ Favorited' : '🤍 Add to Favorites'}</button>
      <button id="compBtnHeader" onclick="toggleProgress('${ep.id}')" class="toggle-btn" style="margin-top:0">${isComp ? '✅ Completed' : '☑️ Mark as Complete'}</button>
    </div>
  `;

  if (ep.externalLink) {
    return `
      <div class="content-header" style="justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <button onclick="backToLibrary()" class="back-btn">← Back to Library</button>
        ${actionButtons}
      </div>
      <iframe src="${ep.externalLink}" style="width:100%; height:80vh; border:none; border-radius:12px; margin-top:20px; background:white;"></iframe>
      <div class="bottom-nav">
        <button onclick="backToLibrary()" class="back-btn">← Back to Library</button>
      </div>
    `;
  }

  const summaryHtml = `
    <p class="section-kicker">Summary</p>
    <h2>Read before or after listening</h2>
    <div class="text-box">${esc(ep.summary.en)}</div>
    <button class="toggle-btn" type="button" onclick="togglePanel('summaryPt')">Translate Summary</button>
    <div id="summaryPt" class="toggle-panel">
      <div class="text-box">${esc(ep.summary.pt)}</div>
    </div>
  `;

  let leftSide = ep.hasAudio ? renderAudio(ep) : summaryHtml;
  leftSide += `
    <div class="info-grid">
      <div class="info-card"><span>Level</span><strong>${LEVELS[ep.level].title}</strong></div>
      <div class="info-card"><span>Time</span><strong>${ep.estimatedTime}</strong></div>
      <div class="info-card"><span>Type</span><strong>${ep.type}</strong></div>
    </div>
  `;

  let rightSide = ep.hasVideo ? `
    <p class="section-kicker">Original Source</p>
    <h2>Video / Player</h2>
    ${ep.embed}
  ` : summaryHtml;

  let bottomSummary = (ep.hasAudio && ep.hasVideo) ? `<section class="section">${summaryHtml}</section>` : '';

  return `
    <div class="content-header" style="justify-content: space-between; flex-wrap: wrap; gap: 10px;">
      <button onclick="backToLibrary()" class="back-btn">← Back to Library</button>
      ${actionButtons}
    </div>
    <section class="audio-layout">
      <div class="dark-card">
        <p class="section-kicker">${ep.type}</p>
        <h2>${ep.title}</h2>
        <p>${ep.source}</p>
        ${leftSide}
      </div>
      <div class="dark-card">
        ${rightSide}
      </div>
    </section>
    <section class="section">
      <p class="section-kicker">Tags</p>
      <div class="episode-meta">
        ${(ep.tags||[]).map(t => `<span class="pill tag-pill" onclick="filterByTag('${t}', event)">${t}</span>`).join('')}
      </div>
    </section>
    <section class="section">
      <p class="section-kicker">Vocabulary</p>
      <h2>Key Words (Click to Flip)</h2>
      <div class="vocab-grid">
        ${(ep.vocabulary||[]).map(i => `
          <article class="vocab-card flashcard" onclick="this.classList.toggle('flipped')">
            <div class="flashcard-inner">
              <div class="flashcard-front">
                <strong>${i.term}</strong>
                <p style="font-size: 0.85em; opacity: 0.7;">Click to reveal</p>
              </div>
              <div class="flashcard-back">
                <strong>${i.term}</strong>
                <p>${i.meaning}</p>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
    ${bottomSummary}
    ${takeaways(ep)}
    ${transcript(ep)}
    ${questions(ep)}
    <div class="bottom-nav">
      <button onclick="backToLibrary()" class="back-btn">← Back to Library</button>
    </div>
  `;
}

function renderAudio(ep) {
  if(!ep.audioFile) return '';
  return `
    <audio id="audio" class="audio-player" controls controlsList="nodownload" preload="metadata">
      <source src="${ep.audioFile}" type="audio/mpeg">
    </audio>
    <div class="speed-controls">
      <button onclick="setSpeed(0.75,this)">0.75x</button>
      <button onclick="setSpeed(1,this)" class="active">1x</button>
      <button onclick="setSpeed(1.25,this)">1.25x</button>
      <button onclick="setSpeed(1.5,this)">1.5x</button>
    </div>
  `;
}

function takeaways(ep) {
  if(!ep.takeaways || !ep.takeaways.length) return '';
  return `
    <section class="section">
      <p class="section-kicker">Key Takeaways</p>
      <h2>Main Ideas</h2>
      <div class="vocab-grid">
        ${ep.takeaways.map(i => `<article class="takeaway-card">${i}</article>`).join('')}
      </div>
    </section>
  `;
}

function transcript(ep) {
  if(!ep.transcript) return '';
  return `
    <section class="section">
      <p class="section-kicker">Official Transcript</p>
      <h2>Read and Listen</h2>
      <button class="toggle-btn" type="button" onclick="togglePanel('transcriptEn')">Show Transcript</button>
      <div id="transcriptEn" class="toggle-panel">
        <div class="text-box">${esc(ep.transcript.en)}</div>
      </div>
      <button class="toggle-btn" type="button" onclick="togglePanel('transcriptPt')">Show Transcript Translation</button>
      <div id="transcriptPt" class="toggle-panel">
        <div class="text-box">${esc(ep.transcript.pt)}</div>
      </div>
    </section>
  `;
}

function questions(ep) {
  return `
    <section class="section">
      <p class="section-kicker">Questions</p>
      <h2>Send your answers</h2>
      <form action="https://api.web3forms.com/submit" method="POST" onsubmit="showCongrats(event)">
        <input type="hidden" name="access_key" value="a8402fe4-57c1-4e2c-8659-203d28bef4b8">
        <input type="hidden" name="subject" value="YV Input Library - ${ep.title}">
        <input type="hidden" name="from_name" value="YV Input Library">
        <input type="hidden" name="episode" value="${ep.title}">
        <div class="question-card">
          <label>Name</label>
          <input type="text" name="student_name" required>
        </div>
        ${(ep.questions||[]).map((q,i) => `
          <div class="question-card">
            <label>${i+1}. ${q.label}</label>
            <textarea name="${q.name}" required></textarea>
          </div>
        `).join('')}
        <button class="submit-btn" type="submit">Submit Answers</button>
        <p class="note">Your answers will be sent to Teacher Yas.</p>
        <div class="congrats">
          <h2>Congratulations 💜</h2>
          <p>Your answers were sent to Teacher Yas.</p>
        </div>
      </form>
    </section>
  `;
}

function togglePanel(id) {
  document.getElementById(id)?.classList.toggle('show');
}

function setSpeed(r, b) {
  const a = document.getElementById('audio');
  if(!a) return;
  a.playbackRate = r;
  document.querySelectorAll('.speed-controls button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
}

function showCongrats(e) {
  setTimeout(() => e.target.querySelector('.congrats')?.classList.add('show'), 200);
}

function esc(t) {
  return String(t||'').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// --- ADMIN FUNCTIONS ---

function showAdmin() {
  document.getElementById('libraryView').style.display = 'none';
  document.getElementById('episodeView').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';
  loadAdminStudents();
}

function backToLibraryFromAdmin() {
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('libraryView').style.display = 'block';
}

async function loadAdminStudents() {
  if (!currentStudent || currentStudent.plan !== 'master') return;
  const c = document.getElementById('adminStudentsList');
  c.innerHTML = '<p>Loading...</p>';
  try {
    const res = await fetch(`/api/admin/users?masterId=${currentStudent.id}`);
    if (res.ok) {
      const users = await res.json();
      let tableHtml = `
        <table style="width:100%; border-collapse: collapse; text-align: left; min-width: 600px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--line);">
              <th style="padding:10px;">Name</th>
              <th style="padding:10px;">Plan</th>
              <th style="padding:10px;">Password (ID)</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px;">Last Login</th>
              <th style="padding:10px;">Ações</th>
            </tr>
          </thead>
          <tbody>
      `;
      users.forEach(u => {
        let lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Never';
        let safeName = esc(u.name);
        let safePlan = esc(u.plan);
        let safeId = esc(u.id);
        let safeStatus = esc(u.status || 'active');
        let statusBadge = u.status === 'inactive' ? '<span style="color:red;">Inactive</span>' : '<span style="color:var(--orange);">Active</span>';
        
        tableHtml += `
          <tr style="border-bottom: 1px solid var(--line);">
            <td style="padding:10px;">${safeName}</td>
            <td style="padding:10px; text-transform:capitalize;">${safePlan}</td>
            <td style="padding:10px;">${safeId}</td>
            <td style="padding:10px;">${statusBadge}</td>
            <td style="padding:10px;">${lastLogin}</td>
            <td style="padding:10px;">
              <button onclick="openEditModal('${safeId}', '${safeName}', '${safePlan}', '${safeStatus}')" style="background:transparent; border:1px solid var(--orange); color:var(--orange); padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">Edit</button>
              <button onclick="deleteStudent('${safeId}')" style="background:transparent; border:1px solid red; color:red; padding:5px 10px; border-radius:5px; cursor:pointer;">Delete</button>
            </td>
          </tr>
        `;
      });
      tableHtml += '</tbody></table>';
      c.innerHTML = tableHtml;
    } else {
      c.innerHTML = '<p class="note">Not authorized.</p>';
    }
  } catch (err) {
    c.innerHTML = '<p class="note">Error loading students.</p>';
  }
}

async function addStudent(e) {
  e.preventDefault();
  const feedback = document.getElementById('adminFeedback');
  const name = document.getElementById('newStudentName').value.trim();
  const plan = document.getElementById('newStudentPlan').value;
  const id = document.getElementById('newStudentPassword').value.trim();

  if (!name || !id) return;
  
  feedback.textContent = 'Adding...';
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterId: currentStudent.id, id, name, plan })
    });
    if (res.ok) {
      feedback.textContent = 'Student added successfully!';
      document.getElementById('addStudentForm').reset();
      loadAdminStudents(); // Refresh table
    } else {
      feedback.textContent = 'Error adding student. Maybe the password already exists?';
    }
  } catch(err) {
    feedback.textContent = 'Server error.';
  }
}

document.addEventListener('DOMContentLoaded', checkLogin);

function openEditModal(id, name, plan, status) {
  document.getElementById('editOldId').value = id;
  document.getElementById('editStudentName').value = name;
  document.getElementById('editStudentPlan').value = plan;
  document.getElementById('editStudentPassword').value = id;
  document.getElementById('editStudentStatus').value = status || 'active';
  document.getElementById('editFeedback').textContent = '';
  document.getElementById('editStudentModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editStudentModal').style.display = 'none';
}

async function saveStudentEdit(e) {
  e.preventDefault();
  const feedback = document.getElementById('editFeedback');
  const oldId = document.getElementById('editOldId').value;
  const name = document.getElementById('editStudentName').value.trim();
  const plan = document.getElementById('editStudentPlan').value;
  const newId = document.getElementById('editStudentPassword').value.trim();
  const status = document.getElementById('editStudentStatus').value;

  if (!name || !newId) return;
  
  feedback.textContent = 'Saving...';
  try {
    const res = await fetch(`/api/admin/users/${oldId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterId: currentStudent.id, id: newId, name, plan, status })
    });
    if (res.ok) {
      closeEditModal();
      loadAdminStudents();
    } else {
      feedback.textContent = 'Error saving student.';
    }
  } catch(err) {
    feedback.textContent = 'Server error.';
  }
}

async function deleteStudent(id) {
  if (id === currentStudent.id) {
    alert("You cannot delete yourself!");
    return;
  }
  if (!confirm(`Are you sure you want to completely delete the student with password/ID: ${id}?\n\nThis will also delete all their progress and favorites.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/admin/users/${id}?masterId=${currentStudent.id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      loadAdminStudents();
    } else {
      alert('Error deleting student.');
    }
  } catch(err) {
    alert('Server error while deleting.');
  }
}

// PWA Install Prompt Logic
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI to notify the user they can add to home screen
  if(installAppBtn) installAppBtn.style.display = 'block';
});

if(installAppBtn) {
  installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // We've used the prompt, and can't use it again, throw it away
      deferredPrompt = null;
      installAppBtn.style.display = 'none';
    }
  });
}