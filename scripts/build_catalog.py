import json
from pathlib import Path

root = Path("notebooks")

units = []

for folder in root.iterdir():

    if not folder.is_dir():
        continue

    lessons = []

    for nb in sorted(folder.glob("*.ipynb")):

        lessons.append({
            "title": nb.stem.replace("_", " ").title(),
            "file": str(nb.relative_to(root))
        })

    units.append({
        "name": folder.name.replace("_", " ").title(),
        "slug": folder.name,
        "lessons": lessons
    })

Path("data").mkdir(exist_ok=True)

with open("site/data/catalog.json", "w") as f:
    json.dump({"units": units}, f, indent=2)