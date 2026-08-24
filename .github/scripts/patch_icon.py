"""Patches the app name into strings.xml, and converts + points the
adaptive icon at the icon the workflow step downloaded (into
/tmp/icon_source, raw bytes exactly as the dashboard served them). Run
via `python3 .github/scripts/patch_icon.py` from the repo root. Reads
APP_NAME from the environment.
"""
import os
import re

from PIL import Image

# The dashboard accepts whatever image format a customer uploads (jpg,
# webp, ...) — don't trust the source file's own format, always
# re-encode to a real PNG. AAPT2 rejects a file named .png whose bytes
# aren't actually PNG (that's exactly what broke the first real build: a
# customer's .jpg icon landing here unconverted).
Image.open("/tmp/icon_source").convert("RGBA").save(
    "app/src/main/res/drawable/ic_launcher_foreground.png"
)
print("✓ Icon normalized to PNG")

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
