const TOKEN_KEY = 'pubscene-admin-token';

const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const loginError = document.getElementById('loginError');
const formError = document.getElementById('formError');
const flyerPreview = document.getElementById('flyerPreview');

let flyerData = '';
let overview = { events: [], bookings: [], leads: [] };

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

async function api(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(path, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error(data.error || 'Please log in again');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

function money(value) {
  return '₹' + Number(value || 0);
}

function renderFlyers() {
  const host = document.getElementById('flyers');
  if (!overview.events.length) {
    host.innerHTML = '<div class="card"><p>No flyers yet. Use Add flyer.</p></div>';
    return;
  }
  host.innerHTML = '<div class="flyer-list">' + overview.events.map((event) => `
    <article class="card flyer">
      <img src="${event.image}" alt="" />
      <div>
        <strong>${escapeHtml(event.name)}</strong>
        <p class="muted">${escapeHtml(event.date)}<br>${escapeHtml(event.venueName)}</p>
        <p>Couple ${money(event.couplePrice)} · Stag ${money(event.coverPrice)}</p>
        <div class="actions">
          <button class="ghost" type="button" data-edit="${escapeHtml(event.id)}">Edit</button>
          <button class="danger" type="button" data-remove="${escapeHtml(event.id)}">Remove</button>
        </div>
      </div>
    </article>
  `).join('') + '</div>';
}

function guestContact(row) {
  const phone = row.phone && !String(row.phone).startsWith('ig:') ? row.phone : '';
  const instagram = row.instagram ? '@' + String(row.instagram).replace(/^@+/, '') : '';
  const email = row.email || '';
  return [phone, instagram, email].filter(Boolean).join(' · ');
}

function renderBookings() {
  const host = document.getElementById('bookings');
  if (!overview.bookings.length) {
    host.innerHTML = '<div class="card"><p>No pass bookings yet. New bookings from the website show up here.</p></div>';
    return;
  }
  host.innerHTML = '<div class="card table-wrap"><table><thead><tr><th>Guest</th><th>Event</th><th>Passes</th><th>Pass Code</th><th>Status</th></tr></thead><tbody>' +
    overview.bookings.map((row) => `
      <tr>
        <td>${escapeHtml(row.full_name || '')}${row.age ? ', ' + escapeHtml(row.age) : ''}<br><span class="muted">${escapeHtml(guestContact(row))}</span></td>
        <td>${escapeHtml(row.venue_name || '')}</td>
        <td>Couple ${Number(row.couple_passes || 0)}<br>Stag ${Number(row.stag_passes || 0)}</td>
        <td><strong style="color:#00f0ff">${escapeHtml(row.pass_code || '')}</strong></td>
        <td>${escapeHtml(row.payment_status || 'CONFIRMED')}</td>
      </tr>
    `).join('') + '</tbody></table></div>';
}

function renderMessages() {
  const host = document.getElementById('messages');
  if (!overview.leads.length) {
    host.innerHTML = '<div class="card"><p>No collaboration messages yet.</p></div>';
    return;
  }
  host.innerHTML = overview.leads.map((lead) => `
    <article class="card">
      <strong>${escapeHtml(lead.full_name)}</strong>
      <p class="muted">${escapeHtml(lead.phone || '')} ${escapeHtml(lead.email || '')}</p>
      <p>${escapeHtml(lead.message || '')}</p>
    </article>
  `).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearForm() {
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('formTitle').textContent = 'Add a flyer';
  flyerData = '';
  flyerPreview.hidden = true;
  flyerPreview.removeAttribute('src');
  formError.textContent = '';
}

function fillForm(event) {
  document.getElementById('eventId').value = event.id;
  document.getElementById('eventName').value = event.name || '';
  document.getElementById('eventDate').value = event.date || '';
  document.getElementById('eventVenue').value = event.venueName || '';
  document.getElementById('eventArea').value = event.areaId || 'raasta';
  document.getElementById('eventCategory').value = event.category || 'club_nights';
  document.getElementById('couplePrice').value = Number(event.couplePrice || 0);
  document.getElementById('stagPrice').value = Number(event.coverPrice || 0);
  document.getElementById('offerText').value = event.offerText || '';
  document.getElementById('lastBookingDate').value = event.lastBookingDate || '';
  document.getElementById('badge').value = event.badge || '';
  document.getElementById('formTitle').textContent = 'Edit flyer';
  flyerData = '';
  flyerPreview.src = event.image;
  flyerPreview.hidden = false;
  formError.textContent = '';
  document.querySelector('[data-tab="editor"]').click();
}

async function loadOverview() {
  overview = await api('/api/admin/overview');
  renderFlyers();
  renderBookings();
  renderMessages();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
      })
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    showApp();
    await loadOverview();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch (err) { /* already logged out */ }
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((item) => item.setAttribute('aria-selected', 'false'));
    button.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

document.getElementById('flyerFile').addEventListener('change', () => {
  const file = document.getElementById('flyerFile').files[0];
  flyerData = '';
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    formError.textContent = 'Flyer must be under 8 MB';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    flyerData = String(reader.result || '');
    flyerPreview.src = flyerData;
    flyerPreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

document.getElementById('cancelEdit').addEventListener('click', clearForm);

document.getElementById('eventForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  const id = document.getElementById('eventId').value;
  const payload = {
    name: document.getElementById('eventName').value.trim(),
    date: document.getElementById('eventDate').value.trim(),
    venueName: document.getElementById('eventVenue').value.trim(),
    areaId: document.getElementById('eventArea').value,
    category: document.getElementById('eventCategory').value,
    couplePrice: document.getElementById('couplePrice').value,
    stagPrice: document.getElementById('stagPrice').value,
    offerText: document.getElementById('offerText').value.trim(),
    lastBookingDate: document.getElementById('lastBookingDate').value.trim(),
    badge: document.getElementById('badge').value.trim()
  };
  if (flyerData) payload.imageData = flyerData;
  try {
    if (id) await api('/api/admin/events/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
    clearForm();
    await loadOverview();
    document.querySelector('[data-tab="flyers"]').click();
  } catch (err) {
    formError.textContent = err.message;
  }
});

document.getElementById('flyers').addEventListener('click', async (event) => {
  const editId = event.target.closest('[data-edit]')?.dataset.edit;
  const removeId = event.target.closest('[data-remove]')?.dataset.remove;
  if (editId) {
    const found = overview.events.find((item) => item.id === editId);
    if (found) fillForm(found);
    return;
  }
  if (removeId) {
    if (!confirm('Remove this flyer from the website?')) return;
    try {
      await api('/api/admin/events/' + encodeURIComponent(removeId), { method: 'DELETE' });
      await loadOverview();
    } catch (err) {
      alert(err.message);
    }
  }
});

if (token()) {
  showApp();
  loadOverview().catch(() => showLogin());
  loadVenues();
}

// --- VENUES LOGIC ---
let venuesData = [];
let venueCoverData = null;
let venueLogoData = null;

async function loadVenues() {
  try {
    const res = await api('/api/venues');
    venuesData = res || [];
    renderVenues();
  } catch(err) {
    console.error('Failed to load venues', err);
  }
}

function renderVenues() {
  const container = document.getElementById('venuesList');
  if (!venuesData.length) {
    container.innerHTML = '<div class="card" style="grid-column: 1 / -1;"><p class="muted">No venues added yet. Click "+ Add New Venue" above to add your first venue.</p></div>';
    return;
  }
  container.innerHTML = venuesData.map(v => `
    <div class="venue-card">
      <div class="venue-card-media">
        <img src="${escapeHtml(v.cover_image || 'assets/images/logo.png')}" class="venue-card-cover" alt="${escapeHtml(v.name)}" onerror="this.src='assets/images/logo.png'" />
        <img src="${escapeHtml(v.logo_image || 'assets/images/logo.png')}" class="venue-card-logo" alt="${escapeHtml(v.name)}" onerror="this.src='assets/images/logo.png'" />
      </div>
      <div class="venue-card-body">
        <strong style="font-size:15px; color:#fff;">${escapeHtml(v.name)}</strong>
        <p class="muted" style="margin:4px 0 10px; font-size:12px; line-height:1.4;">${escapeHtml(v.location)}</p>
        <div class="actions" style="margin-top:auto;">
          <button type="button" class="ghost" style="padding:6px 14px; min-height:unset; font-size:12px; font-weight:600;" data-edit-venue="${escapeHtml(v.id)}">Edit</button>
          <button type="button" class="danger" style="padding:6px 14px; min-height:unset; font-size:12px; font-weight:600;" data-remove-venue="${escapeHtml(v.id)}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function clearVenueForm() {
  document.getElementById('venueForm').reset();
  document.getElementById('venueId').value = '';
  const coverPrev = document.getElementById('venueCoverPreview');
  coverPrev.hidden = true;
  coverPrev.removeAttribute('src');
  const logoPrev = document.getElementById('venueLogoPreview');
  logoPrev.hidden = true;
  logoPrev.removeAttribute('src');
  document.getElementById('venueFormTitle').textContent = 'Add a venue';
  const errEl = document.getElementById('venueFormError');
  if (errEl) errEl.textContent = '';
  venueCoverData = null;
  venueLogoData = null;
}

document.getElementById('cancelVenueEdit')?.addEventListener('click', () => {
  clearVenueForm();
  document.querySelector('[data-tab="venues"]')?.click();
});

document.getElementById('openAddVenueBtn')?.addEventListener('click', () => {
  clearVenueForm();
  document.querySelector('[data-tab="venue-editor"]')?.click();
});

function readVenueFile(file, isLogo) {
  const errEl = document.getElementById('venueFormError');
  if (errEl) errEl.textContent = '';
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    if (errEl) errEl.textContent = 'Image must be under 8 MB';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    if (isLogo) {
      venueLogoData = e.target.result;
      const preview = document.getElementById('venueLogoPreview');
      preview.src = e.target.result;
      preview.hidden = false;
    } else {
      venueCoverData = e.target.result;
      const preview = document.getElementById('venueCoverPreview');
      preview.src = e.target.result;
      preview.hidden = false;
    }
  };
  reader.readAsDataURL(file);
}

document.getElementById('venueCoverFile')?.addEventListener('change', (e) => readVenueFile(e.target.files[0], false));
document.getElementById('venueLogoFile')?.addEventListener('change', (e) => readVenueFile(e.target.files[0], true));

document.getElementById('venueForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('venueFormError');
  if (errEl) errEl.textContent = '';
  const id = document.getElementById('venueId').value;
  const payload = {
    name: document.getElementById('venueNameInput').value.trim(),
    location: document.getElementById('venueLocationInput').value.trim(),
  };
  if (venueCoverData) payload.coverImageData = venueCoverData;
  if (venueLogoData) payload.logoImageData = venueLogoData;

  try {
    if (id) {
      await api('/api/admin/venues/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/admin/venues', { method: 'POST', body: JSON.stringify(payload) });
    }
    clearVenueForm();
    await loadVenues();
    document.querySelector('[data-tab="venues"]')?.click();
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
});

document.getElementById('venuesList')?.addEventListener('click', async (e) => {
  const editId = e.target.closest('[data-edit-venue]')?.dataset.editVenue;
  const removeId = e.target.closest('[data-remove-venue]')?.dataset.removeVenue;
  
  if (editId) {
    const v = venuesData.find(x => x.id === editId);
    if (!v) return;
    clearVenueForm();
    document.getElementById('venueFormTitle').textContent = `Edit venue (${v.name})`;
    document.getElementById('venueId').value = v.id;
    document.getElementById('venueNameInput').value = v.name || '';
    document.getElementById('venueLocationInput').value = v.location || '';
    
    if (v.cover_image) {
      const coverPrev = document.getElementById('venueCoverPreview');
      coverPrev.src = v.cover_image;
      coverPrev.hidden = false;
    }
    
    if (v.logo_image) {
      const logoPrev = document.getElementById('venueLogoPreview');
      logoPrev.src = v.logo_image;
      logoPrev.hidden = false;
    }
    
    document.querySelector('[data-tab="venue-editor"]')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (removeId) {
    const v = venuesData.find(x => x.id === removeId);
    const venueName = v ? v.name : 'this venue';
    if (!confirm(`Are you sure you want to remove "${venueName}"?`)) return;
    try {
      await api('/api/admin/venues/' + encodeURIComponent(removeId), { method: 'DELETE' });
      await loadVenues();
    } catch(err) {
      alert(err.message);
    }
  }
});
