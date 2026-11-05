"use client";
import { useEffect, useRef, useState } from "react";
import type { WallPost } from "@/lib/partyPosts";

// Right-hand rail on the party screen. A new post flashes in for about 8 seconds, then joins a
// rotation that shows each post about 8 seconds. Photos fill the rail width with the message and
// name under them; text-only posts show as a large quote. Before anyone posts, the QR is large.
// The post list comes from the parent's latest poll, and a post is looked up by id every time it
// is drawn, so a hidden post leaves at the next poll. Photo URLs come from the parent, which takes
// them from the polls and never keeps one longer than 30 minutes (Airtable's expire after hours).

const SHOW_MS = 8000;

export default function PartyWall({ posts, fresh, showNames }: { posts: WallPost[]; fresh: WallPost[]; showNames: boolean }) {
  // Flash queue holds ids of posts that arrived since the screen opened, oldest first.
  const flashQ = useRef<string[]>([]);
  const seenFresh = useRef(new Set<string>());
  const rot = useRef(-1);
  const [current, setCurrent] = useState<{ id: string; flash: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    let added = false;
    for (const p of fresh) {
      if (seenFresh.current.has(p.id)) continue;
      seenFresh.current.add(p.id);
      flashQ.current.push(p.id);
      added = true;
    }
    // Interrupt the rotation (not another flash) so a new post shows right away.
    if (added && !current?.flash) setStep((s) => s + 1);
  }, [fresh, current?.flash]);

  // Pick what to show next every SHOW_MS, or straight away when the shown post disappears.
  useEffect(() => {
    const list = postsRef.current;
    const ids = new Set(list.map((p) => p.id));
    flashQ.current = flashQ.current.filter((id) => ids.has(id));
    let next: { id: string; flash: boolean } | null = null;
    if (flashQ.current.length) next = { id: flashQ.current.shift()!, flash: true };
    else if (list.length) { rot.current = (rot.current + 1) % list.length; next = { id: list[rot.current].id, flash: false }; }
    setCurrent(next);
    const t = setTimeout(() => setStep((s) => s + 1), SHOW_MS);
    return () => clearTimeout(t);
  }, [step]);

  const post = current ? posts.find((p) => p.id === current.id) : undefined;
  useEffect(() => {
    if (current && !post) setStep((s) => s + 1);
    if (!current && posts.length) setStep((s) => s + 1);
  }, [current, post, posts.length]);

  if (!posts.length) {
    return (
      <aside className="pw pw-empty">
        <div className="pw-first">Be the first to post for Jen</div>
        <div className="pw-qr-big pw-qr-demo">QR code</div>
        <div className="pw-scan">Guests scanned a code here to post (turned off in the demo)</div>
      </aside>
    );
  }

  const len = post?.message.length || 0;
  return (
    <aside className="pw">
      <div className="pw-stage">
        {post && (
          <div className={`pw-post${current?.flash ? " flash" : ""}${post.photo ? " has-photo" : " quote"}${len > 120 ? " long" : len > 60 ? " mid" : ""}`} key={`${post.id}-${step}`}>
            {current?.flash && <div className="pw-new">New</div>}
            {post.sample && <div className="pw-sample">Sample</div>}
            {post.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pw-photo" src={post.photo.url} alt={post.message || "Guest photo"} />
            )}
            {post.message && <div className="pw-msg">{post.photo ? post.message : `“${post.message}”`}</div>}
            {showNames && post.name && <div className="pw-name">{post.name}</div>}
          </div>
        )}
      </div>
      <div className="pw-qr">
        <div className="pw-qr-demo">QR code</div>
        <span>Guests scanned a code here to post a message or photo (turned off in the demo)</span>
      </div>
    </aside>
  );
}
