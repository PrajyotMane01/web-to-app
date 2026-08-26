"""Patches the app name into strings.xml, converts + points the adaptive
icon at the icon the workflow step downloaded (into /tmp/icon_source, raw
bytes exactly as the dashboard served them), and — if a custom splash
image was downloaded to /tmp/splash_source — converts that into
drawable/splash_image.png too. Run via
`python3 .github/scripts/patch_icon.py` from the repo root. Reads
APP_NAME from the environment.
"""
import io
import os
import re

from PIL import Image, UnidentifiedImageError


# The dashboard accepts whatever image format a customer uploads — don't
# trust the source file's own format, always re-encode to a real PNG.
# AAPT2 rejects a file named .png whose bytes aren't actually PNG (that's
# exactly what broke an early real build: a customer's .jpg icon landing
# here unconverted).
#
# Two formats need help before Image.open() can even see them:
#  - SVG is vector, not a raster format Pillow reads at all — rasterize it
#    with cairosvg first. Sniffed by content rather than by the upload's
#    reported extension/mimetype, since neither is trustworthy.
#  - HEIC/HEIF (the default format for iPhone camera photos) needs the
#    pillow-heif plugin registered before Image.open() recognizes it —
#    only imported when actually needed since it's a heavier dependency.
def load_image(path: str) -> Image.Image:
    content = open(path, "rb").read()
    if b"<svg" in content[:4096]:
        import cairosvg
        return Image.open(io.BytesIO(
            cairosvg.svg2png(bytestring=content, output_width=1024, output_height=1024)
        ))
    try:
        return Image.open(io.BytesIO(content))
    except UnidentifiedImageError:
        import pillow_heif
        pillow_heif.register_heif_opener()
        return Image.open(io.BytesIO(content))


load_image("/tmp/icon_source").convert("RGBA").save(
    "app/src/main/res/drawable/ic_launcher_foreground.png"
)
print("✓ Icon normalized to PNG")

if os.path.exists("/tmp/splash_source"):
    load_image("/tmp/splash_source").convert("RGBA").save(
        "app/src/main/res/drawable/splash_image.png"
    )
    print("✓ Splash image normalized to PNG")

path = "app/src/main/res/values/strings.xml"
strings = open(path).read()
# App name comes from the dashboard, not this file's own author — escape
# the handful of characters XML treats specially so a name like "Bob's &
# Sons" doesn't produce invalid strings.xml. Apostrophe is escaped as \'
# rather than the &apos; XML entity: Android's AAPT2 string-resource
# compiler fails on &apos; specifically ("Invalid unicode escape sequence
# in string") even though it's valid XML — \' is the idiom Android string
# resources actually use for a literal apostrophe.
app_name = (os.environ["APP_NAME"]
    .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    .replace('"', "&quot;").replace("'", r"\'"))
# @ and ? are also special at the *start* of an Android string resource
# (resource/theme-attribute references) — escape if present there.
if app_name[:1] in ("@", "?"):
    app_name = "\\" + app_name
strings = re.sub(
    r'(<string name="app_name">).*?(</string>)',
    rf"\1{app_name}\2",
    strings,
)
open(path, "w").write(strings)

path = "app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"
icon_xml = open(path).read()
icon_xml = icon_xml.replace(
    'android:drawable="@android:drawable/sym_def_app_icon"',
    'android:drawable="@drawable/ic_launcher_foreground"',
)
open(path, "w").write(icon_xml)
print("✓ App name and icon patched")
