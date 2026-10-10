const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  db,
  closeDatabase,
  saveOrGetUser,
  createBooking,
  updateBookingPayment,
  listEvents,
  getEventById,
  listOrganizers,
  setFollow,
  createCollabLead,
  listAdminUsers,
  saveEvent,
  deleteEvent,
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
app.use(express.json({
  limit: '12mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/razorpay-webhook')) {
      req.rawBody = buf;
    }
  }
}));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

function createRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.warn('Razorpay keys are missing. Paid checkout stays disabled.');
    return null;
  }
  try {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (err) {
    console.error('Razorpay client failed to start. Paid checkout stays disabled:', err.message);
    return null;
  }
}

let razorpay = createRazorpay();

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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
    user.age = age;
    if (!booking || !booking.venueId) {
      return res.status(400).json({ error: 'Choose an event before booking a pass' });
    }

    const event = getEventById(booking.venueId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const couplePasses = Math.max(0, parseInt(booking.couplePasses, 10) || 0);
    const stagPasses = Math.max(0, parseInt(booking.stagPasses, 10) || 0);
    if (couplePasses + stagPasses < 1) {
      return res.status(400).json({ error: 'Choose at least one pass' });
    }

    const couplePrice = Math.max(0, Number(event.couplePrice) || 0);
    const stagPrice = Math.max(0, Number(event.coverPrice) || 0);
    const amount = couplePasses * couplePrice + stagPasses * stagPrice;
    const userId = await saveOrGetUser(user);
    const passCode = 'PUB-' + Math.floor(100000 + Math.random() * 900000);

    if (amount === 0) {
      const savedPass = await createBooking({
        userId,
        venueId: event.id,
        venueName: event.name,
        couplePasses,
        stagPasses,
        totalAmount: 0,
        razorpayOrderId: 'FREE_ENTRY_' + Date.now(),
        passCode,
        status: 'FREE_CONFIRMED'
      });

      return res.status(200).json({
        isFree: true,
        passCode: savedPass.passCode,
        venueName: event.name,
        message: 'Free entry pass generated successfully'
      });
    }

    if (!razorpay) {
      razorpay = createRazorpay();
    }
    if (!razorpay) {
      return res.status(503).json({ error: 'Paid checkout is not configured' });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${passCode}`,
      notes: {
        userId: userId.toString(),
        venue: event.name,
        phone: user.phone || user.instagram
      }
    };

    const order = await withTimeout(
      razorpay.orders.create(options),
      15000,
      'Razorpay order'
    );

    await createBooking({
      userId,
      venueId: event.id,
      venueName: event.name,
      couplePasses,
      stagPasses,
      totalAmount: amount,
      razorpayOrderId: order.id,
      passCode,
      status: 'PENDING'
    });

    res.status(200).json({
      isFree: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      passCode,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating pass order:', err);
    res.status(500).json({ error: 'Could not create the pass order' });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, passCode } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ status: 'failure', message: 'Payment details are incomplete' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ status: 'failure', message: 'Payment verification is not configured' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'SUCCESS');
      return res.status(200).json({ status: 'success', message: 'Payment verified', passCode });
    }

    await updateBookingPayment(razorpay_order_id, razorpay_payment_id, 'FAILED_SIGNATURE');
    return res.status(400).json({ status: 'failure', message: 'Signature verification failed' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ status: 'failure', message: 'Could not verify payment' });
  }
});

app.post('/api/razorpay-webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-razorpay-signature'];
    if (!webhookSecret || !webhookSignature || !req.rawBody) {
      return res.status(400).json({ status: 'invalid_signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== webhookSignature) {
      console.warn('Webhook signature mismatch. Dropping request.');
      return res.status(400).json({ status: 'invalid_signature' });
    }

    const event = req.body && req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload && req.body.payload.payment && req.body.payload.payment.entity;
      if (paymentEntity && paymentEntity.order_id && paymentEntity.id) {
        await updateBookingPayment(paymentEntity.order_id, paymentEntity.id, 'SUCCESS_WEBHOOK');
        console.log(`[Webhook Confirmed] Order ${paymentEntity.order_id} marked as SUCCESS.`);
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook could not be processed' });
  }
});

const AREAS = {
  raasta: 'Raasta',
  dharampeth: 'Dharampeth',
  civil_lines: 'Civil Lines',
  wardha_rd: 'Wardha Road',
  sadar: 'Sadar'
};

const CATEGORIES = new Set(['concerts', 'club_nights', 'comedy', 'jamming']);

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
    offerText: String(body.offerText || '').trim(),
    image,
    badge: String(body.badge || '').trim()
  });
}

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
  [80, configured].forEach((port) => {
    if (Number.isInteger(port) && port > 0 && port < 65536 && !ports.includes(port)) {
      ports.push(port);
    }
  });

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
