import sys
import re


def is_english_or_japanese(text):
    if not text:
        return True

    # Simple regex for Japanese characters (Hiragana, Katakana, Kanji)
    jp_pattern = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]")

    # English characters, numbers, and common punctuation
    en_pattern = re.compile(r'^[a-zA-Z0-9\s\.,!?;:()\'"\-\[\]]+$')

    # If it contains Japanese characters, it's considered valid
    if jp_pattern.search(text):
        return True

    # If it's purely English characters, it's considered valid
    if en_pattern.match(text):
        return True

    # Fallback: if it's mostly printable ASCII, it's probably fine
    printable_ascii = all(ord(c) < 128 for c in text)
    if printable_ascii:
        return True

    return False


def check_language():
    input_text = sys.stdin.read()
    if not is_english_or_japanese(input_text):
        print(
            "Error: PR title or body contains unsupported characters. Please use English or Japanese."
        )
        return False

    print("Language check passed.")
    return True


if __name__ == "__main__":
    if not check_language():
        sys.exit(1)
