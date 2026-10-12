const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  db,
  closeDatabase,
  saveOrGetUser,
  createBooking,
  listEvents,
  getEventById,
  listOrganizers,
  setFollow,
  createCollabLead,
  listAdminUsers,
  saveEvent,
  deleteEvent,
  listVenues,
  getVenueById,
  saveVenue,
  deleteVenue,
  listAdminBookings,
  listCollabLeads,
  createAdminSession,
  getAdminSession,
  deleteAdminSession
} = require('./database');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});



app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.status(200).json({ ok: true, service: 'pubscene' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.get('/api/events', (req, res) => {
  try {
    const events = listEvents({
      category: req.query.category,
      area: req.query.area,
      q: typeof req.query.q === 'string' ? req.query.q.trim() : ''
    });
    res.json({ total: events.length, events });
  } catch (err) {
    console.error('Error listing events:', err);
    res.status(500).json({ error: 'Could not load events' });
  }
});

app.get('/api/organizers', (req, res) => {
  try {
    const organizers = listOrganizers(req.query.clientId);
    res.json({ organizers });
  } catch (err) {
    console.error('Error listing organizers:', err);
    res.status(500).json({ error: 'Could not load organizers' });
  }
});

app.post('/api/follows', (req, res) => {
  try {
    const { organizerId, clientId, following } = req.body || {};
    if (!organizerId || !clientId) {
      return res.status(400).json({ error: 'Organizer and client id are required' });
    }
    const result = setFollow(organizerId, String(clientId), !!following);
    if (!result) return res.status(404).json({ error: 'Organizer not found' });
    res.json(result);
  } catch (err) {
    console.error('Error updating follow:', err);
    res.status(500).json({ error: 'Could not update follow' });
  }
});

app.post('/api/collab', (req, res) => {
  try {
    const { fullName, phone, email, message } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!fullName || !String(fullName).trim() || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Name and a valid phone number are required' });
    }
    const lead = createCollabLead({
      fullName: String(fullName).trim(),
      phone: cleanPhone,
      email: email ? String(email).trim() : '',
      message: message ? String(message).trim() : ''
    });
    res.status(201).json({ ...lead, message: 'Collaboration request received' });
  } catch (err) {
    console.error('Error saving collab lead:', err);
    res.status(500).json({ error: 'Could not save collaboration request' });
  }
});

app.post('/api/create-pass-order', async (req, res) => {
  try {
    const { user, booking } = req.body || {};

    const fullName = String(user && user.fullName || '').trim();
    const phone = String(user && user.phone || '').replace(/\D/g, '');
    const instagram = String(user && user.instagram || '').trim().replace(/^@+/, '');
    const email = String(user && user.email || '').trim();
    const age = parseInt(user && user.age, 10);
    if (!fullName) {
      return res.status(400).json({ error: 'Enter your name' });
    }
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return res.status(400).json({ error: 'Enter your age' });
    }
    if (phone && phone.length < 10) {
      return res.status(400).json({ error: 'Enter a valid mobile number' });
    }
    if (!phone && !instagram) {
      return res.status(400).json({ error: 'Add a mobile number or Instagram' });
    }
    user.fullName = fullName;
    user.phone = phone;
    user.instagram = instagram;
    user.email = email;
    user.age = age;
    if (!booking || !booking.venueId) {
      return res.status(400).json({ error: 'Choose an event before booking a pass' });
    }

    const event = getEventById(booking.venueId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.lastBookingDate) {
      const today = new Date().toISOString().split('T')[0];
      if (today > event.lastBookingDate) {
        return res.status(400).json({ error: 'Booking is closed for this event' });
      }
    }

    const couplePasses = Math.max(0, parseInt(booking.couplePasses, 10) || 0);
    const stagPasses = Math.max(0, parseInt(booking.stagPasses, 10) || 0);
    const totalSelected = booking.totalPasses != null ? parseInt(booking.totalPasses, 10) : (couplePasses + stagPasses);
    if (totalSelected < 1 && couplePasses + stagPasses < 1) {
      return res.status(400).json({ error: 'Choose at least one pass' });
    }

    const userId = await saveOrGetUser(user);
    const passCode = 'PUB-' + Math.floor(100000 + Math.random() * 900000);
    const passesSummary = String(booking.passesSummary || '').trim() || (couplePasses > 0 || stagPasses > 0 ? `Couple: ${couplePasses}, Stag: ${stagPasses}` : '1 Pass');

    const savedPass = await createBooking({
      userId,
      venueId: event.id,
      venueName: event.name,
      couplePasses,
      stagPasses,
      totalAmount: 0,
      razorpayOrderId: null,
      passCode,
      status: 'CONFIRMED',
      passesSummary
    });

    return res.status(200).json({
      success: true,
      passCode: savedPass.passCode,
      venueName: event.name,
      message: 'Digital entry pass confirmed successfully'
    });
  } catch (err) {
    console.error('Error creating pass:', err);
    res.status(500).json({ error: 'Could not create the entry pass' });
  }
});

const AREAS = {
  raasta: 'Raasta',
  dharampeth: 'Dharampeth',
  civil_lines: 'Civil Lines',
  wardha_rd: 'Wardha Road',
  sadar: 'Sadar',
  nagpur: 'Nagpur',
  mumbai: 'Mumbai',
  goa: 'Goa',
  pune: 'Pune',
  bengaluru: 'Bengaluru'
};

const CATEGORIES = new Set(['concerts', 'club_nights', 'comedy', 'jamming', 'open_mics', 'live_gigs', 'dj_sets', 'stand_up']);

function adminToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function requireAdmin(req, res, next) {
  try {
    const session = getAdminSession(adminToken(req));
    if (!session) return res.status(401).json({ error: 'Please log in again' });
    return next();
  } catch (err) {
    console.error('Admin session check failed:', err);
    return res.status(401).json({ error: 'Please log in again' });
  }
}

function saveFlyerFile(dataUrl, id) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return '';
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error('Use a JPG, PNG, or WEBP flyer');
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    throw new Error('Flyer must be under 8 MB');
  }
  const dir = path.join(__dirname, '..', 'frontend', 'assets', 'flyers');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/assets/flyers/${filename}`;
}

app.post('/api/admin/login', (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    const expectedUser = process.env.ADMIN_USERNAME || '';
    const expectedPass = process.env.ADMIN_PASSWORD || '';
    if (!expectedUser || !expectedPass) {
      return res.status(503).json({ error: 'Owner login is not configured' });
    }
    const userOk = username.length === expectedUser.length && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
    const passOk = password.length === expectedPass.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));
    if (!userOk || !passOk) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }
    const token = createAdminSession();
    return res.json({ token });
  } catch (err) {
    console.error('Admin login failed:', err);
    return res.status(401).json({ error: 'Wrong username or password' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  try {
    deleteAdminSession(adminToken(req));
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin logout failed:', err);
    res.json({ ok: true });
  }
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  try {
    res.json({
      events: listEvents(),
      bookings: listAdminBookings(),
      leads: listCollabLeads()
    });
  } catch (err) {
    console.error('Admin overview failed:', err);
    res.status(500).json({ error: 'Could not load the admin panel' });
  }
});

app.post('/api/admin/events', requireAdmin, (req, res) => {
  try {
    const saved = upsertAdminEvent(req.body || {}, '');
    res.status(201).json(saved);
  } catch (err) {
    console.error('Create event failed:', err);
    res.status(400).json({ error: err.message || 'Could not save the flyer' });
  }
});

app.post('/api/public/events', (req, res) => {
  try {
    const saved = upsertAdminEvent(req.body || {}, '');
    res.status(201).json(saved);
  } catch (err) {
    console.error('Create public event failed:', err);
    res.status(400).json({ error: err.message || 'Could not save the flyer' });
  }
});

app.put('/api/admin/events/:id', requireAdmin, (req, res) => {
  try {
    const existing = getEventById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Flyer not found' });
    const saved = upsertAdminEvent(req.body || {}, req.params.id, existing);
    res.json(saved);
  } catch (err) {
    console.error('Update event failed:', err);
    res.status(400).json({ error: err.message || 'Could not update the flyer' });
  }
});

app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
  try {
    const removed = deleteEvent(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Flyer not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete event failed:', err);
    res.status(500).json({ error: 'Could not remove the flyer' });
  }
});

function upsertAdminEvent(body, forcedId, existing) {
  const name = String(body.name || '').trim();
  const venueName = String(body.venueName || '').trim();
  const date = String(body.date || '').trim();
  const areaId = String(body.areaId || '').trim();
  const category = String(body.category || '').trim();
  if (!name || !venueName || !date) {
    throw new Error('Name, venue, and date are required');
  }
  if (!AREAS[areaId]) throw new Error('Choose an area');
  if (!CATEGORIES.has(category)) throw new Error('Choose a category');

  const id = forcedId || ('evt-' + Date.now().toString(36));
  let image = existing ? existing.image : '';
  if (body.imageData) {
    image = saveFlyerFile(body.imageData, id);
  }
  if (!image) throw new Error('Add the original flyer image');

  return saveEvent({
    id,
    name,
    venueName,
    areaId,
    areaName: AREAS[areaId],
    category,
    date,
    couplePrice: body.couplePrice,
    coverPrice: body.stagPrice,
    pass1Title: body.pass1Title ? String(body.pass1Title).trim() : 'Couple pass',
    pass1Desc: body.pass1Desc ? String(body.pass1Desc).trim() : 'Entry for 2',
    pass2Title: body.pass2Title ? String(body.pass2Title).trim() : 'Stag pass',
    pass2Desc: body.pass2Desc ? String(body.pass2Desc).trim() : 'Single entry',
    tickets: body.tickets,
    offerText: String(body.offerText || '').trim(),
    image,
    badge: String(body.badge || '').trim(),
    lastBookingDate: body.lastBookingDate ? String(body.lastBookingDate).trim() : null
  });
}

app.get('/api/venues', (req, res) => {
  try {
    const venues = listVenues();
    res.json(venues);
  } catch (err) {
    console.error('List venues failed:', err);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

function upsertAdminVenue(body, venueId) {
  const name = String(body.name || '').trim();
  const location = String(body.location || '').trim();
  if (!name || !location) throw new Error('Name and location are required');

  const id = venueId || ('ven-' + Date.now().toString(36));

  let cover = body.coverImage || '';
  if (body.coverImageData && body.coverImageData.startsWith('data:image')) {
    cover = saveFlyerFile(body.coverImageData, id + '-cov-' + Date.now().toString(36));
  }

  let logo = body.logoImage || '';
  if (body.logoImageData && body.logoImageData.startsWith('data:image')) {
    logo = saveFlyerFile(body.logoImageData, id + '-logo-' + Date.now().toString(36));
  }

  saveVenue(id, name, location, cover, logo);
  return getVenueById(id);
}

app.post('/api/admin/venues', requireAdmin, (req, res) => {
  try {
    const saved = upsertAdminVenue(req.body || {}, '');
    res.status(201).json(saved);
  } catch (err) {
    console.error('Create venue failed:', err);
    res.status(400).json({ error: err.message || 'Could not save venue' });
  }
});

app.put('/api/admin/venues/:id', requireAdmin, (req, res) => {
  try {
    const existing = getVenueById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Venue not found' });
    
    // Merge existing images if not provided
    req.body.coverImage = req.body.coverImage || existing.cover_image;
    req.body.logoImage = req.body.logoImage || existing.logo_image;

    const saved = upsertAdminVenue(req.body, req.params.id);
    res.json(saved);
  } catch (err) {
    console.error('Update venue failed:', err);
    res.status(400).json({ error: err.message || 'Could not save venue' });
  }
});

app.delete('/api/admin/venues/:id', requireAdmin, (req, res) => {
  try {
    deleteVenue(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete venue failed:', err);
    res.status(500).json({ error: 'Could not delete venue' });
  }
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  try {
    const users = listAdminUsers();
    res.status(200).json({ total: users.length, users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Could not load users' });
  }
});

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir, {
  index: 'index.html',
  fallthrough: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexFile = path.join(frontendDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(404).send('Frontend is missing');
  }
  return res.sendFile(indexFile);
});

app.use((err, req, res, _next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal Server Error' });
});

function listenOn(port) {
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0');
    const onListening = () => {
      cleanup();
      server.keepAliveTimeout = 65000;
      server.headersTimeout = 66000;
      server.requestTimeout = 30000;
      server.on('clientError', (err, socket) => {
        console.error(`Client error on port ${port}:`, err.message);
        if (socket && socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      });
      console.log(`PUB SCENE listening on 0.0.0.0:${port}`);
      resolve(server);
    };
    const onError = (err) => {
      cleanup();
      console.error(`Port ${port} is not available (${err.code || err.message}). Continuing.`);
      resolve(null);
    };
    const cleanup = () => {
      server.removeListener('listening', onListening);
      server.removeListener('error', onError);
    };
    server.once('listening', onListening);
    server.once('error', onError);
  });
}

async function start() {
  const configured = Number(process.env.PORT) || 5000;
  const ports = [];
  if (process.getuid && process.getuid() === 0) {
    ports.push(80);
  }
  if (!ports.includes(configured)) {
    ports.push(configured);
  }

  const servers = [];
  for (const port of ports) {
    const server = await listenOn(port);
    if (server) servers.push(server);
  }

  if (!servers.length) {
    console.error('No port could be bound. Exiting so the process manager can retry.');
    process.exit(1);
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Closing listeners.`);
    let pending = servers.length;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        closeDatabase();
        process.exit(0);
      }
    };
    servers.forEach((server) => server.close(finish));
    setTimeout(() => {
      closeDatabase();
      process.exit(0);
    }, 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (process kept alive):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (process kept alive):', err);
});

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
