import sys
import os
import json

def verify_no_external_libraries():
    """
    Check if there are any external libraries mentioned in manifest.json
    (e.g., in content_scripts or as web_accessible_resources).
    Also checks for <script> tags with external sources in sidepanel.html.
    """
    passed = True

    # Check manifest.json
    try:
        with open('manifest.json', 'r') as f:
            manifest = json.load(f)

            # Content scripts should only be local files
            for script in manifest.get('content_scripts', []):
                for js in script.get('js', []):
                    if js.startswith('http'):
                        print(f"Error: External script found in manifest.json: {js}")
                        passed = False
    except FileNotFoundError:
        print("Error: manifest.json not found")
        passed = False

    # Check sidepanel.html for external scripts
    try:
        with open('sidepanel.html', 'r') as f:
            content = f.read()
            if '<script' in content and 'src="http' in content:
                print("Error: External script source found in sidepanel.html")
                passed = False
            if '<link' in content and 'href="http' in content:
                print("Error: External stylesheet found in sidepanel.html")
                passed = False
    except FileNotFoundError:
        pass # Optional file

    if passed:
        print("Project policy check passed: No external libraries detected.")
    return passed

if __name__ == "__main__":
    if not verify_no_external_libraries():
        sys.exit(1)
