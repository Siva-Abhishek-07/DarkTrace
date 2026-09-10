import sys
import os

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import Entity.app as entity_module
app = entity_module.app

if __name__ == "__main__":
    use_https = os.environ.get("USE_HTTPS", "").lower() in ("1", "true", "yes")
    ssl_context = "adhoc" if use_https else None
    print(f"Starting server... HTTPS={'ON' if use_https else 'OFF'}")
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=True, ssl_context=ssl_context)
