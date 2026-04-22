import os
import sys

# List of allowed files in the root directory.
# If you add a new file to the root, you MUST update this list.
ALLOWED_FILES = {
    'manifest.json',
    'background.js',
    'content.js',
    'db.js',
    'sidepanel.html',
    'sidepanel.js',
    'sidepanel.css',
    'LICENSE',
    'AGENTS.md',
    'package.json',
    'package-lock.json',
    '.gitignore',
    '.python-version',
    'README.md',
    'SECURITY.md',
}

# List of allowed directories in the root directory.
ALLOWED_DIRS = {
    'docs',
    'projects',
    'scripts',
    '.github',
    'releases',
    'node_modules',
    '.git',
}

def check_root_cleanliness():
    """
    Verifies that only explicitly allowed files and directories are present in the root.
    This helps maintain repository cleanliness and prevents accidental commits of
    temporary files or build artifacts.
    """
    try:
        root_items = os.listdir('.')
    except Exception as e:
        print(f"Error listing directory: {e}")
        return False

    unexpected_items = []

    for item in root_items:
        # Ignore temporary files created during execution if any
        if item.endswith('.log') or item == 'audit_output.log':
            continue

        if item in ALLOWED_FILES or item in ALLOWED_DIRS:
            continue
        unexpected_items.append(item)

    if unexpected_items:
        print(f"Error: Unexpected items found in root directory: {unexpected_items}")
        print("If these are legitimate project files, please add them to ALLOWED_FILES or ALLOWED_DIRS in scripts/check_root_files.py")
        return False

    print("Root directory cleanliness check passed.")
    return True

if __name__ == "__main__":
    if not check_root_cleanliness():
        sys.exit(1)
