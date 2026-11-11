// Shared types used by the browser app and the /api functions.

export type Units = 'in' | 'cm';

export interface JobSheet {
  piece: string | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  units: Units | null;
  fabric: string | null;
  notes: string[];
}

export const EMPTY_SHEET: JobSheet = {
  piece: null,
  width: null,
  depth: null,
  height: null,
  units: null,
  fabric: null,
  notes: [],
};

export interface ChatTurn {
  role: 'user' | 'stitch';
  text: string;
  at?: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface ShopRates {
  /** Fabric price range per yard the shop usually quotes, CAD. */
  fabricLowPerYd: number;
  fabricHighPerYd: number;
  /** Labour by piece type, CAD. Keys are piece ids from PIECES. */
  labour: Record<string, number>;
  foamHr: number;
  foamStandard: number;
  supplies: number;
}

export interface ShopPublic {
  id: string;
  slug: string;
  name: string;
  city: string;
  hours: string;
  etransferEmail: string;
  logoUrl: string | null;
  rates: ShopRates;
  depositPercent: number;
}

export const STAGES = [
  'lead',
  'quoted',
  'deposit',
  'in_progress',
  'ready',
  'picked_up',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  lead: 'Lead',
  quoted: 'Quoted',
  deposit: 'Deposit received',
  in_progress: 'In progress',
  ready: 'Ready',
  picked_up: 'Picked up',
};

export const HST_RATE = 0.13;
