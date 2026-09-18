import os
import time
from engine import compress_image

test_files = [
    'loool.png',
    'll.png',
    'ksjs.png',
    'jjhhgi.jpg',
    'lll.jpg',
    'ChatGPT Image Aug 30, 2026, 12_34_05 AM.png'
]

print("-" * 85)
print(f"{'FILE':45} | {'ORIGINAL':>10} | {'COMPRESSED':>10} | {'SAVED':>7} | {'TIME':>5}")
print("-" * 85)

for name in test_files:
    path = os.path.join(r'C:\Users\pc\Downloads', name)
    if not os.path.exists(path):
        continue
    with open(path, 'rb') as f:
        raw = f.read()
    t0 = time.time()
    res, fmt, _ = compress_image(raw, level='high')
    dt = round(time.time() - t0, 2)
    saved = round((len(raw) - len(res)) / len(raw) * 100, 1)
    orig_kb = f"{round(len(raw) / 1024, 1)} KB"
    comp_kb = f"{round(len(res) / 1024, 1)} KB"
    print(f"{name:45} | {orig_kb:>10} | {comp_kb:>10} | {saved:>6}% | {dt:>4}s")

print("-" * 85)
