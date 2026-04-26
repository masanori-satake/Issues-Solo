import os
import sys

# List of allowed files in the root directory.
# If you add a new file to the root, you MUST update this list.
ALLOWED_FILES = {
    "LICENSE",
    "AGENTS.md",
    "package.json",
    "package-lock.json",
    ".gitignore",
    ".python-version",
    "README.md",
    "SECURITY.md",
    "jest.config.js",
    "playwright.config.js",
    ".babelrc",
}

# List of allowed directories in the root directory.
ALLOWED_DIRS = {
    "docs",
    "projects",
    "scripts",
    ".github",
    "releases",
    "node_modules",
    ".git",
    ".ruff_cache",
    ".cache",
    "tests",
    "playwright-report",
    "test-results",
}


def check_directory_cleanliness(path, allowed_files, allowed_dirs, recursive=False):
    """
    Verifies that only explicitly allowed files and directories are present in the given path.
    """
    try:
        items = os.listdir(path)
    except Exception as e:
        print(f"Error listing directory {path}: {e}")
        return False

    unexpected_items = []

    for item in items:
        # Ignore temporary files
        if item.endswith(".log") or item == "audit_output.log" or item == ".DS_Store":
            unexpected_items.append(os.path.join(path, item))
            continue

        if item in allowed_files or item in allowed_dirs:
            continue

        unexpected_items.append(os.path.join(path, item))

    if unexpected_items:
        print(f"Error: Unexpected items found in {path}: {unexpected_items}")
        return False

    return True


def check_project_cleanliness():
    """
    Main check function for the whole project.
    """
    # 1. Check Root
    root_success = check_directory_cleanliness(
        ".", ALLOWED_FILES | {".pre-commit-config.yaml"}, ALLOWED_DIRS
    )

    # 2. Check projects/app
    app_dir = os.path.join("projects", "app")
    app_allowed_files = {
        "manifest.json",
        "background.js",
        "content.js",
        "db.js",
        "sidepanel.html",
        "sidepanel.js",
        "sidepanel.css",
        "LICENSE",
        "MaterialSymbolsOutlined.woff2",
    }
    app_allowed_dirs = {"_locales", "assets"}
    app_success = check_directory_cleanliness(
        app_dir, app_allowed_files, app_allowed_dirs
    )

    if not root_success or not app_success:
        print("\nCleanliness check failed.")
        print(
            "If these are legitimate project files, please update scripts/check_root_files.py"
        )
        return False

    print("Project cleanliness check passed.")
    return True


if __name__ == "__main__":
    if not check_project_cleanliness():
        sys.exit(1)
