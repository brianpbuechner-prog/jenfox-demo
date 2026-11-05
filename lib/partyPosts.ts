// Guest message wall for the party screen. Posts live in the Airtable table "Party Posts" in the
// team base. The public page /party/post writes them; /party shows them; /party/control hides them.
// No server-only imports here, so the screen and the control page can use the types.

export const POSTS_BASE = "appZKFUz9CcVJRWXM";
export const POSTS_TABLE = "tblVC9bZ40codWnOO";
export const PF = {
  name: "fldkdYiaL6qEXteL4",
  message: "fldS785XMIOyijtdw",
  photo: "fldXrP15oIf2AWRHy",
  hidden: "fldq8BTPDKcUURE9m",
  flag: "fldHg8qC5x792CIUY",
  ip: "flduElYDclN5CDDHJ",
} as const;

export const MAX_MESSAGE = 200;
export const MAX_NAME = 40;
/** Decoded photo bytes. The page resizes to about 1600 px JPEG first, so real photos land far below this. */
export const MAX_PHOTO_BYTES = 3_000_000;

export type WallPhoto = { id: string; url: string; thumb: string; width?: number; height?: number };
export type WallPost = {
  id: string;
  name: string;
  message: string;
  photo: WallPhoto | null;
  hidden: boolean;
  flag: string;
  createdTime: string;
  /** Rehearsal posts made up in the browser. Never written to Airtable. */
  sample?: boolean;
};

// Short blocklist. A match does not reject the post (that would tell the sender what to change);
// it sets Hidden quietly so the post never reaches the screen. Brian can still Unhide it.
const BLOCK = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "cunt", "bitch", "asshole", "cock",
  "pussy", "whore", "slut", "bastard", "nigger", "nigga", "faggot", "fag", "retard", "retarded", "kike",
  "spic", "chink", "tranny", "dyke", "wetback",
];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

export function blocked(text: string): string | null {
  const norm = text.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] || c);
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  const squashed = norm.replace(/[^a-z]/g, "");
  for (const w of BLOCK) {
    if (words.includes(w)) return w;
    // Catch "f u c k" and "f.u.c.k" style spacing for the longer words only, to avoid false hits.
    if (w.length >= 5 && squashed.includes(w)) return w;
  }
  return null;
}
