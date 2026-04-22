import sys
import os
import json
import re

def verify_no_external_libraries():
    """
    Check if there are any external libraries mentioned in manifest.json
    or any .html files. The 'Solo' series prohibits external dependencies.
    """
    passed = True

    # 1. Check manifest.json
    try:
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)

            # Check content_scripts
            for script in manifest.get('content_scripts', []):
                for js in script.get('js', []):
                    if re.match(r'^(?:https?:)?//', js):
                        print(f"Error: External script found in manifest.json (content_scripts): {js}")
                        passed = False

            # Check web_accessible_resources
            for resource in manifest.get('web_accessible_resources', []):
                if isinstance(resource, dict):
                    resources = resource.get('resources', [])
                else:
                    resources = [resource]
                for res in resources:
                    if re.match(r'^(?:https?:)?//', res):
                        print(f"Error: External resource found in manifest.json (web_accessible_resources): {res}")
                        passed = False
    except FileNotFoundError:
        print("Error: manifest.json not found")
        passed = False
    except json.JSONDecodeError:
        print("Error: manifest.json is not a valid JSON")
        passed = False

    # 2. Check all .html files for external scripts/styles
    # We want to block external <script src="..."> and <link rel="stylesheet" href="...">
    # but allow regular <a href="..."> links.
    # We also check for protocol-relative URLs (e.g., //cdn.example.com/lib.js).
    external_script_src_pattern = re.compile(r'<script[^>]+src=["\']((?:https?:)?//[^"\']+)["\']', re.IGNORECASE)
    external_link_href_pattern = re.compile(r'<link[^>]+href=["\']((?:https?:)?//[^"\']+)["\']', re.IGNORECASE)

    for root, dirs, files in os.walk('.'):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')

        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                        # Find all <script src="...">
                        scripts = external_script_src_pattern.findall(content)
                        for src in scripts:
                            print(f"Error: External script source found in {file_path}: {src}")
                            passed = False

                        # Find all <link href="..."> (mostly for stylesheets)
                        links = external_link_href_pattern.findall(content)
                        for href in links:
                            # Allow local links (not starting with // or http://)
                            if re.match(r'^(?:https?:)?//', href):
                                print(f"Error: External resource link found in {file_path}: {href}")
                                passed = False
                except Exception as e:
                    print(f"Warning: Could not read {file_path}: {e}")

    if passed:
        print("Project policy check passed: No external libraries detected.")
    return passed

if __name__ == "__main__":
    if not verify_no_external_libraries():
        sys.exit(1)
