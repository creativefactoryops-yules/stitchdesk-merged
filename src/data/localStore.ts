/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// DEMO MODE backend: everything lives in this browser's localStorage. No server, no accounts.
import { quoteTotals } from '../../shared/estimator';
import { pieceById } from '../../shared/estimator';
import type { FaqEntry } from '../../shared/types';
import type { Client, Job, JobView, Photo, Quote, Shop, Supplier, Swatch } from './models';
import { seedDemo, type DemoDb } from './seed';
import { newId, newToken, type DataStore, type QuoteDraft } from './store';

const KEY = 'stitch_demo_db_v2';
const SESSION_KEY = 'stitch_demo_staff';

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DemoDb;
      if (db.version === 2) return db;
    }
  } catch {
    /* fall through to seed */
  }
  const db = seedDemo();
  save(db);
  return db;
}

function save(db: DemoDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    // Usually the 5 MB browser limit, from photos.
    throw new Error('This browser is out of demo storage. Remove some photos or reset the demo in Settings.');
  }
}

const listeners = new Set<() => void>();
const now = () => new Date().toISOString();

function mutate<T>(fn: (db: DemoDb) => T): T {
  const db = load();
  const out = fn(db);
  save(db);
  return out;
}

export function resetDemo() {
  localStorage.removeItem(KEY);
  load();
}

export const localStore: DataStore = {
  mode: 'demo',

  async getPublicShop(slug) {
    const db = load();
    if (db.shop.slug !== slug.toLowerCase()) return null;
    return { shop: db.shop, swatches: db.swatches, faq: db.faq };
  },

  async createBooking(slug, input) {
    return mutate((db) => {
      if (db.shop.slug !== slug) throw new Error('Shop not found');
      if (!input.name.trim()) throw new Error('Name is required');
      if (!input.email.trim() && !input.phone.trim()) throw new Error('Email or phone is required');
      const client: Client = {
        id: newId(), name: input.name.trim(), email: input.email.trim() || null, phone: input.phone.trim() || null,
        notes: '', createdAt: now(),
      };
      const s = input.sheet;
      const job: Job = {
        id: newId(), clientId: client.id, token: newToken(), stage: 'lead',
        title: `${s.piece ? pieceById(s.piece).label : 'Piece'} for ${client.name}`,
        piece: s.piece, width: s.width, depth: s.depth, height: s.height, units: s.units, fabric: s.fabric,
        notes: [input.message, ...s.notes].filter(Boolean).join('\n'),
        estimateLow: input.estimateLow, estimateHigh: input.estimateHigh, dropoffDate: null, pickupDate: null,
        transcript: input.transcript, renders: input.renders, createdAt: now(), updatedAt: now(),
      };
      db.clients.push(client);
      db.jobs.push(job);
      db.bookings.push({
        id: newId(), jobId: job.id, clientId: client.id, preferredDates: input.preferredDates.filter(Boolean),
        contactMethod: input.contactMethod, message: input.message, status: 'requested', createdAt: now(),
      });
      if (input.beforePhoto) {
        db.photos.push({ id: newId(), jobId: job.id, url: input.beforePhoto, kind: 'before', caption: 'Uploaded by client', createdAt: now() });
      }
      return { token: job.token };
    });
  },

  async getJobByToken(token): Promise<JobView | null> {
    const db = load();
    const job = db.jobs.find((j) => j.token === token);
    if (!job) return null;
    const quote = db.quotes.filter((q) => q.jobId === job.id && q.sentAt).sort((a, b) => (b.sentAt! > a.sentAt! ? 1 : -1))[0] ?? null;
    return {
      job,
      shop: db.shop,
      clientName: db.clients.find((c) => c.id === job.clientId)?.name ?? null,
      photos: db.photos.filter((p) => p.jobId === job.id),
      quote,
      messages: db.messages.filter((m) => m.jobId === job.id),
    };
  },

  async addClientMessage(token, body) {
    mutate((db) => {
      const job = db.jobs.find((j) => j.token === token);
      if (!job) throw new Error('Job not found');
      db.messages.push({ id: newId(), jobId: job.id, sender: 'client', body: body.trim().slice(0, 4000), createdAt: now() });
    });
  },

  async getSession() {
    // Demo mode signs you in as demo staff automatically, unless you signed out.
    return localStorage.getItem(SESSION_KEY) === 'out' ? null : { email: 'staff@maple-demo.example', demo: true };
  },
  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async signIn() {
    localStorage.removeItem(SESSION_KEY);
    listeners.forEach((l) => l());
  },
  async signOut() {
    localStorage.setItem(SESSION_KEY, 'out');
    listeners.forEach((l) => l());
  },
  async myShop() {
    return load().shop;
  },
  async createShop() {
    return load().shop;
  },
  async updateShop(patch) {
    return mutate((db) => {
      db.shop = { ...db.shop, ...patch, id: db.shop.id } as Shop;
      return db.shop;
    });
  },
  async inviteStaff() {
    throw new Error('Inviting staff needs the real database (Supabase). It is off in demo mode.');
  },

  async listJobs() {
    return load().jobs;
  },
  async updateJob(id, patch) {
    return mutate((db) => {
      const i = db.jobs.findIndex((j) => j.id === id);
      if (i < 0) throw new Error('Job not found');
      db.jobs[i] = { ...db.jobs[i], ...patch, id, updatedAt: now() };
      return db.jobs[i];
    });
  },
  async listClients() {
    return load().clients;
  },
  async updateClient(id, patch) {
    return mutate((db) => {
      const i = db.clients.findIndex((c) => c.id === id);
      db.clients[i] = { ...db.clients[i], ...patch, id };
      return db.clients[i];
    });
  },
  async listBookings() {
    return load().bookings;
  },
  async listPhotos(jobId) {
    return load().photos.filter((p) => p.jobId === jobId);
  },
  async addPhoto(jobId, dataUrl, kind, caption) {
    return mutate((db) => {
      const p: Photo = { id: newId(), jobId, url: dataUrl, kind, caption, createdAt: now() };
      db.photos.push(p);
      return p;
    });
  },
  async listQuotes(jobId) {
    const q = load().quotes;
    return jobId ? q.filter((x) => x.jobId === jobId) : q;
  },
  async saveQuote(jobId, d: QuoteDraft, send) {
    return mutate((db) => {
      const t = quoteTotals(d);
      const q: Quote = {
        id: newId(), jobId, ...d, subtotal: t.subtotal, hst: t.hst, total: t.total,
        sentAt: send ? now() : null, createdAt: now(),
      };
      db.quotes.push(q);
      if (send) {
        const job = db.jobs.find((j) => j.id === jobId);
        if (job && job.stage === 'lead') job.stage = 'quoted';
        db.messages.push({ id: newId(), jobId, sender: 'shop', body: `Your quote is ready: ${t.total.toFixed(2)} CAD including HST.`, createdAt: now() });
      }
      return q;
    });
  },
  async listMessages(jobId) {
    return load().messages.filter((m) => m.jobId === jobId);
  },
  async addShopMessage(jobId, body) {
    return mutate((db) => {
      const m = { id: newId(), jobId, sender: 'shop' as const, body: body.trim(), createdAt: now() };
      db.messages.push(m);
      return m;
    });
  },
  async listSuppliers() {
    return load().suppliers;
  },
  async saveSupplier(s: Supplier) {
    return mutate((db) => {
      const item = { ...s, id: s.id || newId() };
      const i = db.suppliers.findIndex((x) => x.id === item.id);
      if (i >= 0) db.suppliers[i] = item;
      else db.suppliers.push(item);
      return item;
    });
  },
  async deleteSupplier(id) {
    mutate((db) => void (db.suppliers = db.suppliers.filter((s) => s.id !== id)));
  },
  async listSwatches() {
    return load().swatches;
  },
  async saveSwatch(s: Swatch) {
    return mutate((db) => {
      const item = { ...s, id: s.id || newId() };
      const i = db.swatches.findIndex((x) => x.id === item.id);
      if (i >= 0) db.swatches[i] = item;
      else db.swatches.push(item);
      return item;
    });
  },
  async deleteSwatch(id) {
    mutate((db) => void (db.swatches = db.swatches.filter((s) => s.id !== id)));
  },
  async listFaq() {
    return load().faq;
  },
  async saveFaq(f: FaqEntry) {
    return mutate((db) => {
      const item = { ...f, id: f.id || newId() };
      const i = db.faq.findIndex((x) => x.id === item.id);
      if (i >= 0) db.faq[i] = item;
      else db.faq.push(item);
      return item;
    });
  },
  async deleteFaq(id) {
    mutate((db) => void (db.faq = db.faq.filter((f) => f.id !== id)));
  },
};
