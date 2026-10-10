let activeCategory = 'all';
let activeArea = 'all';
let searchQuery = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clientId() {
  const key = 'pubscene-client-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

function filterEventsLocally() {
  const query = searchQuery.trim().toLowerCase();
  return eventsData.filter((event) => {
    const categoryOk = activeCategory === 'all' || event.category === activeCategory;
    const areaOk = activeArea === 'all' || event.areaId === activeArea;
    const searchOk = !query || [event.name, event.venueName, event.areaName, event.offerText]
      .join(' ')
      .toLowerCase()
      .includes(query);
    return categoryOk && areaOk && searchOk;
  });
}

function renderEvents(items) {
  const grid = document.getElementById('eventsGrid');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12 text-sm">No parties found for this filter.</div>';
    return;
  }

  const hero = document.getElementById('heroFlyer');
  if (hero && items[0] && items[0].image) {
    hero.src = items[0].image;
    hero.alt = items[0].name || 'Event flyer';
  }

  const today = new Date().toISOString().split('T')[0];
  grid.innerHTML = items.map((event) => {
    const isClosed = event.lastBookingDate && today > event.lastBookingDate;
    return `
    <article class="bg-[#100e21] border border-[#2b274c] rounded-2xl overflow-hidden flex flex-col">
      <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.name)} flyer" class="w-full h-auto bg-black" />
      <div class="p-4 flex flex-col flex-1 gap-2">
        <p class="text-xs uppercase tracking-wide text-[#00f0ff]">${escapeHtml(event.date)}</p>
        <h3 class="text-base font-bold text-white leading-snug">${escapeHtml(event.name)}</h3>
        <p class="text-sm text-gray-400">${escapeHtml(event.venueName)}</p>
        <p class="text-sm text-pink-400">${escapeHtml(event.offerText)}</p>
        <p class="text-sm text-gray-200">Couple ₹${Number(event.couplePrice || 0)} · Stag ₹${Number(event.coverPrice || 0)}</p>
        <button type="button" class="${isClosed ? 'mt-2 w-full min-h-11 py-3 rounded-full text-sm bg-gray-700 text-gray-400 cursor-not-allowed font-bold' : 'book-event-btn btn-neon-primary mt-2 w-full min-h-11 py-3 rounded-full text-sm'}" ${isClosed ? 'disabled' : `data-event-id="${escapeHtml(event.id)}"`}>
          ${isClosed ? 'Booking Closed' : 'Book pass'}
        </button>
      </div>
    </article>
  `}).join('');
}

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  if (grid) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12 text-sm">Loading events...</div>';
  }

  const params = new URLSearchParams();
  if (activeCategory !== 'all') params.set('category', activeCategory);
  if (activeArea !== 'all') params.set('area', activeArea);
  if (searchQuery.trim()) params.set('q', searchQuery.trim());

  try {
    const res = await fetch(`${API_BASE}/api/events?${params.toString()}`);
    if (!res.ok) throw new Error('Events request failed');
    const data = await res.json();
    const events = Array.isArray(data.events) ? data.events : [];
    rememberEvents(events);
    renderEvents(events);
  } catch (err) {
    console.warn('Falling back to local events', err);
    renderEvents(filterEventsLocally());
  }
}

function setActiveCategory(category) {
  document.querySelectorAll('.cat-filter-btn').forEach((button) => {
    const selected = button.dataset.category === category;
    button.classList.toggle('bg-[#00f0ff]', selected);
    button.classList.toggle('text-black', selected);
    button.classList.toggle('font-bold', selected);
    button.classList.toggle('shadow-[0_0_12px_rgba(0,240,255,0.4)]', selected);
    button.classList.toggle('bg-[#121124]', !selected);
    button.classList.toggle('text-gray-300', !selected);
    button.classList.toggle('border', !selected);
    button.classList.toggle('border-[#2b274c]', !selected);
  });
}

function areaLabel(areaId) {
  const match = localities.find((area) => area.id === areaId);
  return match ? match.name : 'Nagpur (All)';
}

function openCollabModal() {
  document.getElementById('collabForm')?.classList.remove('hidden');
  document.getElementById('collabSuccess')?.classList.add('hidden');
  document.getElementById('collabModal')?.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeCollabModal() {
  document.getElementById('collabModal')?.classList.add('hidden');
  if (document.getElementById('bookingModal')?.classList.contains('hidden') !== false) {
    document.body.classList.remove('overflow-hidden');
  }
}

async function refreshFollowButtons() {
  try {
    const res = await fetch(`${API_BASE}/api/organizers?clientId=${encodeURIComponent(clientId())}`);
    if (!res.ok) return;
    const data = await res.json();
    (data.organizers || []).forEach((org) => {
      const button = document.querySelector(`.follow-btn[data-organizer-id="${org.id}"]`);
      if (!button) return;
      const following = Number(org.following) === 1 || org.following === true;
      button.textContent = following ? 'Following' : '+ Follow';
      button.dataset.following = following ? '1' : '0';
      button.classList.toggle('text-[#00f0ff]', following);
      button.classList.toggle('border-[#00f0ff]', following);
    });
  } catch (err) {
    console.warn('Could not load follow state', err);
  }
}

function bindInterface() {
  document.getElementById('cityDropdownBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    document.getElementById('cityDropdownMenu')?.classList.toggle('hidden');
  });

  document.getElementById('cityDropdownMenu')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-area]');
    if (!button) return;
    activeArea = button.dataset.area || 'all';
    const label = document.getElementById('currentCityDisplay');
    if (label) label.textContent = activeArea === 'all' ? 'Nagpur (All)' : areaLabel(activeArea);
    document.getElementById('cityDropdownMenu')?.classList.add('hidden');
    loadEvents();
  });

  document.addEventListener('click', (event) => {
    const menu = document.getElementById('cityDropdownMenu');
    const button = document.getElementById('cityDropdownBtn');
    if (!menu || !button) return;
    if (!menu.contains(event.target) && !button.contains(event.target)) {
      menu.classList.add('hidden');
    }
  });

  document.querySelectorAll('.cat-filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'all';
      setActiveCategory(activeCategory);
      loadEvents();
    });
  });

  let searchTimer;
  document.getElementById('mainSearchInput')?.addEventListener('input', (event) => {
    searchQuery = event.target.value || '';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadEvents, 200);
  });

  document.getElementById('seeAllEvents')?.addEventListener('click', (event) => {
    event.preventDefault();
    activeCategory = 'all';
    activeArea = 'all';
    searchQuery = '';
    const search = document.getElementById('mainSearchInput');
    if (search) search.value = '';
    const label = document.getElementById('currentCityDisplay');
    if (label) label.textContent = 'Nagpur (All)';
    setActiveCategory('all');
    loadEvents();
    document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('eventsGrid')?.addEventListener('click', (event) => {
    const button = event.target.closest('.book-event-btn');
    if (!button) return;
    openBookingModal(button.dataset.eventId);
  });

  document.getElementById('loginBookBtn')?.addEventListener('click', () => {
    document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('.faq-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.nextElementSibling;
      const icon = button.querySelector('.faq-icon');
      if (!panel) return;
      const willOpen = panel.classList.contains('hidden');
      document.querySelectorAll('.faq-toggle').forEach((other) => {
        other.nextElementSibling?.classList.add('hidden');
        other.querySelector('.faq-icon')?.classList.remove('rotate-180');
      });
      if (willOpen) {
        panel.classList.remove('hidden');
        icon?.classList.add('rotate-180');
      }
    });
  });

  document.querySelectorAll('.follow-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const organizerId = button.dataset.organizerId;
      if (!organizerId) return;
      const nextFollowing = button.dataset.following !== '1';
      button.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizerId,
            clientId: clientId(),
            following: nextFollowing
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not update follow');
        button.dataset.following = data.following ? '1' : '0';
        button.textContent = data.following ? 'Following' : '+ Follow';
        button.classList.toggle('text-[#00f0ff]', !!data.following);
        button.classList.toggle('border-[#00f0ff]', !!data.following);
      } catch (err) {
        console.error(err);
        alert(err.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.getElementById('openCollabBtn')?.addEventListener('click', openCollabModal);
  document.getElementById('collabModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'collabModal') closeCollabModal();
  });

  document.getElementById('collabForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fullName = document.getElementById('collabName')?.value?.trim();
    const phone = (document.getElementById('collabPhone')?.value || '').replace(/\D/g, '');
    const email = document.getElementById('collabEmail')?.value?.trim();
    const message = document.getElementById('collabMessage')?.value?.trim();
    const submit = document.getElementById('collabSubmitBtn');

    if (!fullName || phone.length < 10) {
      alert('Enter your name and a valid phone number so we can reach you.');
      return;
    }

    submit.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/collab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email, message })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send collaboration request');
      document.getElementById('collabForm')?.classList.add('hidden');
      document.getElementById('collabSuccess')?.classList.remove('hidden');
      event.target.reset();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById('organizeModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'organizeModal') closeOrganizeModal();
  });

  document.getElementById('organizeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = document.getElementById('orgSubmitBtn');
    const fileInput = document.getElementById('orgFlyerFile');
    if (!fileInput.files || !fileInput.files[0]) return alert('Please select a flyer image');
    
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetch(`${API_BASE}/api/public/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: document.getElementById('orgEventName').value.trim(),
              venueName: document.getElementById('orgVenue').options[document.getElementById('orgVenue').selectedIndex].text,
              date: document.getElementById('orgLaunchTime').value.replace('T', ' ') + ' to ' + document.getElementById('orgEndingTime').value.replace('T', ' '),
              category: document.getElementById('orgEventType').value,
              areaId: document.getElementById('orgCity').value,
              couplePrice: 0,
              stagPrice: 0,
              offerText: document.getElementById('orgEventType').options[document.getElementById('orgEventType').selectedIndex].text,
              imageData: e.target.result
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to submit event');
          alert('Event submitted successfully and is now visible!');
          closeOrganizeModal();
          event.target.reset();
          loadEvents(); 
        } catch (err) {
          console.error(err);
          alert(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Submit Event';
        }
      };
      reader.readAsDataURL(fileInput.files[0]);
    } catch (err) {
      console.error(err);
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Submit Event';
    }
  });
}

function openOrganizeModal() {
  document.getElementById('organizeModal')?.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeOrganizeModal() {
  document.getElementById('organizeModal')?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

async function loadVenues() {
  try {
    const res = await fetch(`${API_BASE}/api/venues`);
    const venues = await res.json();
    const grid = document.getElementById('venuesGrid');
    if (!grid) return;
    
    if (!venues || !venues.length) {
      grid.innerHTML = '<p class="text-gray-400">No venues added yet.</p>';
      return;
    }
    
    grid.innerHTML = venues.map(v => `
      <div class="flex flex-col gap-2 cursor-pointer group">
        <div class="relative w-full aspect-[2/1] rounded-xl overflow-hidden bg-[#1e1b38] border border-[#2b274c] group-hover:border-[#00f0ff] transition-colors">
          <img src="${v.cover_image || 'assets/images/logo.png'}" alt="${v.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div class="absolute top-3 left-3 w-8 h-8 rounded-full bg-black border border-[#2b274c] overflow-hidden">
            <img src="${v.logo_image || 'assets/images/logo.png'}" class="w-full h-full object-cover" />
          </div>
        </div>
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-1">${v.name} <i class="fa-solid fa-circle-check text-green-400 text-xs"></i></h3>
          <p class="text-[11px] text-gray-400 leading-relaxed mt-0.5">${v.location}</p>
          <p class="text-xs font-bold text-green-400 mt-1">0 upcoming events</p>
        </div>
      </div>
    `).join('');
    
    const countHeader = document.querySelector('#venues h2');
    if (countHeader) countHeader.innerHTML = `${venues.length} venues in <span class="text-[#00f0ff]">Nagpur</span>`;
  } catch (err) {
    console.error('Failed to load venues:', err);
  }
}

bindInterface();
loadEvents();
loadVenues();
refreshFollowButtons();
