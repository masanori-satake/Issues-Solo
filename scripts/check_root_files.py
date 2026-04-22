import os
import sys

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
}

ALLOWED_DIRS = {
    'docs',
    'scripts',
    '.github',
    'releases',
    'node_modules',
    '.git',
}

def check_root_cleanliness():
    root_items = os.listdir('.')
    unexpected_items = []

    for item in root_items:
        if item in ALLOWED_FILES or item in ALLOWED_DIRS:
            continue
        unexpected_items.append(item)

    if unexpected_items:
        print(f"Error: Unexpected items found in root directory: {unexpected_items}")
        return False

    print("Root directory cleanliness check passed.")
    return True

if __name__ == "__main__":
    if not check_root_cleanliness():
        sys.exit(1)
