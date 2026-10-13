const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'pubscene.db');

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  console.log('Connected to SQLite database: pubscene.db');
} catch (err) {
  console.error('SQLite failed to open. The API cannot start:', err.message);
  throw err;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    whatsapp_consent INTEGER DEFAULT 1,
    city TEXT DEFAULT 'Nagpur',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    couple_passes INTEGER DEFAULT 0,
    stag_passes INTEGER DEFAULT 0,
    total_amount REAL NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    payment_status TEXT DEFAULT 'PENDING',
    pass_code TEXT UNIQUE NOT NULL,
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    area_id TEXT NOT NULL,
    area_name TEXT NOT NULL,
    category TEXT NOT NULL,
    event_date TEXT NOT NULL,
    price REAL NOT NULL,
    cover_price REAL NOT NULL,
    offer_text TEXT,
    image TEXT,
    badge TEXT,
    couple_price REAL DEFAULT 0,
    last_booking_date TEXT
  );

  CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    cover_image TEXT,
    logo_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS organizers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    rating TEXT,
    description TEXT,
    tag TEXT
  );

  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organizer_id, client_id)
  );

  CREATE TABLE IF NOT EXISTS collab_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('instagram')) db.exec('ALTER TABLE users ADD COLUMN instagram TEXT');
if (!userColumns.includes('age')) db.exec('ALTER TABLE users ADD COLUMN age INTEGER');

const eventColumns = db.prepare('PRAGMA table_info(events)').all().map((column) => column.name);
if (!eventColumns.includes('couple_price')) {
  db.exec('ALTER TABLE events ADD COLUMN couple_price REAL DEFAULT 0');
}
if (!eventColumns.includes('last_booking_date')) {
  db.exec('ALTER TABLE events ADD COLUMN last_booking_date TEXT');
}
if (!eventColumns.includes('pass1_title')) {
  db.exec("ALTER TABLE events ADD COLUMN pass1_title TEXT DEFAULT 'Couple pass'");
}
if (!eventColumns.includes('pass1_desc')) {
  db.exec("ALTER TABLE events ADD COLUMN pass1_desc TEXT DEFAULT 'Entry for 2'");
}
if (!eventColumns.includes('pass2_title')) {
  db.exec("ALTER TABLE events ADD COLUMN pass2_title TEXT DEFAULT 'Stag pass'");
}
if (!eventColumns.includes('pass2_desc')) {
  db.exec("ALTER TABLE events ADD COLUMN pass2_desc TEXT DEFAULT 'Single entry'");
}
if (!eventColumns.includes('tickets')) {
  db.exec('ALTER TABLE events ADD COLUMN tickets TEXT');
}

const bookingColumns = db.prepare('PRAGMA table_info(bookings)').all().map((column) => column.name);
if (!bookingColumns.includes('passes_summary')) {
  db.exec('ALTER TABLE bookings ADD COLUMN passes_summary TEXT');
}
if (!bookingColumns.includes('checked_in')) {
  db.exec('ALTER TABLE bookings ADD COLUMN checked_in INTEGER DEFAULT 0');
}
if (!bookingColumns.includes('checked_in_at')) {
  db.exec('ALTER TABLE bookings ADD COLUMN checked_in_at TEXT DEFAULT NULL');
}
if (!bookingColumns.includes('checked_in_by')) {
  db.exec('ALTER TABLE bookings ADD COLUMN checked_in_by TEXT DEFAULT NULL');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const seedEvents = [
  ['city-showdown', 'City Showdown ft. Shubz', 'Raasta, Nagpur', 'raasta', 'Raasta', 'club_nights', 'Sat, 12 Sep • 8:00 PM', 499, 999, 'Bollywood, Bolly-tech and commercial. Also featuring Squadout and DJ Vicky.', '/assets/flyers/city-showdown.jpg', 'SHUBZ', 499],
  ['night-to-remember', 'Night To Remember ft. Hamshyre', 'Raasta, Nagpur', 'raasta', 'Raasta', 'club_nights', 'Sun, 4 Oct • 8:00 PM', 499, 999, 'A night to remember at Raasta.', '/assets/flyers/night-to-remember.jpg', 'HAMSHYRE', 499],
  ['shanivaar', 'Shanivaar ft. Neel Chhabra', 'Raasta, Nagpur', 'raasta', 'Raasta', 'club_nights', 'Sat, 26 Sep • 9:00 PM', 499, 999, 'Also featuring Squadout and Vicky.', '/assets/flyers/shanivaar.jpg', 'NEEL CHHABRA', 499]
];

const seedOrganizers = [
  ['org-1', 'The Vibe Club', 'Dharampeth, Nagpur', '★ 5.0', 'Curating exclusive underground techno sessions & rooftop electronic jams.', 'VIBE'],
  ['org-2', 'Common Ground Club', 'Civil Lines, Nagpur', '★ 4.9', 'A space for music, dance, community jams, and weekend nightlife vibes.', 'CGC'],
  ['org-3', 'Nine O Nine Lounge', 'Wardha Road, Nagpur', '★ 4.8', 'Nagpur’s high-energy lounge featuring Bollywood DJ nights & craft beer.', '909']
];

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (
    id, name, venue_name, area_id, area_name, category, event_date,
    price, cover_price, offer_text, image, badge, couple_price
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertOrganizer = db.prepare(`
  INSERT OR IGNORE INTO organizers (id, name, location, rating, description, tag)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seedVenues = [
  ['ven-raasta', 'Raasta, Nagpur', 'VIP Road, Civil Lines, Nagpur, Maharashtra 440001', '/assets/images/logo.png', '/assets/images/logo.png'],
  ['ven-agent-jacks', 'Agent Jacks', 'West High Court Road, Dharampeth, Nagpur, Maharashtra 440010', '/assets/images/logo.png', '/assets/images/logo.png'],
  ['ven-vibe-club', 'The Vibe Club', 'Dharampeth, Nagpur, Maharashtra 440010', '/assets/images/logo.png', '/assets/images/logo.png'],
  ['ven-nine-o-nine', 'Nine O Nine Lounge', 'Wardha Road, Somalwada, Nagpur, Maharashtra 440025', '/assets/images/logo.png', '/assets/images/logo.png'],
  ['ven-dabo', 'Dabo Club & Kitchen', 'New Manish Nagar, Wardha Road, Nagpur, Maharashtra 440025', '/assets/images/logo.png', '/assets/images/logo.png']
];

const insertVenue = db.prepare(`
  INSERT OR IGNORE INTO venues (id, name, location, cover_image, logo_image)
  VALUES (?, ?, ?, ?, ?)
`);

try {
  db.transaction(() => {
    const migrated = db.prepare('SELECT value FROM app_meta WHERE key = ?').get('original_flyers_v1');
    if (!migrated) {
      db.prepare('DELETE FROM events WHERE id IN (?, ?, ?, ?)').run('v-1', 'v-2', 'v-3', 'v-4');
      seedEvents.forEach((row) => insertEvent.run(...row));
      db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('original_flyers_v1', '1');
    }
    seedOrganizers.forEach((row) => insertOrganizer.run(...row));
    const venueCount = db.prepare('SELECT COUNT(*) AS c FROM venues').get().c;
    if (venueCount === 0) {
      seedVenues.forEach((row) => insertVenue.run(...row));
    }
  })();
} catch (err) {
  console.error('Seed skipped:', err.message);
}

function mapEvent(row) {
  let tickets = [];
  if (row.tickets) {
    try {
      tickets = JSON.parse(row.tickets);
      if (!Array.isArray(tickets)) tickets = [];
    } catch (_) {
      tickets = [];
    }
  }

  if (!tickets.length) {
    tickets = [
      {
        id: 't-1',
        name: row.pass1_title || 'Couple pass',
        desc: row.pass1_desc || 'Entry for 2',
        price: row.couple_price == null ? 0 : row.couple_price
      },
      {
        id: 't-2',
        name: row.pass2_title || 'Stag pass',
        desc: row.pass2_desc || 'Single entry',
        price: row.cover_price == null ? 0 : row.cover_price
      }
    ];
  }

  const pass1 = tickets[0] || { name: 'Couple pass', desc: 'Entry for 2', price: 0 };
  const pass2 = tickets[1] || { name: 'Stag pass', desc: 'Single entry', price: 0 };

  return {
    id: row.id,
    name: row.name,
    venueName: row.venue_name,
    areaId: row.area_id,
    areaName: row.area_name,
    category: row.category,
    date: row.event_date,
    price: row.price,
    coverPrice: pass2.price,
    couplePrice: pass1.price,
    pass1Title: pass1.name,
    pass1Desc: pass1.desc,
    pass2Title: pass2.name,
    pass2Desc: pass2.desc,
    tickets,
    offerText: row.offer_text,
    image: row.image,
    badge: row.badge,
    lastBookingDate: row.last_booking_date
  };
}

function listEvents({ category, area, q } = {}) {
  let sql = 'SELECT * FROM events WHERE 1 = 1';
  const params = [];
  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (area && area !== 'all') {
    sql += ' AND area_id = ?';
    params.push(area);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR venue_name LIKE ? OR area_name LIKE ? OR offer_text LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY price ASC';
  return db.prepare(sql).all(...params).map(mapEvent);
}

function getEventById(id) {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  return row ? mapEvent(row) : null;
}

function listOrganizers(clientId) {
  return db.prepare(`
    SELECT o.id, o.name, o.location, o.rating, o.description, o.tag,
           (SELECT COUNT(*) FROM follows f WHERE f.organizer_id = o.id) AS followers,
           EXISTS(SELECT 1 FROM follows f WHERE f.organizer_id = o.id AND f.client_id = ?) AS following
    FROM organizers o
    ORDER BY o.name
  `).all(clientId || '');
}

function setFollow(organizerId, clientId, following) {
  const org = db.prepare('SELECT id FROM organizers WHERE id = ?').get(organizerId);
  if (!org) return null;
  if (following) {
    db.prepare('INSERT OR IGNORE INTO follows (organizer_id, client_id) VALUES (?, ?)').run(organizerId, clientId);
  } else {
    db.prepare('DELETE FROM follows WHERE organizer_id = ? AND client_id = ?').run(organizerId, clientId);
  }
  const followers = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE organizer_id = ?').get(organizerId).c;
  const isFollowing = !!db.prepare('SELECT 1 AS ok FROM follows WHERE organizer_id = ? AND client_id = ?').get(organizerId, clientId);
  return { organizerId, following: isFollowing, followers };
}

function createCollabLead({ fullName, phone, email, message }) {
  const info = db.prepare(`
    INSERT INTO collab_leads (full_name, phone, email, message)
    VALUES (?, ?, ?, ?)
  `).run(fullName, phone, email || null, message || null);
  return { id: info.lastInsertRowid };
}

function listAdminUsers() {
  return db.prepare(`
    SELECT u.id, u.full_name, u.phone, u.email, u.city, u.created_at,
           COUNT(b.id) as total_bookings,
           COALESCE(SUM(b.total_amount), 0) as lifetime_spent
    FROM users u
    LEFT JOIN bookings b ON u.id = b.user_id AND b.payment_status IN ('SUCCESS', 'FREE_CONFIRMED', 'SUCCESS_WEBHOOK')
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
}

function saveOrGetUser(userData) {
  return new Promise((resolve, reject) => {
    try {
      const { fullName, phone, instagram, age, email } = userData;
      const phoneKey = phone || ('ig:' + String(instagram || '').toLowerCase());
      const upsert = db.prepare(`
        INSERT INTO users (full_name, phone, email, instagram, age)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          full_name = excluded.full_name,
          email = excluded.email,
          instagram = excluded.instagram,
          age = excluded.age
      `);
      upsert.run(fullName, phoneKey, email || null, instagram || null, age);
      const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phoneKey);
      resolve(user.id);
    } catch (err) {
      reject(err);
    }
  });
}

function createBooking(bookingData) {
  return new Promise((resolve, reject) => {
    try {
      const {
        userId, venueId, venueName, couplePasses, stagPasses,
        totalAmount, razorpayOrderId, passCode, status, passesSummary
      } = bookingData;

      const info = db.prepare(`
        INSERT INTO bookings (
          user_id, venue_id, venue_name, couple_passes, stag_passes,
          total_amount, razorpay_order_id, pass_code, payment_status, passes_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, venueId, venueName, couplePasses || 0, stagPasses || 0,
        totalAmount, razorpayOrderId, passCode, status, passesSummary || null
      );

      resolve({ bookingId: info.lastInsertRowid, passCode });
    } catch (err) {
      reject(err);
    }
  });
}

function updateBookingPayment(orderId, paymentId, status) {
  return new Promise((resolve, reject) => {
    try {
      const info = db.prepare(`
        UPDATE bookings
        SET payment_status = ?, razorpay_payment_id = ?
        WHERE razorpay_order_id = ?
      `).run(status, paymentId, orderId);
      resolve(info.changes);
    } catch (err) {
      reject(err);
    }
  });
}

function saveEvent(event) {
  let tickets = [];
  if (Array.isArray(event.tickets)) {
    tickets = event.tickets.map((t, idx) => ({
      id: t.id || `t-${idx + 1}-${Date.now().toString(36)}`,
      name: String(t.name || `Ticket #${idx + 1}`).trim(),
      desc: String(t.desc || '').trim(),
      price: Math.max(0, Number(t.price) || 0)
    })).filter(t => t.name.length > 0);
  } else if (typeof event.tickets === 'string') {
    try {
      tickets = JSON.parse(event.tickets);
      if (!Array.isArray(tickets)) tickets = [];
    } catch (_) {}
  }

  if (!tickets.length) {
    const couplePrice = Math.max(0, Number(event.couplePrice) || 0);
    const coverPrice = Math.max(0, Number(event.coverPrice) || 0);
    tickets = [
      {
        id: 't-1',
        name: String(event.pass1Title || 'Couple pass').trim(),
        desc: String(event.pass1Desc || 'Entry for 2').trim(),
        price: couplePrice
      },
      {
        id: 't-2',
        name: String(event.pass2Title || 'Stag pass').trim(),
        desc: String(event.pass2Desc || 'Single entry').trim(),
        price: coverPrice
      }
    ];
  }

  const pass1 = tickets[0] || { name: 'Couple pass', desc: 'Entry for 2', price: 0 };
  const pass2 = tickets[1] || { name: 'Stag pass', desc: 'Single entry', price: 0 };
  const couplePrice = pass1.price;
  const coverPrice = pass2.price;
  const pass1Title = pass1.name;
  const pass1Desc = pass1.desc;
  const pass2Title = pass2.name;
  const pass2Desc = pass2.desc;

  const paid = tickets.map(t => t.price).filter(p => p > 0);
  const fromPrice = paid.length ? Math.min(...paid) : 0;
  const ticketsJson = JSON.stringify(tickets);

  db.prepare(`
    INSERT INTO events (
      id, name, venue_name, area_id, area_name, category, event_date,
      price, cover_price, couple_price, pass1_title, pass1_desc, pass2_title, pass2_desc,
      tickets, offer_text, image, badge, last_booking_date
    ) VALUES (
      @id, @name, @venueName, @areaId, @areaName, @category, @date,
      @price, @coverPrice, @couplePrice, @pass1Title, @pass1Desc, @pass2Title, @pass2Desc,
      @tickets, @offerText, @image, @badge, @lastBookingDate
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      venue_name = excluded.venue_name,
      area_id = excluded.area_id,
      area_name = excluded.area_name,
      category = excluded.category,
      event_date = excluded.event_date,
      price = excluded.price,
      cover_price = excluded.cover_price,
      couple_price = excluded.couple_price,
      pass1_title = excluded.pass1_title,
      pass1_desc = excluded.pass1_desc,
      pass2_title = excluded.pass2_title,
      pass2_desc = excluded.pass2_desc,
      tickets = excluded.tickets,
      offer_text = excluded.offer_text,
      image = excluded.image,
      badge = excluded.badge,
      last_booking_date = excluded.last_booking_date
  `).run({
    id: event.id,
    name: event.name,
    venueName: event.venueName,
    areaId: event.areaId,
    areaName: event.areaName,
    category: event.category,
    date: event.date,
    price: fromPrice,
    coverPrice,
    couplePrice,
    pass1Title,
    pass1Desc,
    pass2Title,
    pass2Desc,
    tickets: ticketsJson,
    offerText: event.offerText || '',
    image: event.image || '',
    badge: event.badge || '',
    lastBookingDate: event.lastBookingDate || null
  });
  return getEventById(event.id);
}

function deleteEvent(id) {
  return db.prepare('DELETE FROM events WHERE id = ?').run(id).changes;
}

function getBookingByPassCode(passCode) {
  if (!passCode) return null;
  const cleaned = String(passCode).trim().replace(/^#+/, '').replace(/^PUBSCENE:/i, '').trim().toUpperCase();
  const row = db.prepare(`
    SELECT b.*, 
           u.full_name, u.phone, u.instagram, u.age, u.email,
           e.name as event_title, e.venue_name as event_venue, e.event_date, e.image as event_image
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN events e ON e.id = b.venue_id
    WHERE UPPER(b.pass_code) = ?
  `).get(cleaned);
  return row || null;
}

function checkInPass(passCode, guardName = 'Guard', selectedVenue = 'ALL') {
  if (!passCode) return { success: false, status: 'INVALID', error: 'Pass code is required' };
  const cleaned = String(passCode).trim().replace(/^#+/, '').replace(/^PUBSCENE:/i, '').trim().toUpperCase();
  const booking = getBookingByPassCode(cleaned);
  if (!booking) {
    return { success: false, status: 'NOT_FOUND', error: `Pass Code #${cleaned} was not found in the system.` };
  }

  // Check if ticket is already checked in
  if (booking.checked_in === 1) {
    return {
      success: false,
      status: 'ALREADY_CHECKED_IN',
      message: `Already scanned & checked in at ${booking.checked_in_at || 'earlier'} by ${booking.checked_in_by || 'Security'}! Duplicate entry rejected.`,
      booking
    };
  }

  // Check venue mismatch (optional warning)
  let venueWarning = null;
  const bookingVenue = (booking.venue_name || booking.event_title || '').toLowerCase();
  const currentVenue = (selectedVenue || '').toLowerCase();
  if (selectedVenue && selectedVenue !== 'ALL' && !bookingVenue.includes(currentVenue) && !currentVenue.includes(bookingVenue)) {
    venueWarning = `Note: This pass was booked for "${booking.venue_name}", not "${selectedVenue}".`;
  }

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
  db.prepare(`
    UPDATE bookings 
    SET checked_in = 1, checked_in_at = ?, checked_in_by = ?
    WHERE id = ?
  `).run(now, guardName, booking.id);

  const updatedBooking = getBookingByPassCode(cleaned);
  return {
    success: true,
    status: 'ADMITTED',
    message: 'Pass Verified Successfully • Admitted!',
    venueWarning,
    booking: updatedBooking
  };
}

function listAdminBookings() {
  return db.prepare(`
    SELECT b.id, b.venue_name, b.couple_passes, b.stag_passes, b.total_amount,
           b.payment_status, b.pass_code, b.booking_date, b.passes_summary,
           u.full_name, u.phone, u.instagram, u.age, u.email
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    ORDER BY b.booking_date DESC
    LIMIT 100
  `).all();
}

function listCollabLeads() {
  return db.prepare(`
    SELECT id, full_name, phone, email, message, created_at
    FROM collab_leads
    ORDER BY created_at DESC
    LIMIT 100
  `).all();
}

function createAdminSession() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
  return token;
}

function getAdminSession(token) {
  if (!token) return null;
  const row = db.prepare('SELECT token, expires_at FROM admin_sessions WHERE token = ?').get(token);
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

function deleteAdminSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

function closeDatabase() {
  try {
    if (db && db.open) db.close();
  } catch (err) {
    console.error('SQLite close failed:', err.message);
  }
}

function listVenues() {
  return db.prepare('SELECT * FROM venues ORDER BY created_at DESC').all();
}
function getVenueById(id) {
  return db.prepare('SELECT * FROM venues WHERE id = ?').get(id);
}
function saveVenue(id, name, location, cover, logo) {
  db.prepare('INSERT OR REPLACE INTO venues (id, name, location, cover_image, logo_image) VALUES (?, ?, ?, ?, ?)').run(id, name, location, cover, logo);
}
function deleteVenue(id) {
  db.prepare('DELETE FROM venues WHERE id = ?').run(id);
}

module.exports = {
  db,
  listVenues,
  getVenueById,
  saveVenue,
  deleteVenue,
  closeDatabase,
  listEvents,
  getEventById,
  listOrganizers,
  setFollow,
  createCollabLead,
  listAdminUsers,
  saveOrGetUser,
  createBooking,
  updateBookingPayment,
  saveEvent,
  deleteEvent,
  listAdminBookings,
  listCollabLeads,
  createAdminSession,
  getAdminSession,
  deleteAdminSession,
  getBookingByPassCode,
  checkInPass
};
