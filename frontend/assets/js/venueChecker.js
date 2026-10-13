// PUB SCENE • In-Website Venue Checker & QR Scanner

let vcQrScanner = null;
let vcIsScanning = false;
let vcIsProcessing = false;
let vcFacingMode = "environment";
let currentSelectedVenue = "ALL";

// Audio Feedback Synthesizers
const vcAudioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playVcSound(isSuccess) {
  try {
    if (vcAudioCtx.state === 'suspended') vcAudioCtx.resume();
    const now = vcAudioCtx.currentTime;
    const osc = vcAudioCtx.createOscillator();
    const gain = vcAudioCtx.createGain();

    if (isSuccess) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      if (navigator.vibrate) navigator.vibrate([100, 50, 150]);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }

    osc.connect(gain);
    gain.connect(vcAudioCtx.destination);
    osc.start(now);
    osc.stop(now + (isSuccess ? 0.4 : 0.5));
  } catch (e) {
    console.error("Audio feedback error:", e);
  }
}

// Open & Close Modal
function openVenueCheckerModal() {
  const modal = document.getElementById("venueCheckerModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");

  const isLoggedIn = sessionStorage.getItem("venue_checker_auth") === "true";
  if (isLoggedIn) {
    showVenueSelectStage();
  } else {
    showLoginStage();
  }
}

function closeVenueCheckerModal() {
  const modal = document.getElementById("venueCheckerModal");
  if (!modal) return;
  stopVcCamera();
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// Stage Navigation
function showLoginStage() {
  stopVcCamera();
  document.getElementById("vcLoginStage")?.classList.remove("hidden");
  document.getElementById("vcVenueStage")?.classList.add("hidden");
  document.getElementById("vcScannerStage")?.classList.add("hidden");
}

function showVenueSelectStage() {
  stopVcCamera();
  document.getElementById("vcLoginStage")?.classList.add("hidden");
  document.getElementById("vcVenueStage")?.classList.remove("hidden");
  document.getElementById("vcScannerStage")?.classList.add("hidden");
  loadVenueOptions();
}

function showScannerStage() {
  document.getElementById("vcLoginStage")?.classList.add("hidden");
  document.getElementById("vcVenueStage")?.classList.add("hidden");
  document.getElementById("vcScannerStage")?.classList.remove("hidden");

  const venueTitle = document.getElementById("vcActiveVenueDisplay");
  if (venueTitle) {
    venueTitle.textContent = currentSelectedVenue === "ALL" ? "All Venues / Tonight's Events" : currentSelectedVenue;
  }

  document.getElementById("vcResultContainer")?.classList.add("hidden");
  startVcCamera();
}

// 1. Guard Login (User: check_ve | Pass: work_01)
async function handleCheckerLogin(event) {
  if (event) event.preventDefault();

  const user = document.getElementById("vcUserInput")?.value?.trim();
  const pass = document.getElementById("vcPassInput")?.value?.trim();
  const errorEl = document.getElementById("vcLoginError");

  if (!user || !pass) {
    if (errorEl) {
      errorEl.textContent = "Please enter User ID and Password.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  try {
    const res = await fetch("/api/venue-checker/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user, password: pass })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      sessionStorage.setItem("venue_checker_auth", "true");
      sessionStorage.setItem("venue_checker_user", user);
      if (errorEl) errorEl.classList.add("hidden");
      showVenueSelectStage();
    } else {
      if (errorEl) {
        errorEl.textContent = data.error || "Incorrect User ID or Password. Try again.";
        errorEl.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.classList.remove("hidden");
    }
  }
}

function handleCheckerLogout() {
  sessionStorage.removeItem("venue_checker_auth");
  sessionStorage.removeItem("venue_checker_user");
  showLoginStage();
}

// 2. Load Venue Options into Dropdown
async function loadVenueOptions() {
  const select = document.getElementById("vcVenueSelect");
  if (!select) return;

  try {
    const [eventsRes, venuesRes] = await Promise.all([
      fetch("/api/events").then(r => r.json()).catch(() => ({ events: [] })),
      fetch("/api/venues").then(r => r.json()).catch(() => ({ venues: [] }))
    ]);

    const events = Array.isArray(eventsRes.events) ? eventsRes.events : [];
    const venues = Array.isArray(venuesRes.venues) ? venuesRes.venues : [];

    let optionsHtml = `<option value="ALL">★ All Events & Venues Tonight</option>`;

    if (events.length > 0) {
      optionsHtml += `<optgroup label="Active Events Tonight">`;
      events.forEach(e => {
        optionsHtml += `<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)} (${escapeHtml(e.venueName || 'Nagpur')})</option>`;
      });
      optionsHtml += `</optgroup>`;
    }

    if (venues.length > 0) {
      optionsHtml += `<optgroup label="Venues & Club Lounges">`;
      venues.forEach(v => {
        optionsHtml += `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)}</option>`;
      });
      optionsHtml += `</optgroup>`;
    }

    select.innerHTML = optionsHtml;
  } catch (e) {
    console.error("Failed to load venues list:", e);
  }
}

// 3. Start Camera Scanning with Enhanced Permission & HTTPS Detection
async function startVcCamera() {
  if (vcIsScanning) return;

  const viewportEl = document.getElementById("vcCameraViewport");
  const manualSection = document.getElementById("vcManualSection");

  // Check if browser context is insecure (Mobile browsers block camera on plain HTTP)
  const isSecure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    console.warn("Insecure HTTP origin detected. Mobile browsers block getUserMedia on HTTP.");
    if (viewportEl) {
      viewportEl.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center p-4 text-center bg-[#15112e] text-gray-200">
          <i class="fa-solid fa-lock text-3xl text-yellow-400 mb-2"></i>
          <h4 class="text-xs font-bold text-white mb-1">Mobile Camera Requires HTTPS</h4>
          <p class="text-[11px] text-gray-300 mb-2">Mobile Chrome & Safari block camera access on unencrypted HTTP web addresses.</p>
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-[10px] text-yellow-300 font-semibold mb-3">
            To test camera scanning right now, use the HTTPS link or enter pass code below.
          </div>
          <button type="button" onclick="document.getElementById('vcManualCodeInput')?.focus()" 
                  class="bg-[#00f0ff] text-black font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95">
            <i class="fa-solid fa-keyboard mr-1"></i> Type Code Manually
          </button>
        </div>`;
    }
    if (manualSection) manualSection.classList.remove("hidden");
    return;
  }

  try {
    if (!vcQrScanner) {
      vcQrScanner = new Html5Qrcode("vcCameraViewport");
    }

    // Attempt starting with environment camera
    await vcQrScanner.start(
      { facingMode: vcFacingMode },
      { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
      onVcScanSuccess,
      () => {}
    );
    vcIsScanning = true;
  } catch (err) {
    console.warn("Primary camera start failed, trying camera devices list:", err);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        // Pick the back camera (usually last device) or first device
        const chosenId = devices[devices.length - 1].id;
        await vcQrScanner.start(chosenId, { fps: 15, qrbox: 220 }, onVcScanSuccess, () => {});
        vcIsScanning = true;
      } else {
        throw new Error("No camera devices available");
      }
    } catch (e) {
      console.error("Camera access failed completely:", e);
      if (manualSection) manualSection.classList.remove("hidden");
      
      const isPermissionDenied = String(e?.name || e?.message || '').toLowerCase().includes("notallowed") ||
                                 String(e?.name || e?.message || '').toLowerCase().includes("permission");

      if (viewportEl) {
        viewportEl.innerHTML = `
          <div class="h-full flex flex-col items-center justify-center p-4 text-center bg-[#15112e] text-gray-200">
            <i class="fa-solid fa-camera-slash text-3xl text-red-400 mb-2"></i>
            <h4 class="text-xs font-bold text-white mb-1">${isPermissionDenied ? 'Camera Permission Denied' : 'Camera Unavailable'}</h4>
            <p class="text-[11px] text-gray-300 mb-2">
              ${isPermissionDenied ? 'Please tap the site settings / lock icon in your browser address bar and set Camera to <strong>Allow</strong>.' : 'Unable to activate device camera.'}
            </p>
            <button type="button" onclick="startVcCamera()" class="bg-[#bd00ff] text-white font-bold text-[11px] px-3 py-1.5 rounded-lg active:scale-95 mb-1">
              <i class="fa-solid fa-rotate-right mr-1"></i> Retry Camera
            </button>
          </div>`;
      }
    }
  }
}

async function stopVcCamera() {
  if (vcQrScanner && vcIsScanning) {
    try {
      await vcQrScanner.stop();
    } catch (e) {
      console.error("Camera stop error:", e);
    }
    vcIsScanning = false;
  }
}

// 4. On QR Code Scanned
async function onVcScanSuccess(decodedText) {
  if (vcIsProcessing) return;

  const match = decodedText.match(/PUB-?\d{5,8}/i);
  const passCode = match ? match[0].toUpperCase().replace("PUB", "PUB-").replace("--", "-") : decodedText.trim();
  if (!passCode) return;

  vcIsProcessing = true;
  if (vcQrScanner && vcIsScanning) {
    try { vcQrScanner.pause(); } catch (_) {}
  }

  await verifyPassAtVenue(passCode);
}

// 5. Verify Pass & Display Full Data
async function verifyPassAtVenue(passCode) {
  const resultContainer = document.getElementById("vcResultContainer");
  if (resultContainer) resultContainer.classList.remove("hidden");

  let res, data;
  try {
    res = await fetch("/api/scanner/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passCode,
        guardName: "Security (" + currentSelectedVenue + ")",
        selectedVenue: currentSelectedVenue
      })
    });
    data = await res.json().catch(() => ({}));
  } catch (netErr) {
    console.error("Network fetch error:", netErr);
    playVcSound(false);
    renderResultCard("INVALID", { pass_code: passCode }, "Network connection error. Please try again.", null);
    return;
  }

  const booking = data.booking || {};

  try {
    if (res.ok && data.status === "ADMITTED") {
      playVcSound(true);
      renderResultCard("ADMITTED", booking, "PASS VERIFIED • ENTRY ALLOWED", data.venueWarning);
    } else if (res.status === 409 || data.status === "ALREADY_CHECKED_IN") {
      playVcSound(false);
      renderResultCard("DUPLICATE", booking, data.message || "ALREADY SCANNED! Entry Rejected.", null);
    } else {
      playVcSound(false);
      renderResultCard("INVALID", booking.pass_code ? booking : { pass_code: passCode }, data.error || "Pass code not found in system.", null);
    }
  } catch (renderErr) {
    console.error("Render result card error:", renderErr);
  }
}

function renderResultCard(status, booking, message, venueWarning) {
  const container = document.getElementById("vcResultContainer");
  if (container) container.classList.remove("hidden");

  const badgeEl = document.getElementById("vcResultStatusBadge");
  const msgEl = document.getElementById("vcResultMessage");

  const nameEl = document.getElementById("vcDataName");
  const phoneEl = document.getElementById("vcDataPhone");
  const passCodeEl = document.getElementById("vcDataPassCode");
  const eventEl = document.getElementById("vcDataEvent");
  const passesEl = document.getElementById("vcDataPasses");
  const amountEl = document.getElementById("vcDataAmount");
  const checkinTimeEl = document.getElementById("vcDataTime");
  const warningEl = document.getElementById("vcVenueWarningBox");

  if (status === "ADMITTED") {
    if (badgeEl) {
      badgeEl.className = "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/50";
      badgeEl.textContent = "✔ ADMITTED";
    }
    if (msgEl) {
      msgEl.className = "text-xs font-bold text-green-300 mt-1";
      msgEl.textContent = message || "PASS VERIFIED • ENTRY ALLOWED";
    }
  } else if (status === "DUPLICATE") {
    if (badgeEl) {
      badgeEl.className = "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/50";
      badgeEl.textContent = "🛑 ALREADY USED";
    }
    if (msgEl) {
      msgEl.className = "text-xs font-bold text-red-400 mt-1";
      msgEl.textContent = message || "ALREADY SCANNED! Duplicate entry rejected.";
    }
  } else {
    if (badgeEl) {
      badgeEl.className = "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/50";
      badgeEl.textContent = "⚠️ INVALID PASS";
    }
    if (msgEl) {
      msgEl.className = "text-xs font-bold text-yellow-300 mt-1";
      msgEl.textContent = message || "Pass code not found in system.";
    }
  }

  if (warningEl) {
    if (venueWarning) {
      warningEl.textContent = venueWarning;
      warningEl.classList.remove("hidden");
    } else {
      warningEl.classList.add("hidden");
    }
  }

  const b = booking || {};
  if (nameEl) nameEl.textContent = ((b.full_name || "GUEST").toUpperCase()) + (b.age ? " (" + b.age + " yrs)" : '');
  if (phoneEl) phoneEl.textContent = b.phone || "N/A";
  if (passCodeEl) passCodeEl.textContent = "#" + (b.pass_code || "PUB-000000");
  if (eventEl) eventEl.textContent = b.venue_name || b.event_title || "Event Pass";
  if (passesEl) passesEl.textContent = b.passes_summary || (b.couple_passes > 0 ? "Couple Pass: 1" : "1 Pass");
  if (amountEl) amountEl.textContent = "₹" + Number(b.total_amount || 0).toLocaleString("en-IN");
  if (checkinTimeEl) checkinTimeEl.textContent = b.checked_in_at || "Just Now";

  if (container) {
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}
  }
}

function resetVcScan() {
  document.getElementById("vcResultContainer")?.classList.add("hidden");
  vcIsProcessing = false;
  if (vcQrScanner && vcIsScanning) {
    try { vcQrScanner.resume(); } catch (_) { startVcCamera(); }
  }
}

// Manual Code Entry Fallback
function handleVcManualSubmit() {
  const input = document.getElementById("vcManualCodeInput");
  const code = input?.value?.trim();
  if (!code) {
    alert("Please enter a pass code.");
    return;
  }
  input.value = "";
  verifyPassAtVenue(code);
}

// Flip Camera
function toggleVcCamera() {
  vcFacingMode = vcFacingMode === "environment" ? "user" : "environment";
  stopVcCamera().then(() => startVcCamera());
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}