// Everything you own: coaches, avatars, satchel. Lives in the Profile drawer.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { FaCrown, FaCheck, FaUserGroup, FaGem, FaFaceSmile } from "react-icons/fa6";
import { unlockedAchievements } from "../state/achievements";
import { COACH_SKINS, isSkinUnlocked, equippedSkin, equipSkin } from "../state/coachSkins";
import { getInventory } from "../state/inventory";
import { avatarUrl, equipAvatar } from "../lib/avatars";
import { sfx } from "../lib/sfx";
import { burst, pointOf } from "../lib/juice";
import { emitCoach } from "../state/coachBus";
import { CoachPreview } from "./Coach";
import { ItemTile } from "./ItemTile";
import { Section } from "./ui/Section";
import { stagger, spring } from "../lib/motion";

function CoachCollection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const unlocked = useMemo(() => unlockedAchievements(), [rev]);
  const equipped = useMemo(() => {
    void rev;
    return equippedSkin().id;
  }, [rev]);
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {COACH_SKINS.map((skin) => {
        const owned = isSkinUnlocked(skin, unlocked);
        const isEquipped = skin.id === equipped;
        return (
          <motion.button
            key={skin.id}
            disabled={!owned}
            whileHover={owned ? { y: -4, rotate: -2 } : {}}
            whileTap={owned ? { scale: 0.9 } : {}}
            transition={spring.bouncy}
            onClick={(e) => {
              equipSkin(skin.id);
              sfx("toggleOn", 0.4);
              const p = pointOf(e.currentTarget);
              burst(p.x, p.y, { count: 14, speed: 320 });
              emitCoach({ type: "skin-equipped", name: skin.name });
              onChanged();
            }}
            title={owned ? (isEquipped ? `${skin.name} is your coach` : `Equip ${skin.name}`) : "Locked — earn its achievement"}
            className={`relative flex flex-col items-center gap-1 border-4 border-black p-2 shadow-neo-sm ${
              isEquipped ? "bg-neo-secondary" : owned ? "bg-white hover:bg-neo-bg" : "bg-neo-bg opacity-40 grayscale"
            }`}
          >
            <CoachPreview skinId={skin.id} size={52} />
            <span className="text-[10px] font-black uppercase">{skin.name}</span>
            {isEquipped && (
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center border-2 border-black bg-neo-ok text-[10px]">
                <FaCrown />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function AvatarCollection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  const inv = useMemo(() => getInventory(), [rev]);
  return (
    <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-8">
      {inv.avatars.map((id) => {
        const isEquipped = id === inv.avatar;
        return (
          <motion.button
            key={id}
            whileHover={{ y: -3, rotate: -3 }}
            whileTap={{ scale: 0.88 }}
            transition={spring.bouncy}
            onClick={() => {
              equipAvatar(id);
              sfx("toggleOn", 0.4);
              onChanged();
            }}
            title={isEquipped ? "Equipped" : "Wear this avatar"}
            className={`relative aspect-square border-4 border-black p-0.5 shadow-neo-sm ${isEquipped ? "bg-neo-secondary" : "bg-white"}`}
          >
            <img src={avatarUrl(id, 80)} alt="Owned avatar" className="h-full w-full" loading="lazy" />
            {isEquipped && (
              <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border-2 border-black bg-neo-ok text-[9px]">
                <FaCheck />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function Satchel({ rev }: { rev: number }) {
  const inv = useMemo(() => getInventory(), [rev]);
  if (inv.relics.length === 0 && inv.potions.length === 0) {
    return (
      <p className="text-xs font-bold uppercase text-black/50">
        Empty — relics drop from boss/elite chests and achievements; potions from events and the shop.
      </p>
    );
  }
  const potionCounts = inv.potions.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-wrap gap-2.5">
      {inv.relics.map((id) => (
        <ItemTile key={id} id={id} size="md" tipSide="bottom" />
      ))}
      {Object.entries(potionCounts).map(([id, count]) => (
        <ItemTile key={id} id={id} size="md" count={count} tipSide="bottom" tipExtra="Use it from the map belt" />
      ))}
    </div>
  );
}

export function CollectionSection({ rev, onChanged }: { rev: number; onChanged: () => void }) {
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
      <Section icon={<FaGem />} title="Satchel" color="muted" sub="Relics are passive. Potions are one-use — tap them on the map belt.">
        <Satchel rev={rev} />
      </Section>
      <Section icon={<FaUserGroup />} title="Coaches" color="pink" sub="Each achievement can unlock a new companion.">
        <CoachCollection rev={rev} onChanged={onChanged} />
      </Section>
      <Section icon={<FaFaceSmile />} title="Avatars" color="yellow" sub="Tap to wear. More in the Shop tab.">
        <AvatarCollection rev={rev} onChanged={onChanged} />
      </Section>
    </motion.div>
  );
}
