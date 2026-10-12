// Booking state for the pass modal with PhonePe QR & WhatsApp verification.
let activeBookingVenue = null;
let quantities = {
  couple: 1,
  stag: 0
};

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';
const WHATSAPP_NUMBER = '918855882926';

function changeQty(type, delta) {
  if (!quantities.hasOwnProperty(type)) return;
  quantities[type] = Math.max(0, quantities[type] + delta);
  const qtyNode = document.getElementById(`qty-${type}`);
  if (qtyNode) qtyNode.textContent = String(quantities[type]);
}

function openBookingModal(venueId) {
  const venue = typeof findEventById === 'function' ? findEventById(venueId) : null;
  if (!venue) {
    alert('This event is not available for booking right now.');
    return;
  }

  activeBookingVenue = venue;
  quantities.couple = 1;
  quantities.stag = 0;

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText('modalClubName', venue.name);
  setText('modalClubArea', `${venue.areaName || ''} • ${venue.venueName || ''}`);
  setText('modalClubOffer', venue.offerText || 'Exclusive entry pass');
  setText('modalEventDate', venue.date || '');
  setText('qty-couple', '1');
  setText('qty-stag', '0');

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
  if (quantities.couple === 0 && quantities.stag === 0) {
    alert('Please choose at least 1 pass (couple or stag).');
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
  if (quantities.couple === 0 && quantities.stag === 0) {
    alert('Please choose at least 1 pass (couple or stag).');
    return;
  }

  const payload = {
    user: { fullName, phone, instagram, age, email },
    booking: {
      venueId: activeBookingVenue.id,
      venueName: activeBookingVenue.name,
      couplePasses: quantities.couple,
      stagPasses: quantities.stag
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

    // Ensure the futuristic generation animation displays for at least 1.6s
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

      const summaryParts = [];
      if (quantities.couple > 0) summaryParts.push(`Couple: ${quantities.couple}`);
      if (quantities.stag > 0) summaryParts.push(`Stag: ${quantities.stag}`);
      const passesSummary = summaryParts.join(', ') || '1 Pass';

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
