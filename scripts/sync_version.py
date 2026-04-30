import json
import re
import sys


def sync_version():
    try:
        # 1. Read version from package.json
        with open("package.json", "r", encoding="utf-8") as f:
            package = json.load(f)
            version = package.get("version")

        if not version:
            print("Error: Version not found in package.json")
            return False

        print(f"Syncing version {version}...")

        # 2. Update manifest.json
        manifest_path = "projects/app/manifest.json"
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        if manifest.get("version") != version:
            manifest["version"] = version
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"  Updated {manifest_path}")

        # 3. Update README.md badge
        readme_path = "README.md"
        with open(readme_path, "r", encoding="utf-8") as f:
            readme_content = f.read()

        # [![version](https://img.shields.io/badge/version-X.Y.Z-blue)](manifest.json)
        new_readme_content = re.sub(
            r"\[!\[version\]\(https://img.shields.io/badge/version-[\d\.]+-blue\)\]",
            f"[![version](https://img.shields.io/badge/version-{version}-blue)]",
            readme_content,
        )

        if new_readme_content != readme_content:
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(new_readme_content)
            print(f"  Updated {readme_path}")

        print("Version synchronization complete.")
        return True

    except Exception as e:
        print(f"Error syncing version: {e}")
        return False


if __name__ == "__main__":
    if not sync_version():
        sys.exit(1)
