// Persisted mock-interview sessions: transcript, verdict, and final code.
export interface InterviewTranscriptLine {
  role: "user" | "agent";
  message: string;
}

export interface InterviewRecord {
  at: number;
  slug: string;
  title: string;
  durationS: number;
  lang: string;
  code: string;
  result: string;
  feedback: string;
  transcript: InterviewTranscriptLine[];
}

const KEY = "leetgraph.interviews";

export function listInterviews(): InterviewRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveInterview(rec: InterviewRecord) {
  const all = listInterviews();
  all.push(rec);
  // Cap stored transcripts so localStorage doesn't balloon.
  localStorage.setItem(KEY, JSON.stringify(all.slice(-50)));
}
