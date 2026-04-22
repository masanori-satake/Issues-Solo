import json
import sys
import os

def check_policies():
    # AGENTS.md の存在確認
    if not os.path.exists('AGENTS.md'):
        print("Error: AGENTS.md is missing.")
        return False

    # docs/spec.md の存在確認
    if not os.path.exists('docs/spec.md'):
        print("Error: docs/spec.md is missing.")
        return False

    # docs/DESIGN.md の存在確認
    if not os.path.exists('docs/DESIGN.md'):
        print("Error: docs/DESIGN.md is missing.")
        return False

    print("Project policy check passed.")
    return True

if __name__ == "__main__":
    if not check_policies():
        sys.exit(1)
