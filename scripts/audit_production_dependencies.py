import json
import sys

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
        sys.exit(1)
