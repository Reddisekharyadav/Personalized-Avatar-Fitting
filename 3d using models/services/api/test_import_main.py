import traceback
import sys

try:
    import main
    print('main imported ok')
except Exception:
    traceback.print_exc()
    sys.exit(1)
