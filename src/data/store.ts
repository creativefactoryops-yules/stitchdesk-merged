/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import type { FaqEntry } from '../../shared/types';
import type {
  Booking, BookingInput, Client, Job, JobView, Message, Photo, PublicShopData, Quote, Shop, StaffSession, Supplier, Swatch,
} from './models';

export interface QuoteDraft {
  yards: number;
  fabricName: string;
  fabricPerYd: number;
  labour: number;
  foam: number;
  supplies: number;
  discount: number;
  notes: string;
}

/** One interface, two backends: Supabase (real) and localStorage (demo mode). */
export interface DataStore {
  mode: 'supabase' | 'demo';

  // public, no sign-in
  getPublicShop(slug: string): Promise<PublicShopData | null>;
  createBooking(slug: string, input: BookingInput): Promise<{ token: string }>;
  getJobByToken(token: string): Promise<JobView | null>;
  addClientMessage(token: string, body: string): Promise<void>;

  // staff auth
  getSession(): Promise<StaffSession | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string): Promise<void>;
  signOut(): Promise<void>;
  myShop(): Promise<Shop | null>;
  createShop(name: string, slug: string): Promise<Shop>;
  updateShop(patch: Partial<Shop>): Promise<Shop>;
  inviteStaff(email: string): Promise<void>;

  // staff data (always scoped to the signed-in user's shop)
  listJobs(): Promise<Job[]>;
  updateJob(id: string, patch: Partial<Job>): Promise<Job>;
  listClients(): Promise<Client[]>;
  updateClient(id: string, patch: Partial<Client>): Promise<Client>;
  listBookings(): Promise<Booking[]>;
  listPhotos(jobId: string): Promise<Photo[]>;
  addPhoto(jobId: string, dataUrl: string, kind: Photo['kind'], caption: string): Promise<Photo>;
  listQuotes(jobId?: string): Promise<Quote[]>;
  saveQuote(jobId: string, draft: QuoteDraft, send: boolean): Promise<Quote>;
  listMessages(jobId: string): Promise<Message[]>;
  addShopMessage(jobId: string, body: string): Promise<Message>;
  listSuppliers(): Promise<Supplier[]>;
  saveSupplier(s: Supplier): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
  listSwatches(): Promise<Swatch[]>;
  saveSwatch(s: Swatch): Promise<Swatch>;
  deleteSwatch(id: string): Promise<void>;
  listFaq(): Promise<FaqEntry[]>;
  saveFaq(f: FaqEntry): Promise<FaqEntry>;
  deleteFaq(id: string): Promise<void>;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/** 48 hex chars from a secure random source: the client's private job link. */
export const newToken = () => {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};
