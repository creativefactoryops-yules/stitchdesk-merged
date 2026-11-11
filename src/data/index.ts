/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { localStore } from './localStore';
import { createSupabaseStore } from './supabaseStore';
import type { DataStore } from './store';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase when both env vars are set at build time; otherwise DEMO MODE (localStorage). */
export const store: DataStore = url && key ? createSupabaseStore(url, key) : localStore;
export const isDemo = store.mode === 'demo';
