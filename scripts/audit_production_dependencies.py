import json
import sys
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
        sys.exit(1)
