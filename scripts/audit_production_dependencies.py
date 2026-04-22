import json
import sys
<<<<<<< Updated upstream

def audit_dependencies():
    try:
        with open('package.json', 'r') as f:
            package = json.load(f)
            dependencies = package.get('dependencies', {})

            if dependencies:
                print(f"Error: Production dependencies found in package.json: {list(dependencies.keys())}")
                print("The 'Solo' series strictly prohibits production dependencies.")
                return False

        print("OSS dependency audit passed: No production dependencies found.")
        return True
    except Exception as e:
        print(f"Error auditing dependencies: {e}")
        return False

if __name__ == "__main__":
    if not audit_dependencies():
=======
import os

def audit_deps():
    if not os.path.exists('package.json'):
        return True

    with open('package.json', 'r') as f:
        data = json.load(f)

    deps = data.get('dependencies', {})
    if deps:
        print("Error: Production dependencies are prohibited in Solo series.")
        for dep in deps:
            print(f"  - {dep}")
        return False

    print("No production dependencies found. Audit passed.")
    return True

if __name__ == "__main__":
    if not audit_deps():
>>>>>>> Stashed changes
        sys.exit(1)
