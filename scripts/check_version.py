import json
import sys
import os

def check_version():
    try:
        # Load version from package.json
        if not os.path.exists('package.json'):
            print("Error: package.json is missing.")
            return False
        with open('package.json', 'r') as f:
            package_version = json.load(f).get('version')

        # Load version from package-lock.json
        if not os.path.exists('package-lock.json'):
            print("Error: package-lock.json is missing.")
            return False
        with open('package-lock.json', 'r') as f:
            lock_version = json.load(f).get('version')

        # Load version from manifest.json
        if not os.path.exists('manifest.json'):
            print("Error: manifest.json is missing.")
            return False
        with open('manifest.json', 'r') as f:
            manifest_version = json.load(f).get('version')

        if not package_version:
            print("Error: package.json is missing version field.")
            return False

        if package_version != lock_version:
            print(f"Error: package-lock.json version ({lock_version}) does not match package.json ({package_version})")
            return False

        if package_version != manifest_version:
            print(f"Error: manifest.json version ({manifest_version}) does not match package.json ({package_version})")
            return False

        print(f"Version check passed (v{package_version}).")
        return True
    except Exception as e:
        print(f"Error during version check: {e}")
        return False

if __name__ == "__main__":
    if not check_version():
        sys.exit(1)
