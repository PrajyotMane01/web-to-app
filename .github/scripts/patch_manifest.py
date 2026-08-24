"""Patches app/src/main/AndroidManifest.xml: deep-link scheme, App Link
host, and permission entries. Run via
`python3 .github/scripts/patch_manifest.py` from the repo root. Reads
PACKAGE_NAME, APP_URL, PERMISSIONS from the environment.
"""
import os
import re
from urllib.parse import urlparse

path = "app/src/main/AndroidManifest.xml"
manifest = open(path).read()

package_name = os.environ["PACKAGE_NAME"].strip()
# A package name is already guaranteed unique, so it doubles as a
# collision-free custom URL scheme for deep links — must match
# AppConfig.DEEP_LINK_SCHEME exactly (both derived from the same input,
# see rename_package.py).
manifest = manifest.replace('android:scheme="truckflow"', f'android:scheme="{package_name}"')

host = urlparse(os.environ["APP_URL"]).hostname or "app.capsule.nodemedia.in"
manifest = manifest.replace('android:host="app.capsule.nodemedia.in"', f'android:host="{host}"')

PERMISSION_MAP = {
    "notifications": ["android.permission.POST_NOTIFICATIONS"],
    "camera":        ["android.permission.CAMERA"],
    "microphone":    ["android.permission.RECORD_AUDIO"],
    "location":      [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
    ],
    "storage":       [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_EXTERNAL_STORAGE",
    ],
}
permissions_input = os.environ.get("PERMISSIONS", "").strip()
existing = set(re.findall(r'uses-permission android:name="([^"]+)"', manifest))
to_add = []
for key in permissions_input.split(","):
    key = key.strip()
    for perm in PERMISSION_MAP.get(key, []):
        if perm not in existing:
            to_add.append(perm)

if to_add:
    lines = "\n".join(f'    <uses-permission android:name="{p}"/>' for p in to_add)
    manifest = manifest.replace("</manifest>", f"{lines}\n</manifest>")

open(path, "w").write(manifest)
print(f"✓ Manifest patched — scheme={package_name}, App Link host={host}, +{len(to_add)} permission(s)")
