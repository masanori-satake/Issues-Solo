import os
import sys
import re


def generate_icons(output_dir=None, bg_color=None):
    # Use script-relative paths for reliability
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    svg_path = os.path.join(project_root, "projects/app/assets/icon.svg")

    # Default output directory
    if output_dir is None:
        output_dir = os.path.join(project_root, "projects/app/assets")
    else:
        output_dir = os.path.abspath(output_dir)

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found.")
        return False

    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read()

    if bg_color:
        # Flexible regex for <rect width="512" height="512" ... fill="...">
        # Matches regardless of attribute order and quotes
        pattern = (
            r'(<rect\s+[^>]*fill=["\'])([^"\']+)(["\'][^>]*width=["\']512["\'][^>]*height=["\']512["\'])|'
            r'(<rect\s+[^>]*width=["\']512["\'][^>]*height=["\']512["\'][^>]*fill=["\'])([^"\']+)(["\'])'
        )

        def replace_fill(match):
            if match.group(1):  # fill comes before width/height
                return f"{match.group(1)}{bg_color}{match.group(3)}"
            else:  # fill comes after width/height
                return f"{match.group(4)}{bg_color}{match.group(6)}"

        if re.search(pattern, svg_content):
            svg_content = re.sub(pattern, replace_fill, svg_content)
            print(f"Background color dynamically changed to {bg_color}")
        else:
            # Fallback: find the first rect with a fill attribute
            fallback_pattern = r'(<rect\s+[^>]*fill=["\'])([^"\']+)(["\'])'
            if re.search(fallback_pattern, svg_content):
                svg_content = re.sub(
                    fallback_pattern, rf"\1{bg_color}\3", svg_content, count=1
                )
                print(f"Background color changed to {bg_color} (using fallback regex)")

    try:
        from playwright.sync_api import sync_playwright

        print("Playwright found. Generating icons...")
    except ImportError:
        print(
            "Error: No module named 'playwright'. Please install it to generate extension icons."
        )
        return False

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as e:
            print(f"Error: Failed to launch browser: {e}")
            print(
                "Hint: Try running 'playwright install chromium' or 'npx playwright install chromium'."
            )
            return False

        context = browser.new_context(
            viewport={"width": 512, "height": 512}, device_scale_factor=1
        )
        page = context.new_page()

        # Use a template literal to safely inject SVG content that might contain braces
        page.set_content(
            """
            <!DOCTYPE html>
            <html>
            <head>
            <style>
              body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
              svg { width: 100%; height: 100%; display: block; }
            </style>
            </head>
            <body>
            """
            + svg_content
            + """
            </body>
            </html>
        """
        )

        for size in [16, 32, 48, 128]:
            output_path = os.path.join(output_dir, f"icon{size}.png")
            print(f"Generating {size}x{size} icon: {output_path}")

            page.set_viewport_size({"width": size, "height": size})
            # Ensure SVG has time to render if it has transitions or complex filters
            page.wait_for_timeout(100)
            page.screenshot(
                path=output_path,
                omit_background=True,
                clip={"x": 0, "y": 0, "width": size, "height": size},
            )

        browser.close()

    print(f"Icon generation complete in {output_dir}")
    return True


if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else None
    color = sys.argv[2] if len(sys.argv) > 2 else None

    if generate_icons(target_dir, color):
        exit(0)
    else:
        exit(1)
