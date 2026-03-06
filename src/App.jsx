import { useState, useEffect, useCallback } from "react";

// ─── BRAND TOKENS ────────────────────────────────────────────────────────────
const COLORS = {
  parch: "#F5F0E8", sand: "#EDE4D4", stone: "#D6CBBA",
  bark: "#2E2318", ink: "#1A1208",
  marigold: "#E8A020", chili: "#C4380A", herb: "#5C8A60",
  fog: "#8BA8B8", plum: "#6E3A6A", mist: "#9A8F7C",
};

const COMPETENCIES = [
  { id: "ai", label: "AI Literacy", icon: "◈", color: COLORS.fog, desc: "The village doesn't fear the tools. It learns them first." },
  { id: "discovery", label: "Discovery", icon: "◎", color: COLORS.marigold, desc: "You can't build the village if you don't know where you're standing." },
  { id: "representation", label: "Representation", icon: "◉", color: COLORS.herb, desc: "The village has to look like the people it's built for." },
  { id: "wellness", label: "Educator Wellness", icon: "◌", color: COLORS.chili, desc: "You cannot build the village running on empty." },
  { id: "community", label: "Community Building", icon: "⬡", color: COLORS.plum, desc: "Every great educator is already a community builder." },
  { id: "curriculum", label: "Curriculum Design", icon: "◧", color: COLORS.bark, desc: "The most powerful thing an educator builds is a learning experience." },
];

const RESOURCE_TYPES = ["Article", "Tool", "Template", "Course", "Video", "Podcast", "Book", "Research"];

// No seed resources — the library is populated by admin-approved submissions only.
// Add real, verified resources through the Submit → Admin approval flow.
const SEED_RESOURCES = [];

// ─── COMPETENCY → API SEARCH QUERIES ─────────────────────────────────────────
const COMPETENCY_QUERIES = {
  ai:             { eric: "artificial intelligence education classroom", books: "AI literacy educators teaching", oer: "artificial intelligence", merlot: "artificial intelligence teaching" },
  discovery:      { eric: "educator identity professional development career", books: "educator identity professional purpose", oer: "professional development educator identity", merlot: "educator professional development" },
  representation: { eric: "culturally sustaining pedagogy diverse learners", books: "culturally responsive teaching representation", oer: "culturally responsive teaching", merlot: "diversity inclusion education" },
  wellness:       { eric: "teacher burnout wellness self-care sustainability", books: "teacher burnout educator wellness", oer: "teacher wellness self-care", merlot: "teacher burnout wellness" },
  community:      { eric: "professional learning community educator collaboration", books: "community building education belonging", oer: "community building learning", merlot: "collaborative learning community" },
  curriculum:     { eric: "curriculum design backwards design UbD instruction", books: "curriculum design instructional design learning", oer: "curriculum design instruction", merlot: "curriculum design instructional design" },
};

// ─── ERIC API (U.S. Dept of Education — no key required) ──────────────────────
async function fetchERIC(query) {
  const url = `https://api.ies.ed.gov/eric/?search=${encodeURIComponent(query)}&fields=id,title,author,description,url,publicationdateyear,source&format=json&rows=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("ERIC API error");
  const data = await res.json();
  return (data.response?.docs || []).map(d => ({
    id: `eric-${d.id}`,
    title: d.title || "Untitled",
    author: Array.isArray(d.author) ? d.author.slice(0, 2).join(", ") : d.author || "",
    description: d.description ? d.description.slice(0, 200) + (d.description.length > 200 ? "…" : "") : "No description available.",
    url: d.url || `https://eric.ed.gov/?id=${d.id}`,
    year: d.publicationdateyear || "",
    source: "ERIC",
    type: "Research",
  }));
}

// ─── GOOGLE BOOKS API (no key required for basic search) ─────────────────────
async function fetchBooks(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6&printType=books&langRestrict=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Books API error");
  const data = await res.json();
  return (data.items || []).map(item => {
    const info = item.volumeInfo || {};
    return {
      id: `books-${item.id}`,
      title: info.title || "Untitled",
      author: info.authors ? info.authors.slice(0, 2).join(", ") : "",
      description: info.description ? info.description.slice(0, 200) + (info.description.length > 200 ? "…" : "") : "No description available.",
      url: info.infoLink || `https://books.google.com/books?id=${item.id}`,
      year: info.publishedDate ? info.publishedDate.slice(0, 4) : "",
      source: "Google Books",
      type: "Book",
      thumbnail: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
    };
  });
}

// ─── YOUTUBE DATA API (requires key — user must supply) ───────────────────────
async function fetchYouTube(query, apiKey) {
  if (!apiKey) return [];
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + " educators")}&type=video&maxResults=4&relevanceLanguage=en&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("YouTube API error");
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.items || []).map(item => ({
    id: `yt-${item.id.videoId}`,
    title: item.snippet?.title || "Untitled",
    author: item.snippet?.channelTitle || "",
    description: item.snippet?.description ? item.snippet.description.slice(0, 200) + "…" : "",
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    year: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 4) : "",
    source: "YouTube",
    type: "Video",
    thumbnail: item.snippet?.thumbnails?.medium?.url || null,
  }));
}

// ─── OER COMMONS API (Open Educational Resources — free, requires free API key) ─
async function fetchOER(query, apiKey) {
  if (!apiKey) return [];
  const url = `https://www.oercommons.org/api/v1/materials/?search=${encodeURIComponent(query)}&limit=5&format=json`;
  const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  if (!res.ok) throw new Error("OER Commons API error");
  const data = await res.json();
  return (data.results || []).map(d => ({
    id: `oer-${d.id}`,
    title: d.title || "Untitled",
    author: d.authors?.map(a => a.name).slice(0, 2).join(", ") || "",
    description: d.abstract ? d.abstract.slice(0, 200) + (d.abstract.length > 200 ? "…" : "") : "No description available.",
    url: d.url || `https://www.oercommons.org/courseware/${d.id}`,
    year: d.created ? d.created.slice(0, 4) : "",
    source: "OER Commons",
    type: d.material_types?.[0] || "Resource",
    thumbnail: null,
  }));
}

// ─── MERLOT API (Multimedia Educational Resource — free, requires free API key) ─
async function fetchMERLOT(query, apiKey) {
  if (!apiKey) return [];
  const url = `https://www.merlot.org/merlot/materials.rest?keywords=${encodeURIComponent(query)}&licenseGroup=1&maxRecords=5&apikey=${apiKey}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error("MERLOT API error");
  const data = await res.json();
  const materials = data?.results?.material || [];
  return materials.map(m => ({
    id: `merlot-${m.materialid}`,
    title: m.title || "Untitled",
    author: m.authorname || "",
    description: m.description ? m.description.slice(0, 200) + (m.description.length > 200 ? "…" : "") : "No description available.",
    url: m.detailurl || `https://www.merlot.org/merlot/viewMaterial.htm?id=${m.materialid}`,
    year: m.creationdate ? String(m.creationdate).slice(0, 4) : "",
    source: "MERLOT",
    type: m.materialtype || "Resource",
    thumbnail: null,
  }));
}
async function askAI(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are the Hive Discovery Resource Assistant — a warm, direct, knowledgeable guide for educators inside The Hive Discovery community. 
Your voice is energetic, direct, and nurturing. You speak like a great mentor: warm enough to make educators feel safe, direct enough to push them forward.
You help educators find resources, understand competencies, and navigate their professional growth.
The six core competencies are: AI Literacy, Discovery, Representation, Educator Wellness, Community Building, and Curriculum Design.
Keep responses concise (2-4 sentences) and actionable. Never use corporate jargon. Speak to educators like the professionals they are.`,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "Something went wrong. Try again.";
}

// ─── NOISE TEXTURE ────────────────────────────────────────────────────────────
const noiseStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`,
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function HiveResourceApp() {
  const [view, setView] = useState("library"); // library | discover | submit | admin | ai
  const [resources, setResources] = useState(SEED_RESOURCES);
  const [pending, setPending] = useState([]);
  const [bookmarked, setBookmarked] = useState([]);
  const [activeComp, setActiveComp] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Discover
  const [discoverComp, setDiscoverComp] = useState("ai");
  const [discoverResults, setDiscoverResults] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [ytKey, setYtKey] = useState("");
  const [ytKeyInput, setYtKeyInput] = useState("");
  const [oerKey, setOerKey] = useState("");
  const [oerKeyInput, setOerKeyInput] = useState("");
  const [merlotKey, setMerlotKey] = useState("");
  const [merlotKeyInput, setMerlotKeyInput] = useState("");
  const [showYtKeyForm, setShowYtKeyForm] = useState(false);
  const [showOerKeyForm, setShowOerKeyForm] = useState(false);
  const [showMerlotKeyForm, setShowMerlotKeyForm] = useState(false);

  // AI
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Submit form
  const [form, setForm] = useState({ title: "", url: "", type: "Article", competency: "ai", description: "", submittedBy: "" });
  const [submitted, setSubmitted] = useState(false);

  // Load bookmarks, pending, and YT key from storage
  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("hive-bookmarks"); if (r) setBookmarked(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("hive-pending"); if (r) setPending(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("hive-yt-key"); if (r) setYtKey(r.value); } catch {}
      try { const r = await window.storage.get("hive-oer-key"); if (r) setOerKey(r.value); } catch {}
      try { const r = await window.storage.get("hive-merlot-key"); if (r) setMerlotKey(r.value); } catch {}
    })();
  }, []);

  // Fetch from APIs when discover competency changes
  useEffect(() => {
    if (view !== "discover") return;
    fetchDiscover(discoverComp);
  }, [discoverComp, view, ytKey]);

  const fetchDiscover = async (compId) => {
    setDiscoverLoading(true);
    setDiscoverError("");
    setDiscoverResults([]);
    const q = COMPETENCY_QUERIES[compId];
    try {
      const [ericRes, booksRes, ytRes, oerRes, merlotRes] = await Promise.allSettled([
        fetchERIC(q.eric),
        fetchBooks(q.books),
        fetchYouTube(q.books, ytKey),
        fetchOER(q.oer, oerKey),
        fetchMERLOT(q.merlot, merlotKey),
      ]);
      const combined = [
        ...(ericRes.status === "fulfilled" ? ericRes.value : []),
        ...(booksRes.status === "fulfilled" ? booksRes.value : []),
        ...(ytRes.status === "fulfilled" ? ytRes.value : []),
        ...(oerRes.status === "fulfilled" ? oerRes.value : []),
        ...(merlotRes.status === "fulfilled" ? merlotRes.value : []),
      ];
      if (combined.length === 0) setDiscoverError("No results returned. The APIs may be rate-limited — try again in a moment.");
      setDiscoverResults(combined);
    } catch (e) {
      setDiscoverError("Something went wrong fetching results. Check your connection and try again.");
    }
    setDiscoverLoading(false);
  };

  const saveYtKey = async () => {
    setYtKey(ytKeyInput);
    try { await window.storage.set("hive-yt-key", ytKeyInput); } catch {}
    setShowYtKeyForm(false);
  };

  const saveOerKey = async () => {
    setOerKey(oerKeyInput);
    try { await window.storage.set("hive-oer-key", oerKeyInput); } catch {}
    setShowOerKeyForm(false);
  };

  const saveMerlotKey = async () => {
    setMerlotKey(merlotKeyInput);
    try { await window.storage.set("hive-merlot-key", merlotKeyInput); } catch {}
    setShowMerlotKeyForm(false);
  };

  const saveBookmarks = async (bm) => {
    setBookmarked(bm);
    try { await window.storage.set("hive-bookmarks", JSON.stringify(bm)); } catch {}
  };

  const savePending = async (p) => {
    setPending(p);
    try { await window.storage.set("hive-pending", JSON.stringify(p)); } catch {}
  };

  const toggleBookmark = (id) => {
    const next = bookmarked.includes(id) ? bookmarked.filter(b => b !== id) : [...bookmarked, id];
    saveBookmarks(next);
  };

  const filtered = resources.filter(r => {
    if (!r.approved) return false;
    if (showBookmarks && !bookmarked.includes(r.id)) return false;
    if (activeComp !== "all" && r.competency !== activeComp) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
    }
    return true;
  });

  const submitResource = () => {
    if (!form.title || !form.url || !form.submittedBy) return;
    const newR = { ...form, id: Date.now(), approved: false, bookmarks: 0 };
    savePending([...pending, newR]);
    setForm({ title: "", url: "", type: "Article", competency: "ai", description: "", submittedBy: "" });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const approveResource = (r) => {
    setResources(prev => [...prev, { ...r, approved: true }]);
    savePending(pending.filter(p => p.id !== r.id));
  };

  const rejectResource = (id) => {
    savePending(pending.filter(p => p.id !== id));
  };

  const sendAI = useCallback(async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const next = [...aiMessages, userMsg];
    setAiMessages(next);
    setAiInput("");
    setAiLoading(true);
    try {
      const reply = await askAI(next);
      setAiMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setAiMessages([...next, { role: "assistant", content: "Something went wrong. Try again in a moment." }]);
    }
    setAiLoading(false);
  }, [aiInput, aiMessages, aiLoading]);

  const comp = (id) => COMPETENCIES.find(c => c.id === id);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.parch, minHeight: "100vh", color: COLORS.ink, ...noiseStyle }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <header style={{ background: COLORS.ink, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${COLORS.marigold}`, ...noiseStyle }}>
        <div style={{ padding: "16px 0" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: -0.5, color: COLORS.parch }}>
            ⬡ THE HIVE DISCOVERY
          </div>
          <div style={{ fontSize: 11, color: COLORS.marigold, letterSpacing: 3, textTransform: "uppercase", marginTop: 2 }}>
            Resource Library
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[
            { id: "library", label: "Library" },
            { id: "discover", label: "⬡ Discover" },
            { id: "ai", label: "✦ Ask the Hive" },
            { id: "submit", label: "Submit Resource" },
            { id: "admin", label: "Admin" },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
              background: view === v.id ? COLORS.marigold : "transparent",
              color: view === v.id ? COLORS.ink : "rgba(245,240,232,.6)",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all .15s",
            }}>{v.label}</button>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ══════════════ LIBRARY VIEW ══════════════ */}
        {view === "library" && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: COLORS.mist, marginBottom: 6 }}>
                Built for the ones who build everyone else.
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(28px,4vw,48px)", letterSpacing: -2, lineHeight: .95, margin: 0 }}>
                Every resource<br /><span style={{ color: COLORS.marigold }}>the village needs.</span>
              </h1>
            </div>

            {/* Competency filters */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              <button onClick={() => { setActiveComp("all"); setShowBookmarks(false); }} style={{
                padding: "8px 18px", fontSize: 12, fontWeight: 500, border: `1px solid ${activeComp === "all" && !showBookmarks ? COLORS.ink : "rgba(26,18,8,.15)"}`,
                background: activeComp === "all" && !showBookmarks ? COLORS.ink : "transparent",
                color: activeComp === "all" && !showBookmarks ? COLORS.parch : COLORS.mist, cursor: "pointer",
              }}>All Competencies</button>
              {COMPETENCIES.map(c => (
                <button key={c.id} onClick={() => { setActiveComp(c.id); setShowBookmarks(false); }} style={{
                  padding: "8px 18px", fontSize: 12, fontWeight: 500,
                  border: `1px solid ${activeComp === c.id && !showBookmarks ? c.color : "rgba(26,18,8,.12)"}`,
                  background: activeComp === c.id && !showBookmarks ? c.color : "transparent",
                  color: activeComp === c.id && !showBookmarks ? (c.id === "curriculum" ? COLORS.parch : COLORS.ink) : COLORS.mist,
                  cursor: "pointer", transition: "all .15s",
                }}>{c.icon} {c.label}</button>
              ))}
              <button onClick={() => { setShowBookmarks(!showBookmarks); setActiveComp("all"); }} style={{
                padding: "8px 18px", fontSize: 12, fontWeight: 500, marginLeft: "auto",
                border: `1px solid ${showBookmarks ? COLORS.chili : "rgba(26,18,8,.12)"}`,
                background: showBookmarks ? COLORS.chili : "transparent",
                color: showBookmarks ? "#fff" : COLORS.mist, cursor: "pointer",
              }}>♡ Saved ({bookmarked.length})</button>
            </div>

            {/* Search + type filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search resources..."
                style={{ flex: 1, padding: "10px 16px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, outline: "none" }}
              />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
                padding: "10px 16px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, cursor: "pointer",
              }}>
                <option value="all">All Types</option>
                {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Results count */}
            <div style={{ fontSize: 12, color: COLORS.mist, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
              {filtered.length} resource{filtered.length !== 1 ? "s" : ""} {showBookmarks ? "saved" : activeComp !== "all" ? `in ${comp(activeComp)?.label}` : "in the library"}
            </div>

            {/* Resource grid */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: COLORS.mist }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⬡</div>
                {showBookmarks ? (
                  <>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>No saved resources yet.</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Bookmark resources from the library to find them here.</div>
                  </>
                ) : resources.filter(r => r.approved).length === 0 ? (
                  <>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>The library is just getting started.</div>
                    <div style={{ fontSize: 13, marginTop: 6, maxWidth: 360, margin: "8px auto 0" }}>
                      No resources have been added yet. Submit a real resource you've found valuable — once approved by an admin, it'll live here for the whole village.
                    </div>
                    <button onClick={() => setView("submit")} style={{ marginTop: 20, padding: "9px 20px", background: COLORS.marigold, border: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, color: COLORS.ink }}>
                      Submit the First Resource →
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>No resources match this filter.</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Try a different competency or type — or submit one for this area.</div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 3 }}>
                {filtered.map(r => {
                  const c = comp(r.competency);
                  const isBookmarked = bookmarked.includes(r.id);
                  return (
                    <div key={r.id} style={{ background: COLORS.sand, padding: "24px", display: "flex", flexDirection: "column", gap: 12, position: "relative", borderTop: `3px solid ${c?.color || COLORS.marigold}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", background: c?.color || COLORS.marigold, color: r.competency === "curriculum" || r.competency === "wellness" ? COLORS.parch : COLORS.ink }}>
                              {c?.icon} {c?.label}
                            </span>
                            <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: `1px solid ${COLORS.stone}`, color: COLORS.mist }}>
                              {r.type}
                            </span>
                            {r.tier !== "all" && (
                              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", background: r.tier === "architect" ? COLORS.plum : COLORS.marigold, color: r.tier === "architect" ? COLORS.parch : COLORS.ink }}>
                                {r.tier}+
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: -0.2, margin: 0, lineHeight: 1.2 }}>
                            {r.title}
                          </h3>
                        </div>
                        <button onClick={() => toggleBookmark(r.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: isBookmarked ? COLORS.chili : COLORS.stone, flexShrink: 0, padding: 0 }}>
                          {isBookmarked ? "♥" : "♡"}
                        </button>
                      </div>
                      <p style={{ fontSize: 13, color: COLORS.mist, lineHeight: 1.65, margin: 0 }}>{r.description}</p>
                      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: COLORS.stone }}>{r.bookmarks + (isBookmarked ? 1 : 0)} saves</span>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{
                          padding: "7px 16px", background: COLORS.ink, color: COLORS.parch,
                          fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
                          textDecoration: "none", fontWeight: 500,
                        }}>Open →</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════ DISCOVER VIEW ══════════════ */}
        {view === "discover" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: COLORS.mist, marginBottom: 6 }}>Live from the web</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(28px,4vw,48px)", letterSpacing: -2, lineHeight: .95, margin: 0 }}>
                Discover what the<br /><span style={{ color: COLORS.marigold }}>field is saying.</span>
              </h2>
              <p style={{ fontSize: 13, color: COLORS.mist, marginTop: 10, maxWidth: 580, lineHeight: 1.65 }}>
                Live results pulled from <strong style={{ color: COLORS.ink }}>ERIC</strong> (U.S. Dept of Education research database) and <strong style={{ color: COLORS.ink }}>Google Books</strong> — filtered by competency. Results are external sources, not vetted by The Hive. Use the Submit tab to add anything worth keeping to the library.
              </p>

              {/* API key setup */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "YouTube", key: ytKey, input: ytKeyInput, setInput: setYtKeyInput, showForm: showYtKeyForm, setShowForm: setShowYtKeyForm, save: saveYtKey, docsUrl: "https://console.cloud.google.com/", docsLabel: "console.cloud.google.com → Enable YouTube Data API v3 → Create credentials → API key" },
                  { label: "OER Commons", key: oerKey, input: oerKeyInput, setInput: setOerKeyInput, showForm: showOerKeyForm, setShowForm: setShowOerKeyForm, save: saveOerKey, docsUrl: "https://www.oercommons.org/oercommons-api-information", docsLabel: "oercommons.org/oercommons-api-information → Request free API key" },
                  { label: "MERLOT", key: merlotKey, input: merlotKeyInput, setInput: setMerlotKeyInput, showForm: showMerlotKeyForm, setShowForm: setShowMerlotKeyForm, save: saveMerlotKey, docsUrl: "https://www.merlot.org/merlot/materials.rest", docsLabel: "merlot.org → Create free account → Request API key" },
                ].map(api => (
                  <div key={api.label}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, padding: "5px 10px", background: api.key ? COLORS.herb : COLORS.stone, color: api.key ? "#fff" : COLORS.parch }}>
                        {api.key ? `✓ ${api.label} connected` : `${api.label} not connected`}
                      </div>
                      <button onClick={() => api.setShowForm(!api.showForm)} style={{ fontSize: 11, padding: "5px 10px", border: `1px solid ${COLORS.stone}`, background: "transparent", color: COLORS.mist, cursor: "pointer", letterSpacing: 1 }}>
                        {api.key ? "Update Key" : `Add ${api.label} Key →`}
                      </button>
                    </div>
                    {api.showForm && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: "flex", gap: 6, maxWidth: 480 }}>
                          <input value={api.input} onChange={e => api.setInput(e.target.value)}
                            placeholder={`Paste your ${api.label} API key...`}
                            style={{ flex: 1, padding: "8px 12px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, outline: "none" }} />
                          <button onClick={api.save} style={{ padding: "8px 16px", background: COLORS.marigold, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: COLORS.ink }}>Save</button>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.stone, marginTop: 4 }}>
                          Get a free key: <a href={api.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.marigold }}>{api.docsLabel}</a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Competency selector */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28 }}>
              {COMPETENCIES.map(c => (
                <button key={c.id} onClick={() => setDiscoverComp(c.id)} style={{
                  padding: "8px 18px", fontSize: 12, fontWeight: 500,
                  border: `1px solid ${discoverComp === c.id ? c.color : "rgba(26,18,8,.12)"}`,
                  background: discoverComp === c.id ? c.color : "transparent",
                  color: discoverComp === c.id ? (["curriculum","wellness"].includes(c.id) ? COLORS.parch : COLORS.ink) : COLORS.mist,
                  cursor: "pointer", transition: "all .15s",
                }}>{c.icon} {c.label}</button>
              ))}
            </div>

            {/* Source legend */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { source: "ERIC", color: COLORS.fog, note: "U.S. Dept of Education — peer-reviewed research", active: true },
                { source: "Google Books", color: COLORS.herb, note: "Books — no key required", active: true },
                { source: "OER Commons", color: COLORS.marigold, note: "Open educational resources — requires free key", active: !!oerKey },
                { source: "MERLOT", color: COLORS.plum, note: "Higher ed multimedia resources — requires free key", active: !!merlotKey },
                { source: "YouTube", color: COLORS.chili, note: "Video — requires free key", active: !!ytKey },
              ].map(s => (
                <div key={s.source} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: s.active ? COLORS.ink : COLORS.stone, opacity: s.active ? 1 : 0.5 }}>
                  <span style={{ width: 10, height: 10, background: s.color, display: "inline-block" }}></span>
                  <strong>{s.source}</strong> — {s.note}
                </div>
              ))}
            </div>

            {/* Results */}
            {discoverLoading && (
              <div style={{ textAlign: "center", padding: "64px 0", color: COLORS.mist }}>
                <div style={{ fontSize: 32, marginBottom: 10, animation: "spin 1.5s linear infinite" }}>⬡</div>
                <div style={{ fontSize: 14 }}>Pulling from ERIC and Google Books…</div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {discoverError && !discoverLoading && (
              <div style={{ padding: "16px 20px", background: COLORS.sand, border: `1px solid ${COLORS.stone}`, fontSize: 13, color: COLORS.chili }}>
                ⚠ {discoverError}
              </div>
            )}

            {!discoverLoading && discoverResults.length > 0 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.mist, marginBottom: 16 }}>
                  {discoverResults.length} results for {COMPETENCIES.find(c => c.id === discoverComp)?.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 3 }}>
                  {discoverResults.map(r => {
                    const srcColor = r.source === "ERIC" ? COLORS.fog : r.source === "Google Books" ? COLORS.herb : r.source === "OER Commons" ? COLORS.marigold : r.source === "MERLOT" ? COLORS.plum : COLORS.chili;
                    const srcTextDark = r.source === "Google Books" || r.source === "OER Commons";
                    return (
                      <div key={r.id} style={{ background: COLORS.sand, borderTop: `3px solid ${srcColor}`, padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {r.thumbnail && (
                          <img src={r.thumbnail} alt={r.title} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", background: srcColor, color: srcTextDark ? COLORS.ink : COLORS.parch }}>{r.source}</span>
                          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: `1px solid ${COLORS.stone}`, color: COLORS.mist }}>{r.type}</span>
                          {r.year && <span style={{ fontSize: 10, color: COLORS.stone, padding: "3px 0" }}>{r.year}</span>}
                        </div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: -0.2, lineHeight: 1.25 }}>{r.title}</div>
                        {r.author && <div style={{ fontSize: 11, color: COLORS.mist }}>{r.author}</div>}
                        <p style={{ fontSize: 12, color: COLORS.mist, lineHeight: 1.65, margin: 0, flex: 1 }}>{r.description}</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${COLORS.stone}` }}>
                          <button onClick={() => { setView("submit"); }} style={{ fontSize: 11, color: COLORS.mist, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add to library</button>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", background: COLORS.ink, color: COLORS.parch, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", textDecoration: "none", fontWeight: 500 }}>Open →</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════ AI ASSISTANT VIEW ══════════════ */}
        {view === "ai" && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: COLORS.mist, marginBottom: 6 }}>Your guide to the library</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: -1.5, margin: 0 }}>
                Ask the <span style={{ color: COLORS.marigold }}>Hive.</span>
              </h2>
              <p style={{ fontSize: 14, color: COLORS.mist, marginTop: 8 }}>Not sure where to start? Ask about a competency, your current situation, or what the Hive can help you build.</p>
            </div>

            {/* Suggested prompts */}
            {aiMessages.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {[
                  "I'm burned out and don't know where to start.",
                  "Help me understand AI Literacy for educators.",
                  "I want to build something beyond my classroom.",
                  "What's the difference between Cultivator and Architect?",
                  "Where do I find curriculum design resources?",
                ].map(p => (
                  <button key={p} onClick={() => { setAiInput(p); }} style={{
                    padding: "8px 14px", fontSize: 12, border: `1px solid ${COLORS.stone}`,
                    background: COLORS.sand, color: COLORS.mist, cursor: "pointer", textAlign: "left",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{p}</button>
                ))}
              </div>
            )}

            {/* Chat */}
            <div style={{ background: COLORS.sand, minHeight: 320, maxHeight: 440, overflowY: "auto", padding: 24, marginBottom: 3, display: "flex", flexDirection: "column", gap: 16 }}>
              {aiMessages.length === 0 && (
                <div style={{ color: COLORS.stone, fontSize: 13, fontStyle: "italic", textAlign: "center", margin: "auto" }}>
                  The village is listening. Ask anything.
                </div>
              )}
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 12, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{ width: 28, height: 28, flexShrink: 0, background: m.role === "user" ? COLORS.stone : COLORS.marigold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: m.role === "user" ? COLORS.parch : COLORS.ink }}>
                    {m.role === "user" ? "U" : "⬡"}
                  </div>
                  <div style={{ maxWidth: "80%", padding: "12px 16px", background: m.role === "user" ? COLORS.parch : COLORS.ink, color: m.role === "user" ? COLORS.ink : COLORS.parch, fontSize: 14, lineHeight: 1.65, border: m.role === "user" ? `1px solid ${COLORS.stone}` : "none" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 28, height: 28, flexShrink: 0, background: COLORS.marigold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: COLORS.ink }}>⬡</div>
                  <div style={{ padding: "12px 16px", background: COLORS.ink, color: COLORS.marigold, fontSize: 13 }}>Thinking...</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 3 }}>
              <input
                value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAI()}
                placeholder="Ask anything about the Hive, your growth, or a competency..."
                style={{ flex: 1, padding: "12px 16px", border: `1px solid ${COLORS.stone}`, background: COLORS.parch, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, outline: "none" }}
              />
              <button onClick={sendAI} disabled={aiLoading || !aiInput.trim()} style={{
                padding: "12px 24px", background: aiLoading || !aiInput.trim() ? COLORS.stone : COLORS.marigold,
                color: COLORS.ink, border: "none", cursor: aiLoading ? "wait" : "pointer",
                fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Syne', sans-serif",
              }}>Send</button>
            </div>
          </div>
        )}

        {/* ══════════════ SUBMIT VIEW ══════════════ */}
        {view === "submit" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: COLORS.mist, marginBottom: 6 }}>Share what's working</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: -1.5, margin: 0 }}>
                Add to the <span style={{ color: COLORS.marigold }}>library.</span>
              </h2>
              <p style={{ fontSize: 14, color: COLORS.mist, marginTop: 8 }}>Found something that genuinely helped you? Submit it. All resources are reviewed by a Hive admin before going live.</p>
            </div>

            {submitted && (
              <div style={{ background: COLORS.herb, color: "#fff", padding: "12px 20px", marginBottom: 20, fontSize: 14 }}>
                ✓ Submitted! Your resource is under review and will be live once approved.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { label: "Resource Title", key: "title", placeholder: "What is it called?", type: "text" },
                { label: "URL", key: "url", placeholder: "https://...", type: "url" },
                { label: "Your Name or Handle", key: "submittedBy", placeholder: "Who's submitting this?", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.mist, marginBottom: 4 }}>{f.label}</div>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.mist, marginBottom: 4 }}>Resource Type</div>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink }}>
                    {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.mist, marginBottom: 4 }}>Competency</div>
                  <select value={form.competency} onChange={e => setForm({ ...form, competency: e.target.value })} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink }}>
                    {COMPETENCIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: COLORS.mist, marginBottom: 4 }}>Why does this belong in the Hive?</div>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  placeholder="A short description of what this resource is and why it's valuable for educators..."
                  style={{ width: "100%", padding: "10px 14px", border: `1px solid ${COLORS.stone}`, background: COLORS.sand, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              <button onClick={submitResource} style={{
                padding: "13px 32px", background: COLORS.marigold, color: COLORS.ink, border: "none", cursor: "pointer",
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 0.5, marginTop: 8,
              }}>
                Submit for Review →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════ ADMIN VIEW ══════════════ */}
        {view === "admin" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: -1.5, margin: 0 }}>
                Admin <span style={{ color: COLORS.marigold }}>Queue.</span>
              </h2>
              <p style={{ fontSize: 14, color: COLORS.mist, marginTop: 8 }}>
                {pending.length === 0 ? "Queue is clear. The village is well-tended." : `${pending.length} resource${pending.length !== 1 ? "s" : ""} pending review.`}
              </p>
            </div>

            {pending.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: COLORS.mist }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>All clear.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {pending.map(r => {
                  const c = comp(r.competency);
                  return (
                    <div key={r.id} style={{ background: COLORS.sand, padding: "20px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", background: c?.color, color: r.competency === "curriculum" || r.competency === "wellness" ? COLORS.parch : COLORS.ink }}>{c?.label}</span>
                          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: `1px solid ${COLORS.stone}`, color: COLORS.mist }}>{r.type}</span>
                        </div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: COLORS.mist, marginBottom: 6 }}>{r.description}</div>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: COLORS.marigold }}>{r.url}</a>
                        <div style={{ fontSize: 11, color: COLORS.stone, marginTop: 4 }}>Submitted by: {r.submittedBy}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => approveResource(r)} style={{ padding: "8px 16px", background: COLORS.herb, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✓ Approve</button>
                        <button onClick={() => rejectResource(r.id)} style={{ padding: "8px 16px", background: "transparent", color: COLORS.chili, border: `1px solid ${COLORS.chili}`, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕ Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${COLORS.stone}` }}>
              <div style={{ fontSize: 12, color: COLORS.mist, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Library Stats</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {[
                  { label: "Approved Resources", value: resources.filter(r => r.approved).length },
                  { label: "Pending Review", value: pending.length },
                  { label: "Total Saves", value: resources.filter(r => r.approved).reduce((a, r) => a + r.bookmarks, 0) },
                  ...COMPETENCIES.map(c => ({ label: c.label, value: resources.filter(r => r.competency === c.id && r.approved).length })),
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: COLORS.sand, padding: "16px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: COLORS.marigold }}>{s.value}</div>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.mist, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${COLORS.stone}`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 40 }}>
        <span style={{ fontSize: 10, color: COLORS.stone, letterSpacing: 2, textTransform: "uppercase" }}>The Hive Discovery — Resource Library</span>
        <span style={{ fontSize: 10, color: COLORS.stone, letterSpacing: 2, textTransform: "uppercase" }}>Brim & Bold Creative</span>
      </footer>
    </div>
  );
}
