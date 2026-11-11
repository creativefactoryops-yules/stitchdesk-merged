// ask-stitch — Vercel serverless function for the merged Stitch Voice Chat voice app.
// Truper + Gemini brain. GEMINI_API_KEY comes from the Vercel project env only.
// Never hardcode a key here, never accept one from the browser.
// Flow: POST {question, dims, yardage, total, fabric, history, job}
//   -> score truper-chunks.json + kb/stitch-kb-all.json by keyword overlap
//      (title x3, aliases x2, text x1), take top 7
//   -> call Gemini (x-goog-api-key header; AQ. keys only work that way)
//      with the job sheet + KB chunks in the system instruction and the
//      conversation history as real alternating turns, new question last
//   -> return {answer, source, model, chunks}
// On any Gemini failure: return 502 so the page falls back to local
// Ollama, then to its canned yu() replies (labelled honestly on the page).
// Node 18+ on Vercel: global fetch, no dependencies.
// Same retrieval + prompt as the Netlify version; only the handler shape differs.

const fs = require("fs");
const path = require("path");

const MODELS = [
  // Proven 2026-11-07 against the stored custom.gemini key: ONLY
  // gemini-flash-lite-latest answers. gemini-2.5-flash, gemini-2.5-flash-lite
  // and gemini-2.0-flash are 404 "no longer available"; gemini-3.8-flash and
  // gemini-flash-latest HANG (90s timeout, twice). Order matters: a hanging
  // model tried first would burn the whole function timeout, so the proven
  // model goes first and 2.5-flash is kept only because it fails FAST (404).
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];

const STOP = new Set(
  "a,an,the,and,or,of,to,in,on,for,what,how,much,does,do,is,it,i,my,me,you,your,we,can,could,should,would,will,with,from,about,please,tell,give,get,have,has,need,want,like,this,that,there,here,are,was,were,be,been,am,so,by,at,as,not,no,yes,if,then,than,when,why,who,whom,which,all,any,more,most,some,only,just,very,also,into,over,under,per,us,our,they,their,he,she,her,his,its".split(",")
);

let CHUNKS = null;
let IDF = null;
function loadChunks() {
  if (CHUNKS) return CHUNKS;
  let truper = [];
  try {
    truper = JSON.parse(fs.readFileSync(path.join(__dirname, "truper-chunks.json"), "utf8"));
  } catch (e) {
    truper = [];
  }
  let kb = [];
  try {
    kb = JSON.parse(fs.readFileSync(path.join(__dirname, "kb", "stitch-kb-all.json"), "utf8"));
  } catch (e) {
    kb = [];
  }
  // Normalize the v2 shop-book chunks to the same shape as the truper
  // chunks: label = topic, source = "shop book", aliases kept for scoring.
  kb = kb.map((c) => ({
    id: c.id,
    label: c.topic || "shop book",
    title: c.title || "",
    aliases: Array.isArray(c.aliases) ? c.aliases : [],
    source: "shop book",
    text: c.text || "",
  }));
  CHUNKS = truper.concat(kb);
  // Inverse document frequency: generic words ("upholstery", "customer",
  // "furniture") appear in almost every chunk and must not win retrieval.
  const df = {};
  for (const c of CHUNKS) {
    const aliasText = (c.aliases || []).join(" ");
    for (const w of new Set(tokens(c.title + " " + aliasText + " " + c.text))) {
      df[w] = (df[w] || 0) + 1;
    }
  }
  const n = Math.max(1, CHUNKS.length);
  IDF = {};
  for (const w of Object.keys(df)) IDF[w] = Math.log(n / df[w]) + 1;
  return CHUNKS;
}

function norm(w) {
  if (w === "yardage" || w === "yards") return "yard";
  if (w === "pricing" || w === "prices") return "price";
  if (w === "costs") return "cost";
  if (w === "fabrics") return "fabric";
  if (w === "materials") return "material";
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

function tokens(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(norm);
}

function pickChunks(question, n) {
  const q = [...new Set(tokens(question))];
  const scored = loadChunks().map((c) => {
    const titleSet = new Set(tokens(c.title));
    const aliasSet = new Set(tokens((c.aliases || []).join(" ")));
    const cSet = new Set(tokens(c.text));
    let score = 0;
    for (const w of q) {
      const idf = IDF[w] || 1;
      if (titleSet.has(w)) score += idf * 3; // title match weighs most
      else if (aliasSet.has(w)) score += idf * 2; // alias = another name for it
      else if (cSet.has(w)) score += idf;
    }
    // Small bonuses for question-type signals.
    const low = (question || "").toLowerCase();
    if (low.includes("price") || low.includes("cost") || low.includes("$")) {
      if (/price|cost|\$|yard|labou?r|quote/i.test(c.text)) score += 2;
    }
    if (/supplier|king|spadina|markham|gta|shop|store/i.test(low)) {
      if (c.label === "Suppliers") score += 3;
    }
    if (/foam|fabric|vinyl|leather|thread|zipper|marine|auto/i.test(low)) {
      if (c.label === "Techniques & Materials") score += 1;
    }
    return { chunk: c, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.chunk);
}

// Turn the browser's history [{role: "user"|"model", text}] into Gemini
// contents: strictly alternating turns, starting with a user turn.
function toTurns(history) {
  const turns = [];
  for (const m of Array.isArray(history) ? history : []) {
    if (!m || typeof m.text !== "string" || !m.text.trim()) continue;
    const role = m.role === "model" ? "model" : "user";
    const text = m.text.trim().slice(0, 1500);
    if (turns.length && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += "\n" + text;
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  }
  // Gemini contents must start with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

// The job sheet is what the customer actually said. Every number in it
// is customer-given; anything not in it was never stated.
function fmtJob(job) {
  const j = job && typeof job === "object" ? job : {};
  const dim = (v) => (v == null || v === "" ? "not given" : v + " (customer said it)");
  return [
    "piece: " + (j.piece || "not given"),
    "width: " + dim(j.width),
    "depth: " + dim(j.depth),
    "height: " + dim(j.height),
    "units: " + (j.units || "not given"),
    "fabric: " + (j.fabric || "not given"),
    "notes: " + (j.notes || "none"),
  ].join("\n");
}

// Approximate yardage from the customer's own numbers, using the shop
// formula. The model quotes this number; it must not parrot the slider
// yardage or do the arithmetic itself.
function yardageFromJob(job) {
  const j = job && typeof job === "object" ? job : {};
  const w = parseFloat(j.width), d = parseFloat(j.depth), h = parseFloat(j.height);
  if (!isFinite(w) || !isFinite(d) || !isFinite(h)) return null;
  let W = w, D = d;
  if (j.units === "cm") { W = w / 2.54; D = d / 2.54; }
  return ((W + D * 2 + 12) / 36 * 2.5 + 2).toFixed(1);
}

async function callGemini(model, apiKey, systemText, contents) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model +
    ":generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    // A hanging model must not burn the whole serverless timeout (10s on
    // Vercel Hobby): fail the attempt after 8s and let the rotation move on.
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(model + " -> HTTP " + res.status + " " + body.slice(0, 200));
  }
  const data = await res.json();
  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error(model + " -> empty reply");
  return text;
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(502).json({ error: "GEMINI_API_KEY not set in Vercel env" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: "bad JSON body" });
    }
  }
  const question = String(body.question || "").trim();
  if (!question) {
    return res.status(400).json({ error: "question required" });
  }

  const dims = body.dims || "not given";
  const yardage = body.yardage || "not calculated";
  const total = body.total || "not calculated";
  const fabric = body.fabric || "not chosen";
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const job = body.job && typeof body.job === "object" ? body.job : {};
  const jobYardage = yardageFromJob(job);

  const top = pickChunks(question, 7);
  const context =
    top.length > 0
      ? top
          .map((c) => "[" + c.label + " / " + c.title + " / " + c.source + "]\n" + c.text)
          .join("\n\n")
      : "(No shop book chunk matched this question — answer only from the job sheet and estimator numbers below, and say so if you do not know.)";

  const turns = toTurns(history);
  turns.push({ role: "user", parts: [{ text: question }] });

  const systemText =
    "You are Stitch, copper robot CR-7, Toronto upholstery master at Stitch Voice Chat by CreativeFactory.studio. " +
    "Answer the customer in 2-4 short spoken sentences, plain words, no markdown, no asterisks, no bullet lists — the answer will be read aloud by speech synthesis.\n\n" +
    "HARD RULES — never break these:\n" +
    "1. Introduce yourself only if the conversation history is empty. Never repeat the intro. " +
    "The customer was already greeted in this chat with \"Hi, I'm Stitch. Tell me what you'd like reupholstered, and the width, depth and height if you have them.\" — that greeting counts as your introduction, so do not introduce yourself again.\n" +
    "2. Read the job sheet and the history before answering. Never ask for something the customer already gave. Show you remember the job: if the job sheet names a piece, begin your reply by naming it (for example, 'For your sofa, ...').\n" +
    "3. Answer the customer's actual message first, in 2 to 4 short sentences.\n" +
    "4. If units are unclear, ask once: inches or cm? Do not state a unit until the customer confirms it.\n" +
    "5. Ask for one missing thing at a time (for example height), and say why you need it.\n" +
    "6. Write numbers as digits (75 in, 45 in). Never spell them out.\n" +
    "7. Never mention chunks, lot numbers, reference sizes like 85.6mm, or internal names. Plain shop talk only.\n" +
    "8. Never invent dimensions, yardage, or prices. The job sheet below is what the customer actually said — use those numbers first. " +
    "The estimator values below are slider defaults, NOT measurements the customer gave. " +
    "If a dimension was not given, say so — do not reuse slider numbers as if the customer gave them. " +
    "If the customer asks a price and no total was calculated, say the total is not calculated yet and ask for W/D/H — do not guess a dollar figure.\n" +
    "9. Yardage: the yardage from the job sheet is computed for you below with the shop formula (W + D x 2 + 12) / 36 x 2.5 + 2 yd boost — quote that number, and state the full W/D/H in your reply. Do not use the slider yardage. Always call the yardage approximate and say to verify with tape.\n" +
    "10. Use ONLY the shop book knowledge below for facts (prices, suppliers, materials, methods). If the knowledge does not cover it, say 'I do not know that from the shop book' and give the closest thing you do know.\n" +
    "11. Keep supplier names, phone numbers, and technical terms exactly as written in the knowledge.\n" +
    "12. Use the shop book chunks. Terms have several names: mention the common alternatives. Never invent prices: quote only the shop's own estimator or price sheet, and label anything else as a rough range the shop must confirm. Legends are 'traditionally said'. Fire-code or legal questions go to shop staff.\n" +
    "\nJOB SHEET (what the customer has told you so far):\n" + fmtJob(job) + "\n\n" +
    "YARDAGE FROM THE JOB SHEET (shop formula, approximate): " + (jobYardage ? jobYardage + " yd — quote this number when the customer asks for yardage." : "not computable yet — a dimension is still missing.") + "\n\n" +
    "ESTIMATOR (slider values — unconfirmed defaults, not customer measurements):\n" +
    "dims (W x D x H) = " + dims + "; yardage = " + yardage + " yd; total estimate = $" + total + "; fabric = " + fabric + ".\n\n" +
    "SHOP BOOK KNOWLEDGE (top matches):\n" + context;

  let lastErr = null;
  for (const model of MODELS) {
    try {
      let answer = await callGemini(model, apiKey, systemText, turns);
      answer = answer.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim().slice(0, 900);
      return res.status(200).json({
        answer,
        source: "gemini",
        model,
        chunks: top.map((c) => c.id),
      });
    } catch (e) {
      lastErr = e;
    }
  }
  return res.status(502).json({
    error: "Gemini unavailable: " + String((lastErr && lastErr.message) || lastErr).slice(0, 300),
  });
};
