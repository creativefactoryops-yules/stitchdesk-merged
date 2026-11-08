// ask-stitch — Vercel serverless function for the merged Stitch Voice Chat voice app.
// Truper + Gemini brain. GEMINI_API_KEY comes from the Vercel project env only.
// Never hardcode a key here, never accept one from the browser.
// Flow: POST {question, dims, yardage, total, fabric}
//   -> score truper-chunks.json by keyword overlap, take top 5
//   -> call Gemini (x-goog-api-key header; AQ. keys only work that way)
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
  try {
    const raw = fs.readFileSync(path.join(__dirname, "truper-chunks.json"), "utf8");
    CHUNKS = JSON.parse(raw);
  } catch (e) {
    CHUNKS = [];
  }
  // Inverse document frequency: generic words ("upholstery", "customer",
  // "furniture") appear in almost every chunk and must not win retrieval.
  const df = {};
  for (const c of CHUNKS) {
    for (const w of new Set(tokens(c.title + " " + c.text))) {
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
    const cSet = new Set(tokens(c.text));
    let score = 0;
    for (const w of q) {
      const idf = IDF[w] || 1;
      if (titleSet.has(w)) score += idf * 3; // title match weighs most
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

async function callGemini(model, apiKey, prompt) {
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
      contents: [{ parts: [{ text: prompt }] }],
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

  const top = pickChunks(question, 5);
  const context =
    top.length > 0
      ? top
          .map((c) => "[" + c.label + " / " + c.title + " / " + c.source + "]\n" + c.text)
          .join("\n\n")
      : "(No Truper chunk matched this question — answer only from the estimator numbers below, and say so if you do not know.)";

  const prompt =
    "You are Stitch, copper robot CR-7, Toronto upholstery master at Stitch Voice Chat by CreativeFactory.studio. " +
    "Answer the customer in 2-4 short spoken sentences, plain words, no markdown, no asterisks, no bullet lists — the answer will be read aloud by speech synthesis.\n\n" +
    "HARD RULES — never break these:\n" +
    "1. NEVER invent dimensions, yardage, or prices. The estimator is the only source of numbers:\n" +
    "   dims (W x D x H inches) = " + dims + "; yardage = " + yardage + " yd; total estimate = $" + total + "; fabric = " + fabric + ".\n" +
    "   These are estimator slider values, NOT measurements the customer gave — treat them as unconfirmed defaults.\n" +
    "   If the customer asks a price and no total was calculated, say the total is not calculated yet and ask for W/D/H — do not guess a dollar figure.\n" +
    "   If a dimension was not given, say so — do not reuse default slider numbers as if the customer gave them.\n" +
    "2. Use ONLY the Truper knowledge below for facts (prices, suppliers, materials, methods). If the knowledge does not cover it, say 'I do not know that from the shop book' and give the closest thing you do know.\n" +
    "3. Keep supplier names, phone numbers, and technical terms exactly as written in the knowledge.\n\n" +
    "TRUPER KNOWLEDGE (top matches):\n" + context + "\n\n" +
    "CUSTOMER QUESTION: " + question + "\n\n" +
    "Answer as Stitch, in your shop voice:";

  let lastErr = null;
  for (const model of MODELS) {
    try {
      let answer = await callGemini(model, apiKey, prompt);
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
