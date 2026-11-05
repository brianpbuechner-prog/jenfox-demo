// Rehearsal for /party?sim=1. The countdown starts at 6:58 pm and runs at 30x, so the 7:00 and
// 7:30 banners and the 8:00 close all happen in about two minutes. After the movie (or a short
// placeholder), the 15 precincts arrive on the script below, in real seconds after the tracker
// first shows, including a batch of three at once to test the card queue. Numbers are made up
// from each precinct's 2024 vote: 93% turnout and a small swing. They are not a forecast.
import { POLLS_CLOSE_UTC } from "@/lib/electionNight";
import { PRECINCTS, type FeedPrecinct } from "@/lib/partyFeed";

export const SIM_SPEED = 30;
export const SIM_START = POLLS_CLOSE_UTC - 62 * 60 * 1000;
export const SIM_MOVIE_SECONDS = 12;

const SCRIPT: [string, number, number][] = [
  // precinct name, seconds after tracker shows, swing in Fox two-way share
  ["Nininger Twp", 8, 0.02],
  ["Cottage Grove P-7", 35, -0.01],
  ["Hastings W-1 P-1", 55, 0.015],
  ["Hastings W-2 P-2", 80, 0.005],
  ["Hastings W-2 P-3", 80, 0.03],
  ["Denmark Twp P-1", 80, -0.02],
  ["Cottage Grove P-3", 110, 0.01],
  ["Hastings W-3 P-1", 130, 0.025],
  ["Cottage Grove P-4", 150, 0],
  ["Hastings W-1 P-2", 165, 0.012],
  ["Hastings W-3 P-2", 180, -0.005],
  ["Hastings W-4 P-1", 200, 0.018],
  ["Cottage Grove P-5", 215, 0.008],
  ["Hastings W-4 P-2", 235, 0.004],
  ["Hastings W-2 P-1", 250, 0],
];

export function simPrecincts(secondsSinceTracker: number): FeedPrecinct[] {
  return PRECINCTS.map((p) => {
    const s = SCRIPT.find(([name]) => name === p.name);
    const reported = Boolean(s && secondsSinceTracker >= s[1]);
    if (!reported || !s) return { key: p.key, reported: false, d: 0, r: 0 };
    const b = p.bench;
    if (b.house24 <= 1) return { key: p.key, reported: true, d: 1, r: 0 };
    const votes = Math.round((b.fox24 + b.dippel24) * 0.93);
    const d = Math.round(votes * Math.min(1, Math.max(0, p.s24 + s[2])));
    return { key: p.key, reported: true, d, r: votes - d };
  });
}

// Rehearsal message wall: made-up posts, in real seconds after the page opens, shown with a
// "Sample" tag and kept in the browser. They are never written to the Party Posts table.
// The countdown runs about 124 s, then the close hold and placeholder movie, then results.
export const SIM_POSTS: { at: number; name: string; message: string; photo?: string }[] = [
  { at: 12, name: "Sample guest", message: "So proud of you, Jen!" },
  { at: 40, name: "", message: "Knocked 40 doors today. Worth it." },
  { at: 75, name: "Sample photo", message: "The crew at Spiral", photo: "/bg.webp" },
  { at: 175, name: "Sample guest", message: "Hastings loves you!" },
  { at: 260, name: "A neighbor", message: "Whatever happens tonight, thank you for running and for every door you knocked. This district is better for it." },
  { at: 330, name: "", message: "Go Jen!" },
];
// Extra dog runs in rehearsal on top of the random ones: one in the countdown,
// one early in the results, so both show up in a single run-through.
export const SIM_DOGS = [30, 200];
