import os
import sys

# 許可されるファイル/ディレクトリのリスト
ALLOWED_ROOT_ITEMS = {
    '.git',
    '.github',
    '.gitignore',
    'docs',
    'scripts',
    'AGENTS.md',
    'LICENSE',
    'README.md',
    'package.json',
    'package-lock.json',
    'manifest.json',
    'background.js',
    'content.js',
    'db.js',
    'sidepanel.css',
    'sidepanel.html',
    'sidepanel.js',
    '.gitattributes'
}

def check_root():
    root_items = os.listdir('.')
    violations = []
    for item in root_items:
        if item not in ALLOWED_ROOT_ITEMS and not item.startswith('.git'):
            violations.append(item)

    if violations:
        print("Error: Prohibited files found in root directory:")
        for v in violations:
            print(f"  - {v}")
        return False

    print("Root directory cleanliness check passed.")
    return True

if __name__ == "__main__":
    if not check_root():
        sys.exit(1)
