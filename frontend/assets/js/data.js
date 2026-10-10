// Nagpur localities used by the city filter.
const localities = [
  { id: 'all', name: 'All Areas' },
  { id: 'dharampeth', name: 'Dharampeth' },
  { id: 'civil_lines', name: 'Civil Lines' },
  { id: 'wardha_rd', name: 'Wardha Road' },
  { id: 'sadar', name: 'Sadar' },
  { id: 'raasta', name: 'Raasta' }
];

// Fallback catalog if the API is unreachable. The server seeds the same records.
const eventsData = [
  {
    id: 'city-showdown',
    name: 'City Showdown ft. Shubz',
    venueName: 'Raasta, Nagpur',
    areaId: 'raasta',
    areaName: 'Raasta',
    category: 'club_nights',
    date: 'Sat, 12 Sep • 8:00 PM',
    price: 499,
    couplePrice: 499,
    coverPrice: 999,
    offerText: 'Bollywood, Bolly-tech and commercial. Also featuring Squadout and DJ Vicky.',
    image: 'assets/flyers/city-showdown.jpg',
    badge: 'SHUBZ'
  },
  {
    id: 'night-to-remember',
    name: 'Night To Remember ft. Hamshyre',
    venueName: 'Raasta, Nagpur',
    areaId: 'raasta',
    areaName: 'Raasta',
    category: 'club_nights',
    date: 'Sun, 4 Oct • 8:00 PM',
    price: 499,
    couplePrice: 499,
    coverPrice: 999,
    offerText: 'A night to remember at Raasta.',
    image: 'assets/flyers/night-to-remember.jpg',
    badge: 'HAMSHYRE'
  },
  {
    id: 'shanivaar',
    name: 'Shanivaar ft. Neel Chhabra',
    venueName: 'Raasta, Nagpur',
    areaId: 'raasta',
    areaName: 'Raasta',
    category: 'club_nights',
    date: 'Sat, 26 Sep • 9:00 PM',
    price: 499,
    couplePrice: 499,
    coverPrice: 999,
    offerText: 'Also featuring Squadout and Vicky.',
    image: 'assets/flyers/shanivaar.jpg',
    badge: 'NEEL CHHABRA'
  }
];

const eventCatalog = eventsData.slice();

function findEventById(id) {
  return eventCatalog.find((event) => event.id === id);
}

function rememberEvents(list) {
  list.forEach((event) => {
    const index = eventCatalog.findIndex((item) => item.id === event.id);
    if (index >= 0) eventCatalog[index] = event;
    else eventCatalog.push(event);
  });
}

const venuesDirectory = [
  {
    id: 'org-1',
    name: 'The Vibe Club',
    verified: true,
    location: 'Dharampeth, Nagpur',
    rating: '★ 5.0',
    desc: 'Curating exclusive underground techno sessions & rooftop electronic jams.',
    tag: 'VIBE'
  },
  {
    id: 'org-2',
    name: 'Common Ground Club',
    verified: true,
    location: 'Civil Lines, Nagpur',
    rating: '★ 4.9',
    desc: 'A space for music, community jams, dance, and weekend nightlife vibes.',
    tag: 'CGC'
  },
  {
    id: 'org-3',
    name: 'Nine O Nine Lounge',
    verified: true,
    location: 'Wardha Road, Nagpur',
    rating: '★ 4.8',
    desc: 'Premier multi-genre dance floor, craft beer & high-energy weekend DJ nights.',
    tag: '909'
  }
];
