"""Writes app/google-services.json — the real one from the build input if
notifications are enabled, otherwise a syntactically valid placeholder
(the google-services Gradle plugin hard-requires the file to exist
regardless; AppConfig.NOTIFICATIONS_ENABLED, from rename_package.py, is
what actually gates any runtime behavior — this file alone never turns
notifications on). Run via `python3 .github/scripts/configure_firebase.py`
from the repo root. Reads PACKAGE_NAME, PERMISSIONS,
GOOGLE_SERVICES_JSON from the environment.
"""
import base64
import json
import os

perms = [p.strip() for p in os.environ.get("PERMISSIONS", "").split(",")]
gs_json_b64 = os.environ.get("GOOGLE_SERVICES_JSON", "").strip()
package_name = os.environ["PACKAGE_NAME"].strip()

if "notifications" in perms and gs_json_b64:
    content = base64.b64decode(gs_json_b64).decode("utf-8")
    open("app/google-services.json", "w").write(content)
    print("✓ google-services.json written from build input")
else:
    placeholder = {
        "project_info": {
            "project_number": "000000000000",
            "project_id": "placeholder-notifications-disabled",
            "storage_bucket": "placeholder-notifications-disabled.firebasestorage.app",
        },
        "client": [{
            "client_info": {
                "mobilesdk_app_id": "1:000000000000:android:0000000000000000000000",
                "android_client_info": {"package_name": package_name},
            },
            "oauth_client": [],
            "api_key": [{"current_key": "placeholder"}],
            "services": {"appinvite_service": {"other_platform_oauth_client": []}},
        }],
        "configuration_version": "1",
    }
    open("app/google-services.json", "w").write(json.dumps(placeholder, indent=2))
    print("✓ Placeholder google-services.json written — notifications not enabled for this build")
