from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    sample_path = Path(__file__).with_name("sample_events.json")
    events = json.loads(sample_path.read_text(encoding="utf-8"))
    print(f"Loaded {len(events)} sample events")
    print("Use the API and UI to review candidate alarm groups.")


if __name__ == "__main__":
    main()
