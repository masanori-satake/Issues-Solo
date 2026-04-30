import json
import sys
import re
import os


def check_version_consistency():
    try:
        # package.json (Base Version)
        with open("package.json", "r") as f:
            package = json.load(f)
            base_version = package.get("version")

        # manifest.json
        with open("projects/app/manifest.json", "r") as f:
            manifest = json.load(f)
            manifest_version = manifest.get("version")

        # package-lock.json
        with open("package-lock.json", "r") as f:
            package_lock = json.load(f)
            package_lock_version = package_lock.get("version")
            package_lock_root_version = (
                package_lock.get("packages", {}).get("", {}).get("version")
            )

        # metadata.json (SSoT for extension name)
        metadata_version = None
        metadata_path = "projects/app/metadata.json"
        if os.path.exists(metadata_path):
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
                ext_name = metadata.get("extName", "")
                match = re.search(r"v([\d\.]+)", ext_name)
                metadata_version = match.group(1) if match else None

        # messages.json (extName in all locales)
        locales_dir = "projects/app/_locales"
        messages_versions = {}
        for lang in os.listdir(locales_dir):
            msg_path = os.path.join(locales_dir, lang, "messages.json")
            if os.path.exists(msg_path):
                with open(msg_path, "r", encoding="utf-8") as f:
                    messages = json.load(f)
                    ext_name_msg = messages.get("extName", {}).get("message")
                    if ext_name_msg:
                        match = re.search(r"v([\d\.]+)", ext_name_msg)
                        messages_versions[f"messages.json ({lang})"] = (
                            match.group(1) if match else None
                        )
                    else:
                        messages_versions[f"messages.json ({lang})"] = None

        # README.md (Badge)
        readme_version = None
        with open("README.md", "r") as f:
            readme_content = f.read()
            # [![version](https://img.shields.io/badge/version-X.Y.Z-blue)](manifest.json)
            readme_match = re.search(
                r"\[!\[version\]\(https://img.shields.io/badge/version-([\d\.]+)-blue\)\]",
                readme_content,
            )
            readme_version = readme_match.group(1) if readme_match else None

        versions = {
            "manifest.json": manifest_version,
            "package.json": base_version,
            "package-lock.json (root)": package_lock_version,
            'package-lock.json (packages[""])': package_lock_root_version,
            "README.md (badge)": readme_version,
            "metadata.json": metadata_version,
        }
        versions.update(messages_versions)

        mismatch = False

        print("Checking versions...")
        for name, version in versions.items():
            if version != base_version:
                print(
                    f"Error: Version mismatch! {name}: {version} (expected: {base_version})"
                )
                mismatch = True
            else:
                print(f"  - {name}: {version} OK")

        if mismatch:
            return False

        print(f"\nVersion consistency check passed: {base_version}")
        return True
    except Exception as e:
        print(f"Error checking versions: {e}")
        return False


if __name__ == "__main__":
    if not check_version_consistency():
        sys.exit(1)
