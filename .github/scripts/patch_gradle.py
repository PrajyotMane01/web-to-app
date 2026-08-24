"""Patches app/build.gradle.kts: namespace, applicationId, versionCode,
versionName. Run via `python3 .github/scripts/patch_gradle.py` from the
repo root. Reads PACKAGE_NAME, VERSION_CODE, VERSION_NAME from the
environment.
"""
import os

package_name = os.environ["PACKAGE_NAME"].strip()
version_code = int(os.environ.get("VERSION_CODE") or "1")
if version_code < 1:
    raise ValueError(f"Invalid version_code: {version_code}")
version_name = os.environ.get("VERSION_NAME") or "1.0.0"

path = "app/build.gradle.kts"
content = open(path).read()
content = content.replace('namespace = "in.truckflow.app"', f'namespace = "{package_name}"')
content = content.replace('applicationId = "in.truckflow.app"', f'applicationId = "{package_name}"')
content = content.replace("versionCode = 1", f"versionCode = {version_code}")
content = content.replace('versionName = "1.0"', f'versionName = "{version_name}"')
open(path, "w").write(content)
print(f"✓ build.gradle.kts patched ({package_name}, v{version_name}, versionCode {version_code})")
