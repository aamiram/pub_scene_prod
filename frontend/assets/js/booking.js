// Booking state for the pass modal.
let activeBookingVenue = null;
let quantities = {
  couple: 1,
  stag: 0
};

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';

function changeQty(type, delta) {
  if (!quantities.hasOwnProperty(type)) return;
  quantities[type] = Math.max(0, quantities[type] + delta);
  const qtyNode = document.getElementById(`qty-${type}`);
  if (qtyNode) qtyNode.textContent = String(quantities[type]);
  updateSubtotal();
}

function updateSubtotal() {
  if (!activeBookingVenue) return 0;
  const coupleCost = quantities.couple * Number(activeBookingVenue.couplePrice || 0);
  const stagCost = quantities.stag * Number(activeBookingVenue.coverPrice || 0);
  const total = coupleCost + stagCost;
  const totalNode = document.getElementById('bookingTotalDisplay');
  if (totalNode) totalNode.textContent = `₹${total}`;
  return total;
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
  setText('modalClubArea', `${venue.areaName} • ${venue.venueName}`);
  setText('modalClubOffer', venue.offerText);
  setText('modalEventDate', venue.date || '');
  setText('qty-couple', '1');
  setText('qty-stag', '0');
  const couplePrice = Number(venue.couplePrice || 0);
  setText('couplePriceLabel', couplePrice > 0 ? `₹${couplePrice} each` : 'Free entry');
  setText('stagPriceLabel', `₹${Number(venue.coverPrice || 0)} each`);

  updateSubtotal();
  ['custName', 'custAge', 'custInstagram', 'custPhone'].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.value = '';
  });
  document.getElementById('guestDetails')?.classList.add('hidden');
  document.getElementById('continueToDetailsBtn')?.classList.remove('hidden');

  const submitBtn = document.getElementById('confirmPassBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Claim Digital Entry Pass';
  }

  document.getElementById('modalBookingForm')?.classList.remove('hidden');
  document.getElementById('modalPassSuccess')?.classList.add('hidden');
  document.getElementById('bookingModal')?.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeModal() {
  document.getElementById('bookingModal')?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function renderDigitalPass(passCode, venueName) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('PUBSCENE_VALID_' + passCode)}`;
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText('passCodeDisplay', passCode);
  setText('passVenueDisplay', venueName);
  const qr = document.getElementById('passQRCode');
  if (qr) qr.src = qrUrl;

  document.getElementById('modalBookingForm')?.classList.add('hidden');
  document.getElementById('modalPassSuccess')?.classList.remove('hidden');
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
    alert('Choose an event before claiming a pass.');
    return;
  }

  const fullName = document.getElementById('custName')?.value?.trim();
  const age = parseInt(document.getElementById('custAge')?.value, 10);
  const instagram = (document.getElementById('custInstagram')?.value || '').trim().replace(/^@+/, '');
  const phone = (document.getElementById('custPhone')?.value || '').replace(/\D/g, '');
  const submitBtn = document.getElementById('confirmPassBtn');

  if (!fullName) {
    alert('Enter your name.');
    return;
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    alert('Enter your age.');
    return;
  }
  if (phone && phone.length < 10) {
    alert('Enter a valid mobile number, or leave it blank and add Instagram.');
    return;
  }
  if (!phone && !instagram) {
    alert('Add a mobile number or your Instagram.');
    return;
  }
  if (quantities.couple === 0 && quantities.stag === 0) {
    alert('Please choose at least 1 pass (couple or stag).');
    return;
  }

  const totalAmount = updateSubtotal();
  const payload = {
    user: { fullName, phone, instagram, age },
    booking: {
      venueId: activeBookingVenue.id,
      venueName: activeBookingVenue.name,
      couplePasses: quantities.couple,
      stagPasses: quantities.stag,
      totalAmount
    }
  };

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Confirming pass...';

  try {
    const res = await fetch(`${API_BASE}/api/create-pass-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server error occurred');

    if (data.isFree) {
      renderDigitalPass(data.passCode, data.venueName || activeBookingVenue.name);
      return;
    }

    if (typeof Razorpay !== 'function' || !data.keyId || !data.orderId) {
      throw new Error('Payment checkout is unavailable. Please try again.');
    }

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'PUB SCENE NAGPUR',
      description: `Entry pass for ${activeBookingVenue.name}`,
      order_id: data.orderId,
      prefill: {
        name: fullName,
        contact: phone || ''
      },
      theme: { color: '#ff007f' },
      modal: {
        ondismiss: function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      },
      handler: async function (response) {
        const verifyRes = await fetch(`${API_BASE}/api/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            passCode: data.passCode
          })
        });
        const verifyResult = await verifyRes.json().catch(() => ({}));
        if (verifyResult.status === 'success') {
          renderDigitalPass(data.passCode, activeBookingVenue.name);
        } else {
          alert(verifyResult.message || 'Payment verification failed. Please contact support.');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function () {
      alert('Payment was not completed. Your pass is still pending.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    });
    rzp.open();
  } catch (err) {
    console.error(err);
    alert('Unable to process pass: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

document.getElementById('bookingModal')?.addEventListener('click', (event) => {
  if (event.target.id === 'bookingModal') closeModal();
});
