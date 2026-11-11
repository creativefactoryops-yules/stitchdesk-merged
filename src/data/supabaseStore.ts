/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// REAL backend: Supabase (Postgres + Auth magic link + Storage bucket "photos").
// Row-level security in supabase/schema.sql keeps each shop's data to its own staff.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { quoteTotals } from '../../shared/estimator';
import type { ChatTurn, FaqEntry } from '../../shared/types';
import type { Booking, Client, Job, JobView, Message, Photo, Quote, RenderRef, Shop, Supplier, Swatch } from './models';
import { newId, type DataStore, type QuoteDraft } from './store';
import { DEFAULT_RATES } from './seed';

type Row = Record<string, any>;

const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

const toShop = (r: any): Shop => ({
  id: r.id, slug: r.slug, name: r.name, city: r.city ?? '', hours: r.hours ?? '', etransferEmail: r.etransfer_email ?? '',
  logoUrl: r.logo_url ?? null, rates: { ...DEFAULT_RATES, ...(r.rates ?? {}) }, depositPercent: r.deposit_percent ?? 30,
  trialStartedAt: r.trial_started_at ?? new Date().toISOString(), plan: r.plan ?? 'trial',
});
const toSwatch = (r: any): Swatch => ({
  id: r.id, name: r.name, material: r.material ?? '', colour: r.colour ?? '', hex: r.hex ?? '#888888',
  pricePerYd: num(r.price_per_yd), cleaningCode: r.cleaning_code ?? '', doubleRubs: num(r.double_rubs),
  imageUrl: r.image_url ?? null, inStock: r.in_stock ?? true,
});
const fromSwatch = (s: Swatch) => ({
  name: s.name, material: s.material, colour: s.colour, hex: s.hex, price_per_yd: s.pricePerYd,
  cleaning_code: s.cleaningCode, double_rubs: s.doubleRubs, image_url: s.imageUrl, in_stock: s.inStock,
});
const toJob = (r: any): Job => ({
  id: r.id, clientId: r.client_id ?? null, token: r.token ?? '', stage: r.stage, title: r.title ?? '', piece: r.piece ?? null,
  width: num(r.width), depth: num(r.depth), height: num(r.height), units: r.units ?? null, fabric: r.fabric ?? null,
  notes: r.notes ?? '', estimateLow: num(r.estimate_low), estimateHigh: num(r.estimate_high),
  dropoffDate: r.dropoff_date ?? null, pickupDate: r.pickup_date ?? null,
  transcript: (r.transcript ?? []) as ChatTurn[], renders: (r.renders ?? []) as RenderRef[],
  createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
});
const JOB_COLS: Record<string, string> = {
  stage: 'stage', title: 'title', piece: 'piece', width: 'width', depth: 'depth', height: 'height', units: 'units',
  fabric: 'fabric', notes: 'notes', estimateLow: 'estimate_low', estimateHigh: 'estimate_high',
  dropoffDate: 'dropoff_date', pickupDate: 'pickup_date', renders: 'renders',
};
const toClient = (r: any): Client => ({
  id: r.id, name: r.name, email: r.email ?? null, phone: r.phone ?? null, notes: r.notes ?? '', createdAt: r.created_at,
});
const toPhoto = (r: any): Photo => ({ id: r.id, jobId: r.job_id, url: r.url, kind: r.kind, caption: r.caption ?? '', createdAt: r.created_at });
const toQuote = (r: any): Quote => ({
  id: r.id, jobId: r.job_id, yards: Number(r.yards), fabricName: r.fabric_name ?? '', fabricPerYd: Number(r.fabric_per_yd),
  labour: Number(r.labour), foam: Number(r.foam), supplies: Number(r.supplies), discount: Number(r.discount ?? 0),
  subtotal: Number(r.subtotal), hst: Number(r.hst), total: Number(r.total), notes: r.notes ?? '',
  sentAt: r.sent_at ?? null, createdAt: r.created_at,
});
const toMessage = (r: any): Message => ({ id: r.id, jobId: r.job_id, sender: r.sender, body: r.body, createdAt: r.created_at });
const toSupplier = (r: any): Supplier => ({
  id: r.id, name: r.name, category: r.category ?? '', phone: r.phone ?? '', email: r.email ?? '', website: r.website ?? '',
  address: r.address ?? '', notes: r.notes ?? '', verified: !!r.verified,
});
const toBooking = (r: any): Booking => ({
  id: r.id, jobId: r.job_id, clientId: r.client_id ?? null, preferredDates: r.preferred_dates ?? [],
  contactMethod: r.contact_method ?? '', message: r.message ?? '', status: r.status, createdAt: r.created_at,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function createSupabaseStore(url: string, anonKey: string): DataStore {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  let shopCache: Shop | null = null;

  async function shopId(): Promise<string> {
    if (shopCache) return shopCache.id;
    const s = await store.myShop();
    if (!s) throw new Error('No shop for this account yet');
    return s.id;
  }

  async function upload(shop: string, jobId: string, dataUrl: string): Promise<string> {
    const blob = await dataUrlToBlob(dataUrl);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${shop}/${jobId}/${newId()}.${ext}`;
    check(await sb.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }

  const store: DataStore = {
    mode: 'supabase',

    async getPublicShop(slug) {
      const data = check(await sb.rpc('public_shop', { p_slug: slug.toLowerCase() })) as Row | null;
      if (!data?.shop) return null;
      return {
        shop: toShop({ ...data.shop, trial_started_at: null, plan: 'trial' }),
        swatches: (data.swatches ?? []).map(toSwatch),
        faq: (data.faq ?? []) as FaqEntry[],
      };
    },

    async createBooking(slug, input) {
      // Renders made from an uploaded photo are data URLs: keep them out of the job row, upload after.
      const linkRenders = input.renders.filter((r) => !r.url.startsWith('data:'));
      const dataRenders = input.renders.filter((r) => r.url.startsWith('data:'));
      const res = check(
        await sb.rpc('public_create_booking', {
          p_slug: slug, p_name: input.name, p_email: input.email, p_phone: input.phone,
          p_preferred_dates: input.preferredDates.filter(Boolean), p_contact_method: input.contactMethod,
          p_message: input.message, p_sheet: { ...input.sheet, notes: undefined },
          p_estimate_low: input.estimateLow, p_estimate_high: input.estimateHigh,
          p_transcript: input.transcript.slice(-60), p_renders: linkRenders,
        }),
      ) as { token: string; job_id: string; shop_id: string };
      // Photos are best-effort: the booking already exists if an upload fails.
      const uploads: [string, 'before' | 'render', string][] = [];
      if (input.beforePhoto) uploads.push([input.beforePhoto, 'before', 'Uploaded by client']);
      for (const r of dataRenders) uploads.push([r.url, 'render', r.label]);
      for (const [dataUrl, kind, caption] of uploads) {
        try {
          const publicUrl = await upload(res.shop_id, res.job_id, dataUrl);
          await sb.rpc('public_add_photo', { p_token: res.token, p_url: publicUrl, p_kind: kind, p_caption: caption });
        } catch (e) {
          console.warn('photo upload failed', e);
        }
      }
      return { token: res.token };
    },

    async getJobByToken(token) {
      const d = check(await sb.rpc('public_get_job', { p_token: token })) as Row | null;
      if (!d?.job) return null;
      const view: JobView = {
        job: toJob({ ...d.job, token }),
        shop: {
          name: d.shop.name, slug: d.shop.slug, hours: d.shop.hours ?? '', city: d.shop.city ?? '',
          etransferEmail: d.shop.etransfer_email ?? '', depositPercent: d.shop.deposit_percent ?? 30,
        },
        clientName: d.client_name ?? null,
        photos: (d.photos ?? []).map((p: Row) => toPhoto({ ...p, job_id: d.job.id })),
        quote: d.quote ? toQuote({ ...d.quote, id: 'q', job_id: d.job.id, created_at: d.quote.sent_at }) : null,
        messages: (d.messages ?? []).map((m: Row) => toMessage({ ...m, job_id: d.job.id })),
      };
      return view;
    },

    async addClientMessage(token, body) {
      check(await sb.rpc('public_add_message', { p_token: token, p_body: body }));
    },

    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session?.user?.email ? { email: data.session.user.email, demo: false } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => {
        shopCache = null;
        cb();
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email) {
      check(
        await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/shop` },
        }),
      );
    },
    async signOut() {
      shopCache = null;
      await sb.auth.signOut();
    },
    async myShop() {
      const id = check(await sb.rpc('my_shop')) as string | null;
      if (!id) return null;
      const row = check(await sb.from('shops').select('*').eq('id', id).single());
      shopCache = toShop(row);
      return shopCache;
    },
    async createShop(name, slug) {
      check(await sb.rpc('create_shop', { p_name: name, p_slug: slug }));
      const s = await store.myShop();
      if (!s) throw new Error('Shop was not created');
      return s;
    },
    async updateShop(patch) {
      const id = await shopId();
      const row: Row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.city !== undefined) row.city = patch.city;
      if (patch.hours !== undefined) row.hours = patch.hours;
      if (patch.etransferEmail !== undefined) row.etransfer_email = patch.etransferEmail;
      if (patch.logoUrl !== undefined) {
        row.logo_url = patch.logoUrl?.startsWith('data:') ? await upload(id, 'logo', patch.logoUrl) : patch.logoUrl;
      }
      if (patch.rates !== undefined) row.rates = patch.rates;
      if (patch.depositPercent !== undefined) row.deposit_percent = patch.depositPercent;
      shopCache = toShop(check(await sb.from('shops').update(row).eq('id', id).select('*').single()));
      return shopCache;
    },
    async inviteStaff(email) {
      const id = await shopId();
      check(await sb.from('staff').insert({ shop_id: id, email: email.trim().toLowerCase(), role: 'staff' }));
    },

    async listJobs() {
      return (check(await sb.from('jobs').select('*').order('created_at', { ascending: false })) as Row[]).map(toJob);
    },
    async updateJob(id, patch) {
      const row: Row = {};
      for (const [k, v] of Object.entries(patch)) if (JOB_COLS[k]) row[JOB_COLS[k]] = v === '' ? null : v;
      return toJob(check(await sb.from('jobs').update(row).eq('id', id).select('*').single()));
    },
    async listClients() {
      return (check(await sb.from('clients').select('*').order('created_at', { ascending: false })) as Row[]).map(toClient);
    },
    async updateClient(id, patch) {
      const row: Row = {};
      for (const k of ['name', 'email', 'phone', 'notes'] as const) if (patch[k] !== undefined) row[k] = patch[k];
      return toClient(check(await sb.from('clients').update(row).eq('id', id).select('*').single()));
    },
    async listBookings() {
      return (check(await sb.from('bookings').select('*').order('created_at', { ascending: false })) as Row[]).map(toBooking);
    },
    async listPhotos(jobId) {
      return (check(await sb.from('job_photos').select('*').eq('job_id', jobId).order('created_at')) as Row[]).map(toPhoto);
    },
    async addPhoto(jobId, dataUrl, kind, caption) {
      const id = await shopId();
      const url = await upload(id, jobId, dataUrl);
      return toPhoto(check(await sb.from('job_photos').insert({ shop_id: id, job_id: jobId, url, kind, caption }).select('*').single()));
    },
    async listQuotes(jobId) {
      let q = sb.from('quotes').select('*').order('created_at', { ascending: false });
      if (jobId) q = q.eq('job_id', jobId);
      return (check(await q) as Row[]).map(toQuote);
    },
    async saveQuote(jobId, d: QuoteDraft, send) {
      const id = await shopId();
      const t = quoteTotals(d);
      const row = check(
        await sb.from('quotes').insert({
          shop_id: id, job_id: jobId, yards: d.yards, fabric_name: d.fabricName, fabric_per_yd: d.fabricPerYd,
          labour: d.labour, foam: d.foam, supplies: d.supplies, discount: d.discount, notes: d.notes,
          subtotal: t.subtotal, hst: t.hst, total: t.total, sent_at: send ? new Date().toISOString() : null,
        }).select('*').single(),
      );
      if (send) {
        await sb.from('jobs').update({ stage: 'quoted' }).eq('id', jobId).eq('stage', 'lead');
        await sb.from('messages').insert({ shop_id: id, job_id: jobId, sender: 'shop', body: `Your quote is ready: ${t.total.toFixed(2)} CAD including HST.` });
      }
      return toQuote(row);
    },
    async listMessages(jobId) {
      return (check(await sb.from('messages').select('*').eq('job_id', jobId).order('created_at')) as Row[]).map(toMessage);
    },
    async addShopMessage(jobId, body) {
      const id = await shopId();
      return toMessage(check(await sb.from('messages').insert({ shop_id: id, job_id: jobId, sender: 'shop', body }).select('*').single()));
    },
    async listSuppliers() {
      return (check(await sb.from('suppliers').select('*').order('name')) as Row[]).map(toSupplier);
    },
    async saveSupplier(s) {
      const id = await shopId();
      const row = { shop_id: id, name: s.name, category: s.category, phone: s.phone, email: s.email, website: s.website, address: s.address, notes: s.notes, verified: s.verified };
      const res = s.id
        ? await sb.from('suppliers').update(row).eq('id', s.id).select('*').single()
        : await sb.from('suppliers').insert(row).select('*').single();
      return toSupplier(check(res));
    },
    async deleteSupplier(id) {
      check(await sb.from('suppliers').delete().eq('id', id));
    },
    async listSwatches() {
      return (check(await sb.from('swatches').select('*').order('material')) as Row[]).map(toSwatch);
    },
    async saveSwatch(s) {
      const id = await shopId();
      const row = { shop_id: id, ...fromSwatch(s) };
      const res = s.id
        ? await sb.from('swatches').update(row).eq('id', s.id).select('*').single()
        : await sb.from('swatches').insert(row).select('*').single();
      return toSwatch(check(res));
    },
    async deleteSwatch(id) {
      check(await sb.from('swatches').delete().eq('id', id));
    },
    async listFaq() {
      return check(await sb.from('shop_faq').select('id, question, answer').order('created_at')) as FaqEntry[];
    },
    async saveFaq(f) {
      const id = await shopId();
      const res = f.id
        ? await sb.from('shop_faq').update({ question: f.question, answer: f.answer }).eq('id', f.id).select('id, question, answer').single()
        : await sb.from('shop_faq').insert({ shop_id: id, question: f.question, answer: f.answer }).select('id, question, answer').single();
      return check(res) as FaqEntry;
    },
    async deleteFaq(id) {
      check(await sb.from('shop_faq').delete().eq('id', id));
    },
  };
  return store;
}
