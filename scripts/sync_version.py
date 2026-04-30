import json
import re
import os
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

        # 2. Update metadata.json (Single Source of Truth for extension name)
        metadata_path = "projects/app/metadata.json"
        new_ext_name = f"Issues-Solo v{version}"
        metadata = {"extName": new_ext_name}

        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  Updated {metadata_path}")

        # 3. Update manifest.json
        manifest_path = "projects/app/manifest.json"
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        if manifest.get("version") != version:
            manifest["version"] = version
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"  Updated {manifest_path}")

        # 4. Update extName in all messages.json files from metadata.json
        locales_dir = "projects/app/_locales"
        for lang in os.listdir(locales_dir):
            msg_path = os.path.join(locales_dir, lang, "messages.json")
            if os.path.exists(msg_path):
                with open(msg_path, "r", encoding="utf-8") as f:
                    messages = json.load(f)

                if messages.get("extName", {}).get("message") != new_ext_name:
                    if "extName" not in messages:
                        messages["extName"] = {}
                    messages["extName"]["message"] = new_ext_name
                    with open(msg_path, "w", encoding="utf-8") as f:
                        json.dump(messages, f, indent=2, ensure_ascii=False)
                        f.write("\n")
                    print(f"  Updated {msg_path}")

        # 5. Update README.md badge
        readme_path = "README.md"
        with open(readme_path, "r", encoding="utf-8") as f:
            readme_content = f.read()

        # [![version](https://img.shields.io/badge/version-X.Y.Z-blue)](manifest.json)
        new_readme_content = re.sub(
            r"\[!\[version\]\(https://img.shields.io/badge/version-[\d\.]+-blue\)\]",
            f"[![version](https://img.shields.io/badge/version-{version}-blue)]",
            readme_content
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
