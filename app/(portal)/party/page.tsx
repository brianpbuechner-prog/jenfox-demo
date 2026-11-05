import PartyScreen from "@/components/PartyScreen";
import "./party-screen.css";

export const metadata = { title: "Party | Jen Fox team site" };

// Election night party screen: countdown, polls-closed hold, movie, results tracker.
// /party?screen=1 is the bar screen: setup panel, phone remote, hotkeys. Plain /party is view-only,
// so a teammate opening the tab cannot see setup or take the remote's commands.
// /party?sim=1 replays a scripted night at 30x for rehearsal. /party/control is the phone remote.
export default async function PartyPage({ searchParams }: { searchParams: Promise<{ sim?: string; screen?: string }> }) {
  const { sim, screen } = await searchParams;
  return <PartyScreen sim={sim === "1"} screen={screen === "1" || sim === "1"} />;
}
