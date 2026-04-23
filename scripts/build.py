import json
import zipfile
import os
import glob

def build_extension():
    try:
        # 1. Load version from package.json
        with open('package.json', 'r', encoding='utf-8') as f:
            package = json.load(f)
            version = package.get('version')

        if not version:
            print("Error: Version not found in package.json")
            return False

        release_dir = 'releases'
        zip_filename = os.path.join(release_dir, f'issues-solo-v{version}.zip')

        # 2. Ensure release directory exists
        if not os.path.exists(release_dir):
            os.makedirs(release_dir)
            print(f"Created directory: {release_dir}")

        # 3. Define files to include
        # Using glob patterns for better maintainability as requested
        patterns = [
            'manifest.json',
            '*.js',
            '*.html',
            '*.css',
            'LICENSE'
        ]

        files_to_zip = []
        for pattern in patterns:
            files_to_zip.extend(glob.glob(pattern))

        # Remove duplicates and sort
        files_to_zip = sorted(list(set(files_to_zip)))

        # 4. Create the zip file
        print(f"Building Issues-Solo version {version}...")
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in files_to_zip:
                print(f"  Adding: {file}")
                zipf.write(file)

        print(f"Successfully built {zip_filename}")
        return True

    except Exception as e:
        print(f"Error during build: {e}")
        return False

if __name__ == "__main__":
    if not build_extension():
        exit(1)
