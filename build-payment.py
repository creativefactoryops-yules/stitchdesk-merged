#!/usr/bin/env python3
"""Payment v1 for the merged Stitch Voice Chat voice app: $29/mo, 14-day free trial.
- Price: activation toast $20 -> $29.
- Status pill: drop the stale "Ollama " prefix (children:["Ollama ",It] -> [It]).
- Footer + referral links: stitchdesk-buildyou.netlify.app -> stitchdesk-merged.vercel.app.
- Inject payment-overlay.html (trial gate + subscribe panel, vanilla JS,
  outside the React root) before </body>.
DROPPED (audit details that are NOT in the deployed source — see
FULL-AUDIT-2026-11-07.md correction): Library "$29.00", quote totals,
Docs contradiction, $43B figure, supplier-gibberish fixes.
"""
import os, re

D = '/home/hatch/workspace/goals/stitchdesk-relaunch/files/stitchdesk-merged-vercel'
SRC = os.path.join(D, 'index.html')
OVERLAY = os.path.join(D, 'payment-overlay.html')

h = open(SRC, encoding='utf-8', errors='replace').read()
orig_len = len(h)

def rep(old, new, count=1, must=1):
    global h
    n = h.count(old)
    assert n >= must, f'NOT FOUND ({n}x): {old[:100]!r}'
    if count == 0:
        h = h.replace(old, new)
        print(f'replaced ALL ({n}x): {old[:70]!r} -> {new[:70]!r}')
    else:
        assert n == count, f'expected {count}x, found {n}x: {old[:100]!r}'
        h = h.replace(old, new)
        print(f'replaced {n}x: {old[:70]!r} -> {new[:70]!r}')

# 1. Price $20 -> $29 in the activation toast.
rep('Free 14 days, then $20/mo', 'Free 14 days, then $29/mo')

# 2. Status pill: drop stale "Ollama " prefix.
rep('children:["Ollama ",It]', 'children:[It]')

# 3. Footer + referral links -> live Vercel URL.
rep('stitchdesk-buildyou.netlify.app', 'stitchdesk-merged.vercel.app', count=0, must=6)

# 4. Inject the subscription overlay before </body>.
overlay = open(OVERLAY, encoding='utf-8').read()
assert 'stitchdesk_voice_sub_v1' in overlay
assert overlay not in h, 'overlay already injected?'
assert h.count('</body>') == 1, f"</body> count: {h.count('</body>')}"
h = h.replace('</body>', overlay + '\n</body>')
print('overlay injected')

# Safety: no $20/mo price left, no Ollama pill prefix, no old domain.
assert 'then $20/mo' not in h, '$20 price remains'
assert 'children:["Ollama ",It]' not in h, 'pill prefix remains'
assert 'stitchdesk-buildyou.netlify.app' not in h, 'old domain remains'
assert '$29/mo' in h or 'then $29/mo' in h, 'new price missing'
print('safety checks passed')

open(SRC, 'w', encoding='utf-8').write(h)
print(f'wrote {SRC}: {orig_len} -> {len(h)} chars')
