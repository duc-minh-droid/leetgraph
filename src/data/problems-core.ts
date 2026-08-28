export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  frequency: number;
  acceptance: number; // 0..1
  link: string;
  topics: string[];
  elo: number;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function slugFromLink(link: string): string {
  const m = link.match(/\/problems\/([^/]+)/);
  return m ? m[1] : link;
}

// Parse a LeetCode CSV and compute Elo: low acceptance => harder (weighted
// most), low frequency => harder (weighted less), difficulty contributes the
// rest. Rank maps to a 900..2500 bell curve so most problems sit mid-range.
export function parseProblems(text: string): Problem[] {
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const di = idx("Difficulty");
  const ti = idx("Title");
  const fi = idx("Frequency");
  const ai = idx("Acceptance Rate");
  const li = idx("Link");
  const toi = idx("Topics");

  const parsed = rows
    .slice(1)
    .filter((r) => r.length >= 6 && r[ti])
    .map((r) => ({
      slug: slugFromLink(r[li]),
      title: r[ti].trim(),
      difficulty: r[di].trim().toUpperCase() as Difficulty,
      frequency: parseFloat(r[fi]) || 0,
      acceptance: parseFloat(r[ai]) || 0,
      link: r[li].trim(),
      topics: r[toi].replace(/^"|"$/g, "").split(",").map((t) => t.trim()),
    }));

  const maxAcc = Math.max(...parsed.map((p) => p.acceptance), 1e-9);
  const maxFreq = Math.max(...parsed.map((p) => p.frequency), 1e-9);

  const withHardness: Array<Omit<Problem, "elo"> & { hardness: number; elo: number }> =
    parsed.map((p) => {
      const accHard = 1 - p.acceptance / maxAcc;
      const freqHard = 1 - p.frequency / maxFreq;
      const diffNorm = p.difficulty === "EASY" ? 0 : p.difficulty === "MEDIUM" ? 0.5 : 1;
      const hardness = 0.5 * accHard + 0.3 * freqHard + 0.2 * diffNorm;
      return { ...p, hardness, elo: 0 };
    });

  withHardness.sort((a, b) => a.hardness - b.hardness);
  const N = withHardness.length;
  const P = 1.7;
  const denom = Math.pow(0.5, P);
  withHardness.forEach((item, i) => {
    const t = N > 1 ? i / (N - 1) : 0.5;
    const dev = Math.sign(t - 0.5) * Math.pow(Math.abs(t - 0.5), P);
    item.elo = Math.round(1700 + 800 * (dev / denom));
  });

  return withHardness;
}
