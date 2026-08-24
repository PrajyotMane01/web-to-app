"""Wires app/build.gradle.kts's release build type to the release
keystore prepared by the workflow step (as app/release.keystore) before
this script runs. Text insertion rather than brace-matching surgery,
because this file's starting shape (no signingConfigs block at all yet —
release defaults to unsigned) is fully known/controlled. Run via
`python3 .github/scripts/configure_signing.py` from the repo root.
"""
path = "app/build.gradle.kts"
content = open(path).read()

old_build_types = """    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }"""
new_block = """    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = System.getenv("STORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }"""

if old_build_types not in content:
    raise ValueError("Did not find expected buildTypes block in app/build.gradle.kts — template may have changed")
content = content.replace(old_build_types, new_block)
open(path, "w").write(content)
print("✓ build.gradle.kts wired to the release signing config")
