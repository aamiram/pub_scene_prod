// Booking state for the pass modal with PhonePe / UPI QR & 1-Click Copy & WhatsApp verification.
let activeBookingVenue = null;
let activeTickets = [];
let ticketQuantities = {};
let lastBookingAmount = 0;

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';
const WHATSAPP_NUMBER = '918855882926';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calculateTotalAmount() {
  let total = 0;
  activeTickets.forEach((t, idx) => {
    const qty = Number(ticketQuantities[idx]) || 0;
    const price = Number(t.price) || 0;
    total += qty * price;
  });
  return total;
}

function updateBookingTotalDisplay() {
  const total = calculateTotalAmount();
  const formatted = `₹${total.toLocaleString('en-IN')}`;
  
  // Running total in booking form
  const formTotalNode = document.getElementById('formRunningTotalDisplay');
  if (formTotalNode) formTotalNode.textContent = formatted;

  // Amount displays in QR modal
  const topAmountNode = document.getElementById('qrTotalAmountDisplay');
  if (topAmountNode) topAmountNode.textContent = formatted;

  const cardAmountNode = document.getElementById('qrCardAmountDisplay');
  if (cardAmountNode) cardAmountNode.textContent = formatted;

  const upiAmountNode = document.getElementById('upiAmountValue');
  if (upiAmountNode) upiAmountNode.textContent = formatted;

  const instructAmountNode = document.getElementById('instructAmountDisplay');
  if (instructAmountNode) instructAmountNode.textContent = formatted;
}

function changeTicketQty(idx, delta) {
  if (ticketQuantities[idx] == null) ticketQuantities[idx] = idx === 0 ? 1 : 0;
  ticketQuantities[idx] = Math.max(0, ticketQuantities[idx] + delta);
  const qtyNode = document.getElementById(`qty-ticket-${idx}`);
  if (qtyNode) qtyNode.textContent = String(ticketQuantities[idx]);
  updateBookingTotalDisplay();
}

// For legacy inline changeQty calls
function changeQty(type, delta) {
  if (type === 'couple') changeTicketQty(0, delta);
  else if (type === 'stag') changeTicketQty(1, delta);
}

// 1-Click Clipboard Copy Helpers
function copyTextToClipboard(text, btnId, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopySuccess(btnId, successMsg);
    }).catch(() => {
      fallbackCopy(text, btnId, successMsg);
    });
  } else {
    fallbackCopy(text, btnId, successMsg);
  }
}

function fallbackCopy(text, btnId, successMsg) {
  const temp = document.createElement('input');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand('copy');
    showCopySuccess(btnId, successMsg);
  } catch (e) {
    alert('Copy failed. Please manually copy: ' + text);
  }
  document.body.removeChild(temp);
}

function showCopySuccess(btnId, successMsg) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-check text-green-400"></i><span class="text-green-400 font-bold">${successMsg || 'Copied!'}</span>`;
  setTimeout(() => {
    btn.innerHTML = original;
  }, 2000);
}

function copyUpiId() {
  // UPI ID copy disabled for security; payment completed via QR screenshot
}

function copyUpiAmount() {
  // Amount copy disabled
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
            <span class="text-[11px] font-bold text-[#00f0ff]">₹${Number(t.price || 0).toLocaleString('en-IN')}</span>
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

  // Update initial running total
  updateBookingTotalDisplay();

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
  let calculatedAmount = 0;
  activeTickets.forEach((t, idx) => {
    const q = ticketQuantities[idx] || 0;
    const price = Number(t.price) || 0;
    if (q > 0) {
      summaryParts.push(`${t.name}: ${q}`);
      calculatedAmount += q * price;
    }
  });
  const passesSummary = summaryParts.join(', ') || '1 Pass';
  const totalAmount = calculatedAmount;
  lastBookingAmount = totalAmount;

  const payload = {
    user: { fullName, phone, instagram, age, email },
    booking: {
      venueId: activeBookingVenue.id,
      venueName: activeBookingVenue.name,
      totalPasses,
      couplePasses: ticketQuantities[0] || 0,
      stagPasses: ticketQuantities[1] || 0,
      totalAmount,
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

  if (titleNode) titleNode.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[#00f0ff] text-sm mr-2"></i><span>Preparing Payment Session...</span>';
  if (subNode) subNode.textContent = `Securing order for ₹${totalAmount.toLocaleString('en-IN')}...`;
  if (progressNode) progressNode.style.width = '25%';

  const animStep1 = setTimeout(() => {
    if (subNode) subNode.textContent = 'Allocating pass code and securing venue reservation...';
    if (progressNode) progressNode.style.width = '65%';
  }, 500);

  const animStep2 = setTimeout(() => {
    if (subNode) subNode.textContent = 'Preparing PhonePe QR code and merchant details...';
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

    // Ensure animation displays smoothly
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 1400 - elapsed);
    if (progressNode) progressNode.style.width = '100%';

    setTimeout(() => {
      // Transition from Generating Animation to Payment QR Stage
      document.getElementById('modalGeneratingQR')?.classList.add('hidden');
      document.getElementById('modalPaymentQR')?.classList.remove('hidden');

      const passCode = data.passCode || 'PUB-PASS';
      const formattedAmount = `₹${totalAmount.toLocaleString('en-IN')}`;

      // 1. Populate Pass Code and Summary
      const codeNode = document.getElementById('qrPassCodeDisplay');
      if (codeNode) codeNode.textContent = `#${passCode}`;

      const summaryNode = document.getElementById('qrPassSummaryDisplay');
      if (summaryNode) summaryNode.textContent = passesSummary;

      // 2. Display Total Amount Prominently on Top of QR and in all badges
      const topAmountNode = document.getElementById('qrTotalAmountDisplay');
      if (topAmountNode) topAmountNode.textContent = formattedAmount;

      const cardAmountNode = document.getElementById('qrCardAmountDisplay');
      if (cardAmountNode) cardAmountNode.textContent = formattedAmount;

      const upiAmountNode = document.getElementById('upiAmountValue');
      if (upiAmountNode) upiAmountNode.textContent = formattedAmount;

      const instructAmountNode = document.getElementById('instructAmountDisplay');
      if (instructAmountNode) instructAmountNode.textContent = formattedAmount;

      // 3. Ensure official QR code is loaded
      const qrImg = document.getElementById('dynamicPaymentQrImg');
      if (qrImg) {
        qrImg.src = 'assets/images/payment-qr.png';
      }

      // 4. Pre-filled WhatsApp confirmation message with full user info & total amount
      const eventName = data.venueName || activeBookingVenue.name;
      const ageDisplay = age ? `${age} yrs` : 'N/A';
      const phoneDisplay = phone || 'N/A';
      const instaDisplay = instagram ? `@${instagram}` : 'Not provided';
      const emailDisplay = email || 'Not provided';

            const waText = 
        `*PUB SCENE - PASS PAYMENT & CONFIRMATION*\n\n` +
        `*Event:* ${eventName}\n` +
        `*Pass Code:* #${passCode}\n` +
        `*Total Amount:* ${formattedAmount}\n\n` +
        `*GUEST DETAILS:*\n` +
        `• *Name:* ${fullName}\n` +
        `• *Age:* ${ageDisplay}\n` +
        `• *Mobile:* ${phoneDisplay}\n` +
        `• *Instagram ID:* ${instaDisplay}\n` +
        `• *Email:* ${emailDisplay}\n\n` +
        `*PASSES:* ${passesSummary}\n\n` +
        `I have completed payment of ${formattedAmount} via QR code and attached my payment screenshot above. Please verify and send my tickets!`;

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
