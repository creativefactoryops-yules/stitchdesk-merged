/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import type { ChatTurn, FaqEntry, JobSheet, ShopPublic, Stage, Units } from '../../shared/types';

export interface Shop extends ShopPublic {
  trialStartedAt: string;
  plan: 'trial' | 'active' | 'past_due' | 'cancelled';
}

export interface Swatch {
  id: string;
  name: string;
  material: string;
  colour: string;
  hex: string;
  pricePerYd: number | null;
  cleaningCode: string;
  doubleRubs: number | null;
  imageUrl: string | null;
  inStock: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  notes: string;
  verified: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  createdAt: string;
}

export interface RenderRef {
  url: string;
  label: string;
  method: string;
  usedPhoto?: boolean;
  caption?: string;
}

export interface Job {
  id: string;
  clientId: string | null;
  token: string;
  stage: Stage;
  title: string;
  piece: string | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  units: Units | null;
  fabric: string | null;
  notes: string;
  estimateLow: number | null;
  estimateHigh: number | null;
  dropoffDate: string | null; // YYYY-MM-DD
  pickupDate: string | null;
  transcript: ChatTurn[];
  renders: RenderRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  jobId: string;
  url: string;
  kind: 'before' | 'after' | 'progress' | 'render';
  caption: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  jobId: string;
  yards: number;
  fabricName: string;
  fabricPerYd: number;
  labour: number;
  foam: number;
  supplies: number;
  discount: number;
  subtotal: number;
  hst: number;
  total: number;
  notes: string;
  sentAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  jobId: string;
  sender: 'client' | 'shop';
  body: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  jobId: string;
  clientId: string | null;
  preferredDates: string[];
  contactMethod: string;
  message: string;
  status: 'requested' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface PublicShopData {
  shop: Shop;
  swatches: Swatch[];
  faq: FaqEntry[];
}

export interface BookingInput {
  name: string;
  email: string;
  phone: string;
  contactMethod: string;
  preferredDates: string[];
  message: string;
  sheet: JobSheet;
  estimateLow: number | null;
  estimateHigh: number | null;
  transcript: ChatTurn[];
  renders: RenderRef[];
  beforePhoto: string | null; // data URL
}

export interface JobView {
  job: Job;
  shop: Pick<Shop, 'name' | 'slug' | 'hours' | 'city' | 'etransferEmail' | 'depositPercent'>;
  clientName: string | null;
  photos: Photo[];
  quote: Quote | null;
  messages: Message[];
}

export interface StaffSession {
  email: string;
  demo: boolean;
}
