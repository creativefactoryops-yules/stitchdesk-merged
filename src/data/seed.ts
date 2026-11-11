/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// Demo data for "Maple Upholstery (demo)". Every price here is a made-up DEMO rate,
// shown only so the app can be tried. A real shop sets its own in Settings.
import type { ChatTurn, FaqEntry, ShopRates } from '../../shared/types';
import type { Booking, Client, Job, Message, Photo, Quote, Shop, Supplier, Swatch } from './models';
import { newToken } from './store';

export interface DemoDb {
  version: 2;
  shop: Shop;
  swatches: Swatch[];
  suppliers: Supplier[];
  clients: Client[];
  jobs: Job[];
  photos: Photo[];
  quotes: Quote[];
  messages: Message[];
  bookings: Booking[];
  faq: FaqEntry[];
}

export const DEMO_SLUG = 'maple-demo';

export const DEFAULT_RATES: ShopRates = {
  fabricLowPerYd: 30,
  fabricHighPerYd: 90,
  labour: {
    sofa: 650, loveseat: 520, sectional: 1100, armchair: 380, wingback: 450, ottoman: 180,
    dining_chair: 75, headboard: 260, bench: 200, car_seat: 220, boat_cushion: 120,
  },
  foamHr: 180,
  foamStandard: 120,
  supplies: 60,
};

const iso = (d: Date) => d.toISOString();
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
};

export function seedDemo(): DemoDb {
  const now = new Date();
  const shop: Shop = {
    id: 'shop-demo',
    slug: DEMO_SLUG,
    name: 'Maple Upholstery (demo)',
    city: 'Toronto',
    hours: 'Tue to Sat, 10am to 6pm (demo hours)',
    etransferEmail: 'deposits@maple-demo.example',
    logoUrl: null,
    rates: DEFAULT_RATES,
    depositPercent: 30,
    trialStartedAt: iso(new Date(now.getTime() - 3 * 86400000)),
    plan: 'trial',
  };

  const sw = (name: string, material: string, colour: string, hex: string, price: number | null, code: string, rubs: number | null): Swatch => ({
    id: 'sw-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name, material, colour, hex, pricePerYd: price, cleaningCode: code, doubleRubs: rubs, imageUrl: null, inStock: true,
  });
  const swatches: Swatch[] = [
    sw('Moss Velvet', 'Velvet', 'Moss green', '#4f6b2a', 62, 'S', 50000),
    sw('Midnight Velvet', 'Velvet', 'Navy', '#1d2a4d', 62, 'S', 50000),
    sw('Oat Boucle', 'Boucle', 'Oatmeal', '#d8cdb8', 74, 'S', 30000),
    sw('Harbour Linen', 'Linen blend', 'Stone grey', '#8d8a82', 48, 'W/S', 25000),
    sw('Rust Chenille', 'Chenille', 'Rust', '#a4502a', 44, 'W/S', 40000),
    sw('Cognac Leather', 'Leather', 'Cognac', '#8a4b1f', null, 'Leather care', null),
    sw('Charcoal Performance', 'Performance', 'Charcoal', '#3a3d40', 56, 'W', 100000),
    sw('Sail Marine Vinyl', 'Marine vinyl', 'White', '#f2f0ea', 38, 'W', 250000),
    sw('Tartan Wool', 'Wool', 'Red plaid', '#7c1f22', 85, 'S', 35000),
  ];

  const sup = (name: string, category: string, address: string): Supplier => ({
    id: 'sup-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name, category, phone: '', email: '', website: '', address,
    notes: 'Placeholder. Verify name, contact and stock before relying on it.',
    verified: false,
  });
  const suppliers: Supplier[] = [
    sup('King Textiles', 'Fabric, vinyl, leather', 'Spadina Ave, Toronto (verify)'),
    sup('Neverens Fabric', 'Fabric', 'Queen St W, Toronto (verify)'),
    sup('Johnny Sewing Machine', 'Machines and service', 'Queen St W, Toronto (verify)'),
    sup('Difab Foam', 'Foam and Dacron', 'Brampton (verify)'),
    sup('Greenberg Fabrics', 'Commercial vinyl', 'Toronto (verify)'),
    sup('Trim & Tassel', 'Trim and nailheads', 'Toronto (verify)'),
  ];

  const mk = (name: string, email: string | null, phone: string | null, notes = ''): Client => ({
    id: 'cl-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, email, phone, notes, createdAt: iso(now),
  });
  const rosa = mk('Rosa M. (demo)', 'rosa@example.com', null, "Grandmother's loveseat, sentimental. Wants it back for the holidays.");
  const dev = mk('Dev P. (demo)', null, '416-555-0142');
  const amira = mk('Amira K. (demo)', 'amira@example.com', '647-555-0199');
  const clients = [rosa, dev, amira];

  const transcript: ChatTurn[] = [
    { role: 'user', text: "Hi, I have my grandma's loveseat, the springs sag." },
    { role: 'stitch', text: "Hi, I'm Stitch at Maple Upholstery. Sagging springs on an old loveseat are very fixable. How wide is it, side to side?" },
    { role: 'user', text: 'About 60 inches wide and 32 deep.' },
  ];
  const job = (p: Partial<Job> & Pick<Job, 'id' | 'clientId' | 'stage' | 'title'>): Job => ({
    token: newToken(), piece: null, width: null, depth: null, height: null, units: 'in', fabric: null, notes: '',
    estimateLow: null, estimateHigh: null, dropoffDate: null, pickupDate: null, transcript: [], renders: [],
    createdAt: iso(now), updatedAt: iso(now), ...p,
  });
  const jobs: Job[] = [
    job({ id: 'job-1', clientId: rosa.id, stage: 'in_progress', title: 'Loveseat for Rosa M.', piece: 'loveseat', width: 60, depth: 32, height: 34, fabric: 'moss velvet', notes: 'Springs sag. Re-tie and new HR foam.', dropoffDate: day(-6), pickupDate: day(9), transcript }),
    job({ id: 'job-2', clientId: dev.id, stage: 'lead', title: 'Armchair for Dev P.', piece: 'armchair', width: 32, depth: 34, fabric: 'charcoal performance', dropoffDate: day(0), estimateLow: 1050, estimateHigh: 1420 }),
    job({ id: 'job-3', clientId: amira.id, stage: 'ready', title: 'Dining chair seats x6 for Amira K.', piece: 'dining_chair', width: 20, depth: 18, fabric: 'sail marine vinyl', pickupDate: day(0) }),
    job({ id: 'job-4', clientId: amira.id, stage: 'picked_up', title: 'Ottoman for Amira K.', piece: 'ottoman', width: 30, depth: 20, height: 17, fabric: 'rust chenille', pickupDate: day(-1) }),
  ];

  const quotes: Quote[] = [
    { id: 'q-1', jobId: 'job-4', yards: 2.5, fabricName: 'Rust Chenille', fabricPerYd: 44, labour: 180, foam: 54, supplies: 25, discount: 0, subtotal: 369, hst: 47.97, total: 416.97, notes: 'Valid 30 days.', sentAt: iso(now), createdAt: iso(now) },
    { id: 'q-2', jobId: 'job-1', yards: 10, fabricName: 'Moss Velvet', fabricPerYd: 62, labour: 520, foam: 144, supplies: 48, discount: 0, subtotal: 1332, hst: 173.16, total: 1505.16, notes: 'Valid 30 days. Includes re-tying springs.', sentAt: iso(now), createdAt: iso(now) },
  ];
  const messages: Message[] = [
    { id: 'm-1', jobId: 'job-1', sender: 'shop', body: 'Springs are re-tied. Starting the velvet this week.', createdAt: iso(now) },
  ];
  const photos: Photo[] = [];
  const bookings: Booking[] = [
    { id: 'b-1', jobId: 'job-2', clientId: dev.id, preferredDates: [day(0), day(2)], contactMethod: 'phone', message: 'Can drop off after work.', status: 'confirmed', createdAt: iso(now) },
  ];
  const faq: FaqEntry[] = [
    { id: 'faq-1', question: 'Do you offer pickup and delivery?', answer: 'Yes, inside Toronto. The shop quotes it with the job. (demo answer)' },
    { id: 'faq-2', question: 'How long does a sofa take?', answer: 'Usually 2 to 3 weeks after the fabric arrives. (demo answer)' },
  ];
  return { version: 2, shop, swatches, suppliers, clients, jobs, photos, quotes, messages, bookings, faq };
}
