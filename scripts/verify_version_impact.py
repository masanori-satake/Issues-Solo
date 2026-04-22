import subprocess
import json
import re
import sys
import os

def get_base_commit():
    try:
        if os.getenv('GITHUB_EVENT_NAME') == 'pull_request':
            base_ref = os.getenv('GITHUB_BASE_REF')
            if base_ref:
                return f"origin/{base_ref}"

        # Fallback: get the last version commit or first commit
        cmd = ["git", "rev-list", "--max-parents=0", "HEAD"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip().split('\n')[0]
    except Exception:
        return None

def get_commits_since(commit_hash):
    if not commit_hash:
        return []

    try:
        cmd = ["git", "log", f"{commit_hash}..HEAD", "--format=%B", "-z"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        commits = result.stdout.split('\0')
        return [c.strip() for c in commits if c.strip()]
    except Exception:
        return []

def get_version_from_file(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f).get('version')
    except:
        return None

def get_version_at_commit(filepath, commit_hash):
    try:
        cmd = ["git", "show", f"{commit_hash}:{filepath}"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout).get('version')
    except:
        return None

def determine_required_bump(commits):
    bump = None
    for body in commits:
        if bump != "major":
            if "BREAKING CHANGE" in body or re.search(r'^[a-zA-Z]+!:', body, re.MULTILINE):
                bump = "major"
            elif re.search(r'^feat(\(.*\))?:', body, re.MULTILINE) and bump != "major":
                bump = "minor"
            elif re.search(r'^fix(\(.*\))?:', body, re.MULTILINE) and bump is None:
                bump = "patch"
    return bump

def check_impact():
    base_commit = get_base_commit()
    print(f"Comparing against base commit: {base_commit}")

    commits = get_commits_since(base_commit)
    required_bump = determine_required_bump(commits)

    if not required_bump:
        print("No feature or fix commits detected in commit messages. Bump might be required if code changed.")
        # If we have any commits at all, let's at least expect a patch bump for "refactor" etc
        if commits:
            required_bump = "patch"
        else:
            return True

    current_version = get_version_from_file('package.json')
    base_version = get_version_at_commit('package.json', base_commit)

    if not base_version:
        print("Could not determine base version. Assuming first version.")
        return True

    print(f"Base version: {base_version}")
    print(f"Current version: {current_version}")
    print(f"Required bump detected: {required_bump}")

    b_parts = list(map(int, base_version.split('.')))
    c_parts = list(map(int, current_version.split('.')))

    if c_parts > b_parts:
        # Check if the bump is sufficient
        if required_bump == "major" and c_parts[0] <= b_parts[0]:
            print("Error: Major version bump required for breaking changes.")
            return False
        if required_bump == "minor" and c_parts[0] == b_parts[0] and c_parts[1] <= b_parts[1]:
            print("Error: Minor version bump required for features.")
            return False
        return True
    else:
        print(f"Error: Version must be increased. Detected required bump: {required_bump}")
        return False

if __name__ == "__main__":
    if not check_impact():
        sys.exit(1)
    print("Version impact verification passed.")
