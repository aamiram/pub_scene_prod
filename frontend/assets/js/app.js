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

  grid.innerHTML = items.map((event) => `
    <article class="bg-[#100e21] border border-[#2b274c] rounded-2xl overflow-hidden flex flex-col">
      <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.name)} flyer" class="w-full h-auto bg-black" />
      <div class="p-4 flex flex-col flex-1 gap-2">
        <p class="text-xs uppercase tracking-wide text-[#00f0ff]">${escapeHtml(event.date)}</p>
        <h3 class="text-base font-bold text-white leading-snug">${escapeHtml(event.name)}</h3>
        <p class="text-sm text-gray-400">${escapeHtml(event.venueName)}</p>
        <p class="text-sm text-pink-400">${escapeHtml(event.offerText)}</p>
        <p class="text-sm text-gray-200">Couple ₹${Number(event.couplePrice || 0)} · Stag ₹${Number(event.coverPrice || 0)}</p>
        <button type="button" class="book-event-btn btn-neon-primary mt-2 w-full min-h-11 py-3 rounded-full text-sm" data-event-id="${escapeHtml(event.id)}">
          Book pass
        </button>
      </div>
    </article>
  `).join('');
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
}

bindInterface();
loadEvents();
refreshFollowButtons();
