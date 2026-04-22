import json
import sys
import re

def check_version_consistency():
    try:
        # manifest.json
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)
            manifest_version = manifest.get('version')

        # package.json
        with open('package.json', 'r') as f:
            package = json.load(f)
            package_version = package.get('version')

        # package-lock.json
        with open('package-lock.json', 'r') as f:
            package_lock = json.load(f)
            package_lock_version = package_lock.get('version')
            package_lock_root_version = package_lock.get('packages', {}).get('', {}).get('version')

        # README.md (Badge)
        with open('README.md', 'r') as f:
            readme_content = f.read()
            # Extract version from [![version](https://img.shields.io/badge/version-X.Y.Z-blue)](manifest.json)
            readme_match = re.search(r'\[!\[version\]\(https://img.shields.io/badge/version-([\d\.]+)-blue\)\]', readme_content)
            readme_version = readme_match.group(1) if readme_match else None

        versions = {
            'manifest.json': manifest_version,
            'package.json': package_version,
            'package-lock.json (root)': package_lock_version,
            'package-lock.json (packages[""])': package_lock_root_version,
            'README.md (badge)': readme_version
        }

        mismatch = False
        base_version = package_version

        print("Checking versions...")
        for name, version in versions.items():
            if version != base_version:
                print(f"Error: Version mismatch! {name}: {version} (expected: {base_version})")
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
