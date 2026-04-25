import json
import zipfile
import os
import glob


def build_extension():
    try:
        # 1. Load version from package.json
        with open("package.json", "r", encoding="utf-8") as f:
            package = json.load(f)
            version = package.get("version")

        if not version:
            print("Error: Version not found in package.json")
            return False

        release_dir = "releases"
        zip_filename = os.path.join(release_dir, f"issues-solo-v{version}.zip")

        # 2. Ensure release directory exists
        if not os.path.exists(release_dir):
            os.makedirs(release_dir)
            print(f"Created directory: {release_dir}")

        # 3. Define files to include
        app_dir = os.path.join("projects", "app")
        patterns = ["manifest.json", "*.js", "*.html", "*.css", "LICENSE"]

        files_to_zip = []
        for pattern in patterns:
            files_to_zip.extend(glob.glob(os.path.join(app_dir, pattern)))

        # Remove duplicates and sort
        files_to_zip = sorted(list(set(files_to_zip)))

        # 4. Create the zip file
        print(f"Building Issues-Solo version {version}...")
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path in files_to_zip:
                # Store in zip without projects/app prefix
                arcname = os.path.basename(file_path)
                print(f"  Adding: {file_path} as {arcname}")
                zipf.write(file_path, arcname)

        print(f"Successfully built {zip_filename}")
        return True

    except Exception as e:
        print(f"Error during build: {e}")
        return False


if __name__ == "__main__":
    if not build_extension():
        exit(1)
