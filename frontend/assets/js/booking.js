// Booking state for the pass modal with PhonePe QR & WhatsApp verification.
let activeBookingVenue = null;
let activeTickets = [];
let ticketQuantities = {};

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';
const WHATSAPP_NUMBER = '918855882926';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function changeTicketQty(idx, delta) {
  if (ticketQuantities[idx] == null) ticketQuantities[idx] = 0;
  ticketQuantities[idx] = Math.max(0, ticketQuantities[idx] + delta);
  const qtyNode = document.getElementById(`qty-ticket-${idx}`);
  if (qtyNode) qtyNode.textContent = String(ticketQuantities[idx]);
}

// For legacy inline changeQty calls
function changeQty(type, delta) {
  if (type === 'couple') changeTicketQty(0, delta);
  else if (type === 'stag') changeTicketQty(1, delta);
}

function openBookingModal(venueId) {
  const venue = typeof findEventById === 'function' ? findEventById(venueId) : null;
  if (!venue) {
    alert('This event is not available for booking right now.');
    return;
  }

  activeBookingVenue = venue;
  activeTickets = Array.isArray(venue.tickets) && venue.tickets.length ? venue.tickets : [
    { id: 't-1', name: venue.pass1Title || 'Couple pass', desc: venue.pass1Desc || 'Entry for 2', price: venue.couplePrice || 0 },
    { id: 't-2', name: venue.pass2Title || 'Stag pass', desc: venue.pass2Desc || 'Single entry', price: venue.coverPrice || 0 }
  ];

  ticketQuantities = {};
  activeTickets.forEach((_, idx) => {
    ticketQuantities[idx] = idx === 0 ? 1 : 0;
  });

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText('modalClubName', venue.name);
  setText('modalClubArea', `${venue.areaName || ''} • ${venue.venueName || ''}`);
  setText('modalClubOffer', venue.offerText || 'Exclusive entry pass');
  setText('modalEventDate', venue.date || '');

  // Render all ticket options into modalPassesContainer
  const passesContainer = document.getElementById('modalPassesContainer');
  if (passesContainer) {
    passesContainer.innerHTML = activeTickets.map((t, idx) => `
      <div class="flex items-center justify-between bg-[#18152e] border border-purple-800/40 rounded-xl px-3.5 py-3">
        <div class="pr-2 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-xs text-white font-semibold">${escapeHtml(t.name)}</p>
            <span class="text-[11px] font-bold text-[#00f0ff]">₹${Number(t.price || 0)}</span>
          </div>
          ${t.desc ? `<p class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(t.desc)}</p>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button type="button" onclick="changeTicketQty(${idx}, -1)" aria-label="Decrease quantity" class="w-8 h-8 rounded-full bg-[#121124] border border-[#2b274c] text-white font-bold active:scale-90 active:border-[#00f0ff] transition-transform text-sm flex items-center justify-center select-none">−</button>
          <span id="qty-ticket-${idx}" class="text-xs font-bold text-white w-6 text-center select-none">${ticketQuantities[idx]}</span>
          <button type="button" onclick="changeTicketQty(${idx}, 1)" aria-label="Increase quantity" class="w-8 h-8 rounded-full bg-[#121124] border border-[#2b274c] text-white font-bold active:scale-90 active:border-[#00f0ff] transition-transform text-sm flex items-center justify-center select-none">+</button>
        </div>
      </div>
    `).join('');
  }

  ['custName', 'custAge', 'custInstagram', 'custPhone', 'custEmail'].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = '';
  });

  // Reset stage views
  document.getElementById('modalBookingForm')?.classList.remove('hidden');
  document.getElementById('modalGeneratingQR')?.classList.add('hidden');
  document.getElementById('modalPaymentQR')?.classList.add('hidden');
  document.getElementById('guestDetails')?.classList.add('hidden');
  document.getElementById('continueToDetailsBtn')?.classList.remove('hidden');

  const submitBtn = document.getElementById('confirmPassBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-shield-halved text-xs mr-2"></i><span>Proceed to Secure Pay</span>';
  }

  document.getElementById('bookingModal')?.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeModal() {
  document.getElementById('bookingModal')?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

document.getElementById('continueToDetailsBtn')?.addEventListener('click', () => {
  const total = Object.values(ticketQuantities).reduce((sum, q) => sum + (Number(q) || 0), 0);
  if (total < 1) {
    alert('Please choose at least 1 pass.');
    return;
  }
  document.getElementById('guestDetails')?.classList.remove('hidden');
  document.getElementById('continueToDetailsBtn')?.classList.add('hidden');
  document.getElementById('custName')?.focus();
});

document.getElementById('confirmPassBtn')?.addEventListener('click', async () => {
  if (!activeBookingVenue) {
    alert('Choose an event before proceeding.');
    return;
  }

  const fullName = document.getElementById('custName')?.value?.trim();
  const age = parseInt(document.getElementById('custAge')?.value, 10);
  const phone = (document.getElementById('custPhone')?.value || '').replace(/\D/g, '');
  const instagram = (document.getElementById('custInstagram')?.value || '').trim().replace(/^@+/, '');
  const email = (document.getElementById('custEmail')?.value || '').trim();
  const submitBtn = document.getElementById('confirmPassBtn');

  if (!fullName) {
    alert('Please enter your full name.');
    document.getElementById('custName')?.focus();
    return;
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    alert('Please enter a valid age.');
    document.getElementById('custAge')?.focus();
    return;
  }
  if (!phone || phone.length < 10) {
    alert('Please enter a valid 10-digit mobile number.');
    document.getElementById('custPhone')?.focus();
    return;
  }

  const totalPasses = Object.values(ticketQuantities).reduce((sum, q) => sum + (Number(q) || 0), 0);
  if (totalPasses < 1) {
    alert('Please choose at least 1 pass.');
    return;
  }

  const summaryParts = [];
  activeTickets.forEach((t, idx) => {
    const q = ticketQuantities[idx] || 0;
    if (q > 0) {
      summaryParts.push(`${t.name}: ${q}`);
    }
  });
  const passesSummary = summaryParts.join(', ') || '1 Pass';

  const payload = {
    user: { fullName, phone, instagram, age, email },
    booking: {
      venueId: activeBookingVenue.id,
      venueName: activeBookingVenue.name,
      totalPasses,
      couplePasses: ticketQuantities[0] || 0,
      stagPasses: ticketQuantities[1] || 0,
      passesSummary
    }
  };

  // Switch to Generating Animation View
  document.getElementById('modalBookingForm')?.classList.add('hidden');
  document.getElementById('modalGeneratingQR')?.classList.remove('hidden');
  document.getElementById('modalPaymentQR')?.classList.add('hidden');

  const titleNode = document.getElementById('genStatusTitle');
  const subNode = document.getElementById('genStatusSubtitle');
  const progressNode = document.getElementById('genProgressBar');

  if (titleNode) titleNode.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[#00f0ff] text-sm mr-2"></i><span>Generating QR for Secure Pay...</span>';
  if (subNode) subNode.textContent = 'Securing UPI payment session...';
  if (progressNode) progressNode.style.width = '25%';

  const animStep1 = setTimeout(() => {
    if (subNode) subNode.textContent = 'Allocating pass code and venue reservation...';
    if (progressNode) progressNode.style.width = '65%';
  }, 500);

  const animStep2 = setTimeout(() => {
    if (subNode) subNode.textContent = 'Binding PhonePe merchant QR for secure pay...';
    if (progressNode) progressNode.style.width = '90%';
  }, 1100);

  const startTime = Date.now();

  try {
    const res = await fetch(`${API_BASE}/api/create-pass-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server error occurred');

    // Ensure futuristic generation animation displays for at least 1.6s
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 1600 - elapsed);
    if (progressNode) progressNode.style.width = '100%';

    setTimeout(() => {
      // Transition from Generating Animation to Payment QR Stage
      document.getElementById('modalGeneratingQR')?.classList.add('hidden');
      document.getElementById('modalPaymentQR')?.classList.remove('hidden');

      // Populate Pass Code and Summary
      const codeNode = document.getElementById('qrPassCodeDisplay');
      if (codeNode) codeNode.textContent = `#${data.passCode || 'PUB-PASS'}`;

      const summaryNode = document.getElementById('qrPassSummaryDisplay');
      if (summaryNode) {
        summaryNode.textContent = passesSummary;
      }

      // Pre-filled WhatsApp confirmation message with full user info
      const eventName = data.venueName || activeBookingVenue.name;
      const ageDisplay = age ? `${age} yrs` : 'N/A';
      const phoneDisplay = phone || 'N/A';
      const instaDisplay = instagram ? `@${instagram}` : 'Not provided';
      const emailDisplay = email || 'Not provided';

      const waText = 
        `*PUB SCENE - PASS PAYMENT & CONFIRMATION*\n\n` +
        `*Event:* ${eventName}\n` +
        `*Pass Code:* #${data.passCode}\n\n` +
        `*GUEST DETAILS:*\n` +
        `• *Name:* ${fullName}\n` +
        `• *Age:* ${ageDisplay}\n` +
        `• *Mobile:* ${phoneDisplay}\n` +
        `• *Instagram ID:* ${instaDisplay}\n` +
        `• *Email:* ${emailDisplay}\n\n` +
        `*PASSES:* ${passesSummary}\n\n` +
        `I have completed payment on the PhonePe QR code and attached my payment screenshot above. Please verify and send my tickets!`;

      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;
      const waBtn = document.getElementById('whatsappRedirectBtn');
      if (waBtn) {
        waBtn.href = waUrl;
      }
    }, remainingDelay);

  } catch (err) {
    clearTimeout(animStep1);
    clearTimeout(animStep2);
    console.error(err);
    alert('Unable to generate payment QR: ' + err.message);
    document.getElementById('modalGeneratingQR')?.classList.add('hidden');
    document.getElementById('modalBookingForm')?.classList.remove('hidden');
  }
});

document.getElementById('bookingModal')?.addEventListener('click', (event) => {
  if (event.target.id === 'bookingModal') closeModal();
});
