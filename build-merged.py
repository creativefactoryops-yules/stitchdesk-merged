#!/usr/bin/env python3
"""Build the merged Stitch Voice Chat voice app for Vercel.

Base: stitch-bot-fix/index-fixed.html (cleanest stitch-bot source + corrected RAG patch).
Merges in (from the voice audit):
  - Real brain already in base patch (ask-stitch first, Ollama, canned labelled OFFLINE BRAIN)
  - /api/ask-stitch tried FIRST (Vercel), /.netlify/functions/ask-stitch second (Netlify)
    so the same file works on both hosts.
  - Honest copy: 1247 -> 80 Truper chunks (real count in truper-chunks.json),
    offline fallback says "built-in replies" (true), Library header drops the false count.
  - Pricing: the one "$29" string -> "$20/mo, 14-day free trial".
  - RAG status: Xl() now shows model + chunk count from the function response.
  - AR card: already in base (85.6mm ref, estimator + glossary) — nothing to port.
  - Aria: LISTEN button gets an aria-label (only if a clean anchor is found).
Outputs: index.html in the merged folder. Verifies with node --check on the
extracted main script afterwards (separate step — this script only patches).
"""
import re, sys, os

SRC = '/home/hatch/workspace/goals/stitchdesk-relaunch/files/stitch-bot-fix/index-fixed.html'
OUTDIR = '/home/hatch/workspace/goals/stitchdesk-relaunch/files/stitchdesk-merged-vercel'
OUT = os.path.join(OUTDIR, 'index.html')

h = open(SRC, encoding='utf-8', errors='replace').read()
orig_len = len(h)

def rep(old, new, count=1, must=1):
    global h
    n = h.count(old)
    assert n >= must, f'NOT FOUND ({n}x): {old[:120]!r}'
    if count == 0:
        h = h.replace(old, new)
        print(f'replaced ALL ({n}x): {old[:80]!r} -> {new[:80]!r}')
    else:
        assert n == count, f'expected {count}x, found {n}x: {old[:120]!r}'
        h = h.replace(old, new)
        print(f'replaced {n}x: {old[:80]!r} -> {new[:80]!r}')

# 1. Pricing: the single $29 string.
rep('Free today then $29/mo', 'Free 14 days, then $20/mo')

# 2. Honest chunk counts (both occurrences: glossary def + canned intro).
rep('1247 chunks of shop knowledge', '80 Truper chunks of shop knowledge', count=0, must=2)

# 3. Offline fallback is canned replies, not chunks.
rep('using built-in 1247 chunks', 'using built-in replies')

# 4. Library header drops the false count.
rep('Library — Underground Lingo • 1247 chunks', 'Library — Underground Lingo')

# 5. Docs fallback line.
rep('fallback to built-in 1247 chunks', 'fallback to built-in replies')

# 6. Fr(): try /api/ask-stitch (Vercel) first, then /.netlify/functions/ask-stitch.
old_fetch = ('let Me=await fetch("/.netlify/functions/ask-stitch",{method:"POST",'
    'headers:{"Content-Type":"application/json"},'
    'body:JSON.stringify({question:K,dims:"W"+c+" D"+E+" H"+O+" (estimator sliders, unconfirmed unless customer stated them)",'
    'yardage:Qe,total:String(ju),fabric:zu})});'
    'if(Me.ok){let Zu=await Me.json();if(Zu.answer){'
    'k((Jp)=>[...Jp,{role:"stitch",text:Zu.answer,time:V}]),Dl(Zu.answer),Xl("GEMINI");return}}'
    'throw Error("gemini offline")')
new_fetch = ('let Me=null;for(const ep of["/api/ask-stitch","/.netlify/functions/ask-stitch"])'
    '{try{Me=await fetch(ep,{method:"POST",'
    'headers:{"Content-Type":"application/json"},'
    'body:JSON.stringify({question:K,dims:"W"+c+" D"+E+" H"+O+" (estimator sliders, unconfirmed unless customer stated them)",'
    'yardage:Qe,total:String(ju),fabric:zu})});if(Me&&Me.ok)break}catch(e){Me=null}}'
    'if(Me&&Me.ok){let Zu=await Me.json();if(Zu.answer){'
    'k((Jp)=>[...Jp,{role:"stitch",text:Zu.answer,time:V}]),Dl(Zu.answer),'
    'Xl("GEMINI - "+(Zu.model||"gemini")+" - "+(Zu.chunks?Zu.chunks.length:0)+" Truper chunks");return}}'
    'throw Error("gemini offline")')
rep(old_fetch, new_fetch)

# 7. Aria on the LISTEN button — only if a clean anchor exists.
m = re.search(r'(<button[^>]*>LISTEN</button>)', h)
if m:
    print('LISTEN button found as plain HTML, adding aria-label')
    h = h.replace(m.group(1), m.group(1).replace('<button', '<button aria-label="Listen - speak your question"', 1))
else:
    # Minified React: look for the LISTEN text node in a button-ish construct.
    m2 = re.search(r'children:"[^"]*LISTEN[^"]*"', h)
    if m2:
        print('LISTEN is a React text node, no clean aria anchor — leaving as is (base already has aria-labels elsewhere)')
    else:
        print('No LISTEN anchor found — skipping aria step')

# Safety: no 1247 / $29 / 1,247 left (except per-file demo "N chunks indexed" which are small real-looking sample stats).
left_1247 = [mm for mm in re.finditer(r'1,?247', h)]
assert not left_1247, f'1247 remains: {[h[max(0,mm.start()-60):mm.start()+60] for mm in left_1247]}'
assert '$29' not in h, '$29 remains'
assert 'built-in 1247' not in h
print('safety checks passed: no 1247, no $29 left')

os.makedirs(OUTDIR, exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(h)
print(f'wrote {OUT}: {orig_len} -> {len(h)} chars')
