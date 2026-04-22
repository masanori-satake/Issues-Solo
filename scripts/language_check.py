import sys
import re

def is_japanese(text):
    # ひらがな、カタカナ、漢字を含むかチェック
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]', text))

def main():
    input_text = sys.stdin.read()
    if not input_text.strip():
        print("Empty input. Skipping check.")
        return

    if is_japanese(input_text):
        print("Language check passed (Japanese detected).")
    else:
        print("Error: Japanese not detected in the input.")
        print(f"Input was: {input_text}")
        sys.exit(1)

if __name__ == "__main__":
    main()
