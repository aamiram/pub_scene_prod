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
    host.innerHTML = '<div class="card"><p class="muted">No flyers yet. Use "+ Add flyer" tab to create one.</p></div>';
    return;
  }
  host.innerHTML = '<div class="flyer-list">' + overview.events.map((event) => `
    <article class="card flyer">
      <img src="${event.image}" alt="${escapeHtml(event.name)}" onerror="this.src='assets/images/logo.png'" />
      <div>
        <strong style="font-size:1.05rem; color:#fff; display:block;">${escapeHtml(event.name)}</strong>
        <p class="muted" style="margin:4px 0 6px;">
          <i class="fa-regular fa-calendar text-[11px] text-[#00f0ff] mr-1"></i>${escapeHtml(event.date)}<br>
          <i class="fa-solid fa-champagne-glasses text-[11px] text-[#00f0ff] mr-1"></i>${escapeHtml(event.venueName)}
        </p>
        <div style="font-size:0.83rem; margin:6px 0; background:#181530; border:1px solid #2d2850; padding:6px 10px; border-radius:8px;">
          <div><span style="color:#00f0ff; font-weight:700;">${escapeHtml(event.pass1Title || 'Couple pass')}:</span> ${money(event.couplePrice)}</div>
          <div><span style="color:#ff5599; font-weight:700;">${escapeHtml(event.pass2Title || 'Stag pass')}:</span> ${money(event.coverPrice)}</div>
        </div>
        <div class="actions">
          <button class="ghost" type="button" data-edit="${escapeHtml(event.id)}" style="min-height:38px; padding:6px 14px; font-size:13px;">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button class="danger" type="button" data-remove="${escapeHtml(event.id)}" style="min-height:38px; padding:6px 14px; font-size:13px;">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
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
    host.innerHTML = '<div class="card"><p class="muted">No pass bookings yet. New bookings from the website show up here.</p></div>';
    return;
  }

  const rows = overview.bookings.map((row) => {
    const rawPhone = row.phone && !String(row.phone).startsWith('ig:') ? String(row.phone).replace(/\D/g, '') : '';
    const rawIg = row.instagram ? String(row.instagram).replace(/^@+/, '') : '';
    const phoneDisplay = rawPhone ? (rawPhone.length === 10 ? '+91 ' + rawPhone : rawPhone) : '';
    const igDisplay = rawIg ? '@' + rawIg : '';

    return {
      row,
      rawPhone,
      rawIg,
      phoneDisplay,
      igDisplay
    };
  });

  const tableHtml = `
    <div class="card table-wrap desktop-table-view">
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Event</th>
            <th>Passes</th>
            <th>Pass Code</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ row, rawPhone, rawIg, phoneDisplay, igDisplay }) => `
            <tr>
              <td>
                <strong style="color:#fff;">${escapeHtml(row.full_name || '')}</strong>${row.age ? ', <span class="muted">' + escapeHtml(row.age) + 'y</span>' : ''}
                <br>
                <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap;">
                  ${rawPhone ? `<a href="tel:${rawPhone}" class="quick-contact-btn btn-tel"><i class="fa-solid fa-phone"></i> ${escapeHtml(phoneDisplay)}</a>` : ''}
                  ${rawPhone ? `<a href="https://wa.me/91${rawPhone}" target="_blank" class="quick-contact-btn btn-wa"><i class="fa-brands fa-whatsapp"></i> Chat</a>` : ''}
                  ${rawIg ? `<a href="https://instagram.com/${rawIg}" target="_blank" class="quick-contact-btn btn-ig"><i class="fa-brands fa-instagram"></i> ${escapeHtml(igDisplay)}</a>` : ''}
                </div>
              </td>
              <td>${escapeHtml(row.venue_name || '')}</td>
              <td>
                <span style="color:#00f0ff; font-weight:600;">Pass 1:</span> ${Number(row.couple_passes || 0)}<br>
                <span style="color:#ff5599; font-weight:600;">Pass 2:</span> ${Number(row.stag_passes || 0)}
              </td>
              <td><span class="pass-code-pill">#${escapeHtml(row.pass_code || '')}</span></td>
              <td><span style="color:#4ade80; font-weight:700;">${escapeHtml(row.payment_status || 'CONFIRMED')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const cardsHtml = `
    <div class="booking-cards-mobile">
      ${rows.map(({ row, rawPhone, rawIg, phoneDisplay, igDisplay }) => `
        <div class="booking-card-item">
          <div class="booking-card-header">
            <span class="pass-code-pill">#${escapeHtml(row.pass_code || '')}</span>
            <span style="color:#4ade80; font-size:12px; font-weight:700;">${escapeHtml(row.payment_status || 'CONFIRMED')}</span>
          </div>
          <strong style="font-size:1.05rem; color:#fff;">${escapeHtml(row.full_name || '')}</strong>
          ${row.age ? `<span class="muted"> (${escapeHtml(row.age)} yrs)</span>` : ''}
          <p class="muted" style="margin:4px 0 8px; font-size:0.83rem;">
            <i class="fa-solid fa-music text-[10px] text-[#00f0ff] mr-1"></i>${escapeHtml(row.venue_name || '')}
          </p>
          <div style="background:#191636; border:1px solid #2d2650; border-radius:10px; padding:8px 10px; margin-bottom:10px; font-size:0.82rem;">
            <div><span style="color:#00f0ff; font-weight:600;">Pass 1 (Couple/VIP):</span> ${Number(row.couple_passes || 0)}</div>
            <div><span style="color:#ff5599; font-weight:600;">Pass 2 (Stag/Cover):</span> ${Number(row.stag_passes || 0)}</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${rawPhone ? `<a href="tel:${rawPhone}" class="quick-contact-btn btn-tel"><i class="fa-solid fa-phone"></i> Call</a>` : ''}
            ${rawPhone ? `<a href="https://wa.me/91${rawPhone}" target="_blank" class="quick-contact-btn btn-wa"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
            ${rawIg ? `<a href="https://instagram.com/${rawIg}" target="_blank" class="quick-contact-btn btn-ig"><i class="fa-brands fa-instagram"></i> ${escapeHtml(igDisplay)}</a>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  host.innerHTML = tableHtml + cardsHtml;
}

function renderMessages() {
  const host = document.getElementById('messages');
  if (!overview.leads.length) {
    host.innerHTML = '<div class="card"><p class="muted">No collaboration messages yet.</p></div>';
    return;
  }
  host.innerHTML = overview.leads.map((lead) => {
    const rawPhone = lead.phone ? String(lead.phone).replace(/\D/g, '') : '';
    return `
      <article class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <strong style="font-size:1.05rem; color:#fff;">${escapeHtml(lead.full_name)}</strong>
          <div style="display:flex; gap:6px;">
            ${rawPhone ? `<a href="tel:${rawPhone}" class="quick-contact-btn btn-tel"><i class="fa-solid fa-phone"></i> Call</a>` : ''}
            ${rawPhone ? `<a href="https://wa.me/91${rawPhone}" target="_blank" class="quick-contact-btn btn-wa"><i class="fa-brands fa-whatsapp"></i> Chat</a>` : ''}
          </div>
        </div>
        <p class="muted" style="margin:6px 0;">${escapeHtml(lead.phone || '')} ${lead.email ? '· ' + escapeHtml(lead.email) : ''}</p>
        <p style="margin-top:8px; line-height:1.5;">${escapeHtml(lead.message || '')}</p>
      </article>
    `;
  }).join('');
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
  document.getElementById('pass1Title').value = 'Couple pass';
  document.getElementById('pass1Desc').value = 'Entry for 2';
  document.getElementById('couplePrice').value = '0';
  document.getElementById('pass2Title').value = 'Stag pass';
  document.getElementById('pass2Desc').value = 'Single entry';
  document.getElementById('stagPrice').value = '0';
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
  document.getElementById('pass1Title').value = event.pass1Title || 'Couple pass';
  document.getElementById('pass1Desc').value = event.pass1Desc || 'Entry for 2';
  document.getElementById('couplePrice').value = Number(event.couplePrice || 0);
  document.getElementById('pass2Title').value = event.pass2Title || 'Stag pass';
  document.getElementById('pass2Desc').value = event.pass2Desc || 'Single entry';
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    
    // Auto scroll the tab pill into view on mobile
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
    pass1Title: document.getElementById('pass1Title').value.trim() || 'Couple pass',
    pass1Desc: document.getElementById('pass1Desc').value.trim() || 'Entry for 2',
    couplePrice: document.getElementById('couplePrice').value,
    pass2Title: document.getElementById('pass2Title').value.trim() || 'Stag pass',
    pass2Desc: document.getElementById('pass2Desc').value.trim() || 'Single entry',
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
