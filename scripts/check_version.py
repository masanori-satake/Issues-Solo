import json
import sys

def check_version_consistency():
    try:
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)
            manifest_version = manifest.get('version')

        with open('package.json', 'r') as f:
            package = json.load(f)
            package_version = package.get('version')

        if manifest_version != package_version:
            print(f"Error: Version mismatch! manifest.json: {manifest_version}, package.json: {package_version}")
            return False

        print(f"Version consistency check passed: {manifest_version}")
        return True
    except Exception as e:
        print(f"Error checking versions: {e}")
        return False

if __name__ == "__main__":
    if not check_version_consistency():
        sys.exit(1)
