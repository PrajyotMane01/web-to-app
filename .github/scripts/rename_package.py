"""Renames the Kotlin package to match this build's package_name, and
writes AppConfig.kt (this build's per-app config, equivalent to the old
Expo app's config.js) at the new location.

Native Android (unlike Expo) requires the Kotlin source to physically live
in a folder tree matching the package, and every file's own `package`
declaration to match too.

Run via `python3 .github/scripts/rename_package.py` from the repo root.
Reads PACKAGE_NAME, APP_URL, PINCH_ZOOM, CUSTOM_CSS, CUSTOM_JS,
PERMISSIONS, BLOCKED_DOMAINS from the environment.
"""
import json
import os
import re
import shutil

package_name = os.environ["PACKAGE_NAME"].strip()
if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+", package_name):
    raise ValueError(f"Invalid package_name: {package_name!r}")

OLD_PATH = "app/src/main/java/in/truckflow/app"
segments = package_name.split(".")
new_path = os.path.join("app/src/main/java", *segments)

if new_path != OLD_PATH:
    os.makedirs(os.path.dirname(new_path), exist_ok=True)
    shutil.move(OLD_PATH, new_path)
    # Clean up now-empty parents of the old path (e.g. in/truckflow, in)
    parent = os.path.dirname(OLD_PATH)
    while parent not in ("app/src/main/java", "") and os.path.isdir(parent) and not os.listdir(parent):
        os.rmdir(parent)
        parent = os.path.dirname(parent)

KOTLIN_KEYWORDS = {
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if",
    "in", "interface", "is", "null", "object", "package", "return", "super", "this",
    "throw", "true", "try", "typealias", "typeof", "val", "var", "when", "while",
}
package_decl = ".".join(f"`{s}`" if s in KOTLIN_KEYWORDS else s for s in segments)

for fname in os.listdir(new_path):
    if not fname.endswith(".kt"):
        continue
    fpath = os.path.join(new_path, fname)
    content = open(fpath).read()
    content = re.sub(r"^package\s+.+$", f"package {package_decl}", content, count=1, flags=re.MULTILINE)
    open(fpath, "w").write(content)

print(f"✓ Package renamed to {package_name} ({new_path})")

perms = [p.strip() for p in os.environ.get("PERMISSIONS", "").split(",")]
pinch_zoom = (os.environ.get("PINCH_ZOOM") or "true").strip() != "false"
# Deliberately embedded with json.dumps() below rather than naive string
# interpolation — this is arbitrary user CSS/JS containing quotes,
# newlines, backslashes, any of which would otherwise break out of the
# generated literal and produce an AppConfig.kt that won't compile.
# json.dumps() produces a valid Kotlin string literal for any input too
# (Kotlin and JSON escape the same core set: quote, backslash, control
# characters).
custom_css = os.environ.get("CUSTOM_CSS", "")
custom_js = os.environ.get("CUSTOM_JS", "")
blocked_domains = [d.strip() for d in os.environ.get("BLOCKED_DOMAINS", "").split(",") if d.strip()]

app_config = f"""package {package_decl}

// Generated per build by .github/workflows/build-apk.yml — do not edit by
// hand, changes are overwritten on the next build.
object AppConfig {{
    const val WEB_VIEW_URL = {json.dumps(os.environ["APP_URL"])}
    const val PINCH_ZOOM_ENABLED = {str(pinch_zoom).lower()}
    const val CUSTOM_CSS = {json.dumps(custom_css)}
    const val CUSTOM_JS = {json.dumps(custom_js)}

    const val CAMERA_ENABLED = {str("camera" in perms).lower()}
    const val MICROPHONE_ENABLED = {str("microphone" in perms).lower()}
    const val LOCATION_ENABLED = {str("location" in perms).lower()}
    const val NOTIFICATIONS_ENABLED = {str("notifications" in perms).lower()}

    const val DEEP_LINK_SCHEME = {json.dumps(package_name)}

    val BLOCKED_DOMAINS: List<String> = listOf({", ".join(json.dumps(d) for d in blocked_domains)})
}}
"""

open(os.path.join(new_path, "AppConfig.kt"), "w").write(app_config)
print(f"✓ AppConfig.kt written — custom CSS {len(custom_css)} chars, custom JS {len(custom_js)} chars")
