import json
import sys
import subprocess
import re
from pathlib import Path


def get_current_version():
    try:
        with open("package.json", "r") as f:
            data = json.load(f)
            return data.get("version")
    except Exception as e:
        print(f"Error reading current version: {e}")
        return None


def get_base_version():
    try:
        # Try to get package.json from the main branch
        result = subprocess.run(
            ["git", "show", "origin/main:package.json"],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(result.stdout)
        return data.get("version")
    except subprocess.CalledProcessError:
        # If origin/main is not available (e.g. local run), try main
        try:
            result = subprocess.run(
                ["git", "show", "main:package.json"],
                capture_output=True,
                text=True,
                check=True
            )
            data = json.loads(result.stdout)
            return data.get("version")
        except Exception:
            print("Warning: Could not fetch base version from main branch.")
            return None
    except Exception as e:
        print(f"Warning: Error fetching base version: {e}")
        return None


def parse_version(v):
    if not v:
        return (0, 0, 0)
    return tuple(map(int, (re.sub(r"[^\d\.]", "", v).split("."))))


def is_incremented(base, current):
    return parse_version(current) > parse_version(base)


def get_changed_files():
    try:
        # First try triple-dot diff (changes in current branch since it diverged from main)
        result = subprocess.run(
            ["git", "diff", "--name-only", "origin/main...HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        files = result.stdout.splitlines()
        if files: return files
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "main...HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        files = result.stdout.splitlines()
        if files: return files
    except Exception:
        pass

    # If triple-dot fails or returns nothing, try double-dot or just compare with main
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "main"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.splitlines()
    except Exception as e:
        print(f"Error getting changed files: {e}")
        return []


def verify_version_impact():
    print("Checking for version impact in projects/app/...")

    changed_files = get_changed_files()
    app_changes = [f for f in changed_files if f.startswith("projects/app/")]

    if not app_changes:
        print("No changes detected in projects/app/. Version increment not required.")
        return True

    print(f"Changes detected in projects/app/ ({len(app_changes)} files).")

    current_v = get_current_version()
    base_v = get_base_version()

    if not base_v:
        print("Base version not found. Skipping increment check (assuming first release or non-git environment).")
        return True

    print(f"Base version (main): {base_v}")
    print(f"Current version: {current_v}")

    if is_incremented(base_v, current_v):
        print("Success: Version has been incremented.")
        return True
    else:
        print("Error: Changes detected in projects/app/ but version was not incremented.")
        print("Please update version in package.json, projects/app/manifest.json, and README.md.")
        return False


if __name__ == "__main__":
    if not verify_version_impact():
        sys.exit(1)
