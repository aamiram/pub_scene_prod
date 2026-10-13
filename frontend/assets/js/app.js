window.handleHeroBookPasses = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (typeof openBookingModal === 'function' && Array.isArray(window.currentEventsList) && window.currentEventsList.length > 0) {
    openBookingModal(window.currentEventsList[0].id);
    return;
  }
  const eventsSec = document.getElementById('events');
  if (eventsSec) {
    eventsSec.scrollIntoView({ behavior: 'smooth' });
  }
};

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
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12 text-sm bg-[#100e21] rounded-2xl border border-[#2b274c]/50 p-8"><i class="fa-solid fa-calendar-xmark text-3xl mb-2 text-gray-600 block"></i>No parties found for this filter. Try selecting "All".</div>';
    return;
  }

  window.currentEventsList = items;
  const hero = document.getElementById('heroFlyer');
  const heroTitle = document.getElementById('heroFlyerTitle');
  if (hero && items[0] && items[0].image) {
    hero.src = items[0].image;
    hero.alt = items[0].name || 'Event flyer';
  }
  if (heroTitle && items[0] && items[0].name) {
    heroTitle.textContent = items[0].name;
  }

  const today = new Date().toISOString().split('T')[0];
  grid.innerHTML = items.map((event) => {
    const isClosed = event.lastBookingDate && today > event.lastBookingDate;
    const priceDisplay = '<span class="text-green-400 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-ticket text-[11px]"></i>Digital Entry Pass</span>';

    return `
    <article class="bg-[#100e21] border border-[#2b274c] rounded-2xl overflow-hidden flex flex-col group hover:border-[#00f0ff]/60 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]">
      <div class="relative w-full aspect-[4/5] bg-[#070611] overflow-hidden flex items-center justify-center border-b border-[#1e1c33]">
        <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.name)} flyer" class="w-full h-full object-contain group-hover:scale-102 transition-transform duration-500" loading="lazy" />
        <div class="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/75 to-transparent pointer-events-none"></div>
        
        <!-- Date Badge -->
        <span class="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-[#00f0ff] border border-[#00f0ff]/30 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
          <i class="fa-regular fa-clock text-[10px]"></i> ${escapeHtml(event.date)}
        </span>

        <!-- Area/Category Badge -->
        <span class="absolute top-3 right-3 bg-[#ff007f]/85 backdrop-blur-md text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md">
          ${escapeHtml(event.areaName || 'Nagpur')}
        </span>
      </div>

      <div class="p-4 sm:p-5 flex flex-col flex-1 gap-2">
        <h3 class="text-base sm:text-lg font-bold text-white group-hover:text-[#00f0ff] transition-colors leading-snug line-clamp-1">
          ${escapeHtml(event.name)}
        </h3>

        <div class="flex items-center gap-1.5 text-xs text-gray-300">
          <i class="fa-solid fa-location-dot text-[#ff007f] text-[11px]"></i>
          <span class="font-medium">${escapeHtml(event.venueName)}</span>
        </div>

        <p class="text-xs text-pink-400 font-medium line-clamp-2 min-h-[32px]">
          ${escapeHtml(event.offerText || 'Exclusive entry & nightlife experience')}
        </p>

        <div class="mt-auto pt-2.5 border-t border-[#1e1c33] flex items-center justify-between text-xs">
          <div>${priceDisplay}</div>
        </div>

        <button type="button" class="${isClosed ? 'mt-1 w-full min-h-[44px] py-2.5 rounded-xl text-xs sm:text-sm bg-gray-800 text-gray-400 cursor-not-allowed font-bold' : 'book-event-btn btn-neon-primary mt-1 w-full min-h-[44px] py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2'}" ${isClosed ? 'disabled' : `data-event-id="${escapeHtml(event.id)}"`}>
          <span>${isClosed ? 'Booking Closed' : 'Book Pass'}</span>
          ${isClosed ? '' : '<i class="fa-solid fa-arrow-right text-[11px]"></i>'}
        </button>
      </div>
    </article>
  `}).join('');
}

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  if (grid) {
    grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-12 text-sm"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-[#00f0ff] block"></i>Loading live events in ${escapeHtml(areaLabel(activeArea))}...</div>`;
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
  return match ? match.name : 'Nagpur';
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

function closeMobileDrawer() {
  document.getElementById('mobileDrawer')?.classList.add('hidden');
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
  // City Dropdown
  document.getElementById('cityDropdownBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    document.getElementById('cityDropdownMenu')?.classList.toggle('hidden');
  });

  document.getElementById('cityDropdownMenu')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-area]');
    if (!button) return;
    const selected = button.dataset.area || 'all';
    activeArea = selected === 'nagpur' ? 'all' : selected;
    const label = document.getElementById('currentCityDisplay');
    if (label) label.textContent = areaLabel(activeArea);
    document.getElementById('cityDropdownMenu')?.classList.add('hidden');
    loadEvents();
  });

  // Mobile drawer toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  mobileMenuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    mobileDrawer?.classList.toggle('hidden');
  });

  document.querySelectorAll('.mobile-nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      mobileDrawer?.classList.add('hidden');
    });
  });

  // Close menus on outside click
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('cityDropdownMenu');
    const cityBtn = document.getElementById('cityDropdownBtn');
    if (menu && cityBtn && !menu.contains(event.target) && !cityBtn.contains(event.target)) {
      menu.classList.add('hidden');
    }

    if (mobileDrawer && mobileMenuBtn && !mobileDrawer.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
      mobileDrawer.classList.add('hidden');
    }
  });

  // Category Filters
  document.querySelectorAll('.cat-filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'all';
      setActiveCategory(activeCategory);
      loadEvents();
    });
  });

  // Search synchronization (Desktop and Mobile)
  let searchTimer;
  const onSearchInput = (value) => {
    searchQuery = value || '';
    const mainInput = document.getElementById('mainSearchInput');
    const mobileInput = document.getElementById('mobileSearchInput');
    if (mainInput && mainInput.value !== searchQuery) mainInput.value = searchQuery;
    if (mobileInput && mobileInput.value !== searchQuery) mobileInput.value = searchQuery;

    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadEvents, 200);
  };

  document.getElementById('mainSearchInput')?.addEventListener('input', (e) => onSearchInput(e.target.value));
  document.getElementById('mobileSearchInput')?.addEventListener('input', (e) => onSearchInput(e.target.value));

  document.getElementById('seeAllEvents')?.addEventListener('click', (event) => {
    event.preventDefault();
    activeCategory = 'all';
    activeArea = 'all';
    searchQuery = '';
    const search1 = document.getElementById('mainSearchInput');
    const search2 = document.getElementById('mobileSearchInput');
    if (search1) search1.value = '';
    if (search2) search2.value = '';
    const label = document.getElementById('currentCityDisplay');
    if (label) label.textContent = 'Nagpur';
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
      grid.innerHTML = '<p class="text-gray-400 col-span-full text-center py-8">No venues added yet.</p>';
      return;
    }
    
    grid.innerHTML = venues.map((v, idx) => `
      <div class="venue-card bg-[#0c0a1a] border border-[#2b274c] rounded-2xl overflow-hidden group hover:border-[#ff007f]/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(255,0,127,0.15)] flex flex-col cursor-pointer" data-venue-name="${escapeHtml(v.name)}">
        <div class="relative h-44 sm:h-48 overflow-hidden bg-[#18152e]">
          <img src="${escapeHtml(v.cover_image || 'assets/images/logo.png')}" alt="${escapeHtml(v.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          <div class="absolute inset-0 bg-gradient-to-t from-[#0c0a1a] via-black/30 to-transparent"></div>
          
          <!-- Rating Badge -->
          <span class="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 shadow-md">
            <i class="fa-solid fa-star text-yellow-400 text-[10px]"></i> 4.${(9 - (idx % 3))}
          </span>

          <!-- Tag Badge -->
          <span class="absolute bottom-3 left-3 text-[#ff007f] text-[10px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded border border-[#ff007f]/30">
            Nagpur Nightlife
          </span>
        </div>

        <div class="p-4 sm:p-5 flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-base sm:text-lg font-bold text-white group-hover:text-[#00f0ff] transition-colors flex items-center gap-1.5">
              ${escapeHtml(v.name)}
              <i class="fa-solid fa-circle-check text-green-400 text-xs" title="Verified Venue"></i>
            </h3>
          </div>

          <p class="text-xs text-gray-400 leading-relaxed mb-4 flex items-start gap-1.5 line-clamp-2">
            <i class="fa-solid fa-location-dot text-gray-500 mt-0.5 shrink-0 text-[11px]"></i>
            <span>${escapeHtml(v.location)}</span>
          </p>

          <div class="mt-auto pt-2.5 border-t border-[#1a172e] flex items-center justify-between">
            <span class="text-[11px] text-green-400 font-semibold flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Open for parties
            </span>
            <button type="button" class="view-venue-events-btn text-xs font-bold text-[#00f0ff] hover:text-white flex items-center gap-1 bg-[#16132d] hover:bg-[#00f0ff] hover:text-black px-3 py-1.5 rounded-lg border border-[#00f0ff]/20 transition-all">
              <span>View Events</span>
              <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    
    const countHeader = document.querySelector('#venues h2');
    if (countHeader) countHeader.innerHTML = `${venues.length} Venues in <span class="text-[#00f0ff]">Nagpur</span>`;

    // Filter events when clicking a venue card
    document.querySelectorAll('.venue-card').forEach((card) => {
      card.addEventListener('click', () => {
        const venueName = card.dataset.venueName;
        if (!venueName) return;
        const mainInput = document.getElementById('mainSearchInput');
        const mobileInput = document.getElementById('mobileSearchInput');
        if (mainInput) mainInput.value = venueName;
        if (mobileInput) mobileInput.value = venueName;
        searchQuery = venueName;
        loadEvents();
        document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  } catch (err) {
    console.error('Failed to load venues:', err);
  }
}

bindInterface();
loadEvents();
loadVenues();
refreshFollowButtons();
