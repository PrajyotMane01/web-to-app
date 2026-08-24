"""Patches the app name into strings.xml and points the adaptive icon at
the icon downloaded by the workflow step (into
app/src/main/res/drawable/ic_launcher_foreground.png) before this script
runs. Run via `python3 .github/scripts/patch_icon.py` from the repo root.
Reads APP_NAME from the environment.
"""
import os
import re

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
