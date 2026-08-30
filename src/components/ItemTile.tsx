// Square item tiles for relics & potions: every item gets its own game-icon
// (game-icons.net via react-icons/gi) and color identity, plus a rich hover
// tooltip. Used in the belt, satchel, chest drafts, shop and bundles.
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  GiDuck,
  GiCoffeeCup,
  GiCoffeeBeans,
  GiDroplets,
  GiCharm,
  GiCoinflip,
  GiDiceSixFacesFive,
  GiBlackKnightHelm,
  GiBookCover,
  GiBurningSkull,
  GiImperialCrown,
  GiCycle,
  GiHealthPotion,
  GiAngelWings,
  GiSwapBag,
} from "react-icons/gi";
import { relicById, potionById, type Rarity } from "../state/relics";

interface Art {
  Icon: ComponentType<{ className?: string }>;
  bg: string;
  fg: string;
}

const ART: Record<string, Art> = {
  // relics
  "rubber-duck": { Icon: GiDuck, bg: "#FFD93D", fg: "#7a5200" },
  "warm-coffee": { Icon: GiCoffeeCup, bg: "#c68958", fg: "#3b2412" },
  espresso: { Icon: GiCoffeeBeans, bg: "#5b3a21", fg: "#f2ddc4" },
  sponge: { Icon: GiDroplets, bg: "#7fdbca", fg: "#0c4f43" },
  "xp-charm": { Icon: GiCharm, bg: "#C4B5FD", fg: "#3a2b7a" },
  "lucky-coin": { Icon: GiCoinflip, bg: "#ffb03b", fg: "#5f3600" },
  "loaded-dice": { Icon: GiDiceSixFacesFive, bg: "#FF6FB5", fg: "#4d0c2b" },
  "sturdy-helm": { Icon: GiBlackKnightHelm, bg: "#c9cbcf", fg: "#26282c" },
  "scholars-tome": { Icon: GiBookCover, bg: "#4D96FF", fg: "#eaf2ff" },
  "cursed-skull": { Icon: GiBurningSkull, bg: "#191919", fg: "#FF6B6B" },
  crown: { Icon: GiImperialCrown, bg: "#ffde5c", fg: "#7a5200" },
  // potions
  "quest-reroll": { Icon: GiCycle, bg: "#4ADE80", fg: "#0b4f24" },
  "small-tonic": { Icon: GiHealthPotion, bg: "#FF6B6B", fg: "#ffecec" },
  "second-chance": { Icon: GiAngelWings, bg: "#FFFDF5", fg: "#4D96FF" },
};

const FALLBACK: Art = { Icon: GiSwapBag, bg: "#FFFDF5", fg: "#000" };

const SIZE = {
  sm: { box: "h-9 w-9", icon: "text-[20px]" },
  md: { box: "h-12 w-12", icon: "text-[26px]" },
  lg: { box: "h-16 w-16", icon: "text-[38px]" },
} as const;

const RARITY_PIP: Record<Rarity, string> = {
  common: "#ffffff",
  rare: "#C4B5FD",
  legendary: "#FFD93D",
};

export function ItemTile({
  id,
  size = "md",
  count,
  onClick,
  dim = false,
  tipSide = "bottom",
  tipExtra,
}: {
  id: string;
  size?: keyof typeof SIZE;
  count?: number; // stack size badge
  onClick?: () => void;
  dim?: boolean;
  tipSide?: "top" | "bottom";
  tipExtra?: string; // extra tooltip line (e.g. "click to use")
}) {
  const relic = relicById(id);
  const potion = potionById(id);
  const name = relic?.name ?? potion?.name ?? id;
  const desc = relic?.desc ?? potion?.desc ?? "";
  const art = ART[id] ?? FALLBACK;
  const s = SIZE[size];
  const Wrapper = onClick ? motion.button : motion.div;
  // Shape + colored ring tell relics and consumables apart at a glance:
  // relics = square with a rarity-colored ring, potions = round with blue.
  const ring = relic ? RARITY_PIP[relic.rarity] : "#4D96FF";

  return (
    <div className="group relative inline-block">
      <Wrapper
        whileHover={{ y: -3, rotate: -3, scale: 1.08 }}
        whileTap={onClick ? { scale: 0.88 } : undefined}
        onClick={onClick}
        aria-label={name}
        className={`relative grid ${s.box} place-items-center border-2 border-black shadow-neo-sm ${
          potion ? "rounded-full" : ""
        } ${relic?.rarity === "legendary" ? "animate-pulse" : ""} ${dim ? "opacity-60" : ""} ${
          onClick ? "cursor-pointer" : ""
        }`}
        style={{
          background: art.bg,
          color: art.fg,
          outline: `2.5px solid ${ring}`,
          outlineOffset: "1.5px",
        }}
      >
        <art.Icon className={s.icon} />
        {count !== undefined && count > 1 && (
          <span className="absolute -bottom-1.5 -right-1.5 grid min-w-[16px] place-items-center border-2 border-black bg-white px-0.5 text-[9px] font-black leading-none text-black">
            x{count}
          </span>
        )}
      </Wrapper>

      {/* tooltip */}
      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 hidden w-44 -translate-x-1/2 flex-col gap-0.5 border-2 border-black bg-black p-2 shadow-neo-sm group-hover:flex ${
          tipSide === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]"
        }`}
      >
        <span className="flex items-center justify-between gap-2 text-[10px] font-black uppercase text-white">
          {name}
          {relic && (
            <span className="border border-black px-1 text-[8px] text-black" style={{ background: RARITY_PIP[relic.rarity] }}>
              {relic.rarity}
            </span>
          )}
          {potion && <span className="border border-white/40 px-1 text-[8px] text-white/70">potion</span>}
        </span>
        <span className="text-[9px] font-bold leading-snug text-white/80">{desc}</span>
        {tipExtra && <span className="text-[9px] font-black uppercase text-neo-secondary">{tipExtra}</span>}
      </div>
    </div>
  );
}
