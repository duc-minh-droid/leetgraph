// DiceBear avatars (HTTP API, no deps): identity + the rotating avatar shop.
// Avatar ids are "style:seed"; the shop restocks every 5 minutes from a
// deterministic time-window seed, so both browsers see the same stock.
import { getInventory, updateInventory } from "../state/inventory";
import { RELICS, POTIONS, type RelicDef } from "../state/relics";

export const DICEBEAR_STYLES = [
  "adventurer",
  "adventurer-neutral",
  "avataaars",
  "big-ears",
  "big-smile",
  "bottts",
  "croodles",
  "dylan",
  "fun-emoji",
  "lorelei",
  "micah",
  "miniavs",
  "notionists",
  "open-peeps",
  "personas",
  "pixel-art",
  "thumbs",
] as const;

export function avatarUrl(id: string, size = 96): string {
  const i = id.indexOf(":");
  const style = id.slice(0, i);
  const seed = id.slice(i + 1);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

function mulberry(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomAvatarId(seedNum = Date.now()): string {
  const rand = mulberry(seedNum);
  const style = DICEBEAR_STYLES[Math.floor(rand() * DICEBEAR_STYLES.length)];
  return `${style}:${Math.floor(rand() * 1e9).toString(36)}`;
}

export const SHOP_WINDOW_MS = 5 * 60 * 1000;

export interface ShopOffer {
  id: string; // avatar id
  price: number;
}

// The 6 avatars on sale right now — same for everyone in this 5-min window.
export function shopOffers(now = Date.now()): ShopOffer[] {
  const window = Math.floor(now / SHOP_WINDOW_MS);
  const rand = mulberry(window * 2654435761);
  const offers: ShopOffer[] = [];
  const seen = new Set<string>();
  while (offers.length < 6) {
    const style = DICEBEAR_STYLES[Math.floor(rand() * DICEBEAR_STYLES.length)];
    const seed = Math.floor(rand() * 1e9).toString(36);
    const id = `${style}:${seed}`;
    if (seen.has(id)) continue;
    seen.add(id);
    offers.push({ id, price: 40 + Math.floor(rand() * 111) });
  }
  return offers;
}

export function msUntilRestock(now = Date.now()): number {
  return SHOP_WINDOW_MS - (now % SHOP_WINDOW_MS);
}

// Buy an offer; returns false when broke or already owned.
export function buyAvatar(offer: ShopOffer): boolean {
  const inv = getInventory();
  if (inv.coins < offer.price || inv.avatars.includes(offer.id)) return false;
  updateInventory((i) => ({
    coins: i.coins - offer.price,
    avatars: [...i.avatars, offer.id],
  }));
  return true;
}

export function equipAvatar(id: string) {
  updateInventory({ avatar: id });
}

// Potions are also on sale — a steady coin sink.
export const POTION_PRICES: Record<string, number> = {
  "quest-reroll": 30,
  "small-tonic": 40,
  "second-chance": 60,
};

export function buyPotion(id: string): boolean {
  const price = POTION_PRICES[id];
  const inv = getInventory();
  if (price === undefined || inv.coins < price) return false;
  updateInventory((i) => ({ coins: i.coins - price, potions: [...i.potions, id] }));
  return true;
}

// ---------------- limited bundles (30-minute rotation) ----------------

export const BUNDLE_WINDOW_MS = 30 * 60 * 1000;
const RELIC_PRICE: Record<string, number> = { common: 150, rare: 240, legendary: 400 };

export interface Bundle {
  id: string;
  name: string;
  desc: string;
  price: number;
  fullPrice: number;
  avatars: string[];
  relic?: RelicDef;
  potions: string[];
}

export function bundleOffers(now = Date.now()): Bundle[] {
  const window = Math.floor(now / BUNDLE_WINDOW_MS);
  const rand = mulberry((window * 2246822519) >>> 0);
  // 1. Avatar 3-pack at 40% off.
  const avatars: string[] = [];
  let avatarFull = 0;
  while (avatars.length < 3) {
    const style = DICEBEAR_STYLES[Math.floor(rand() * DICEBEAR_STYLES.length)];
    const id = `${style}:${Math.floor(rand() * 1e9).toString(36)}`;
    if (avatars.includes(id)) continue;
    avatars.push(id);
    avatarFull += 40 + Math.floor(rand() * 111);
  }
  // 2. Relic cache: a specific seeded relic + a potion, 25% off.
  const relic = RELICS[Math.floor(rand() * RELICS.length)];
  const potion = POTIONS[Math.floor(rand() * POTIONS.length)];
  const relicFull = RELIC_PRICE[relic.rarity] + POTION_PRICES[potion.id];
  return [
    {
      id: "avatar-pack",
      name: "Face Heist",
      desc: "Three avatars, one shady discount.",
      price: Math.round(avatarFull * 0.6),
      fullPrice: avatarFull,
      avatars,
      potions: [],
    },
    {
      id: "relic-cache",
      name: "Relic Cache",
      desc: `${relic.name} (${relic.rarity}) + a ${potion.name}.`,
      price: Math.round(relicFull * 0.75),
      fullPrice: relicFull,
      avatars: [],
      relic,
      potions: [potion.id],
    },
  ];
}

export function msUntilBundleRestock(now = Date.now()): number {
  return BUNDLE_WINDOW_MS - (now % BUNDLE_WINDOW_MS);
}

export function bundleKey(b: Bundle, now = Date.now()): string {
  return `${Math.floor(now / BUNDLE_WINDOW_MS)}:${b.id}`;
}

// Buy a bundle; blocked when broke, already bought this window, or the relic
// is already owned (no duplicate relics).
export function buyBundle(b: Bundle, now = Date.now()): boolean {
  const inv = getInventory();
  if (inv.coins < b.price) return false;
  if (inv.bundlesBought.includes(bundleKey(b, now))) return false;
  if (b.relic && inv.relics.includes(b.relic.id)) return false;
  updateInventory((i) => ({
    coins: i.coins - b.price,
    avatars: [...i.avatars, ...b.avatars.filter((a) => !i.avatars.includes(a))],
    relics: b.relic ? [...i.relics, b.relic.id] : i.relics,
    potions: [...i.potions, ...b.potions],
    bundlesBought: [...i.bundlesBought, bundleKey(b, now)].slice(-20),
  }));
  return true;
}

// Everyone gets a random face on first load / account creation.
export function ensureAvatar(): string {
  const inv = getInventory();
  if (inv.avatar) return inv.avatar;
  const id = randomAvatarId();
  updateInventory((i) => ({ avatar: id, avatars: [...i.avatars, id] }));
  return id;
}
