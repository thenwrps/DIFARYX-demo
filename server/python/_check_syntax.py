import ast
import sys

files = [
    "xrd_engine/services/xrd_engine.py",
    "api/schemas.py",
    "api/gateway.py",
]

ok = True
for f in files:
    try:
        with open(f) as fh:
            ast.parse(fh.read())
        print(f"OK: {f}")
    except SyntaxError as e:
        print(f"FAIL: {f} — {e}")
        ok = False

sys.exit(0 if ok else 1)