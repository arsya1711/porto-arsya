.PHONY: release build-release

# Build, upload, dan rilis ke Google Play.
# Contoh: make release TRACK=internal STATUS=completed BUMP=patch
TRACK ?= internal
STATUS ?= completed
BUMP ?= patch
release:
	@BUMP="$(BUMP)" ./release.sh "$(TRACK)" "$(STATUS)"

# Build AAB saja tanpa upload Google Play.
# Contoh: make build-release VERSION=1.0.1 BUILD=2
build-release:
	@./tool/build_release.sh "$(VERSION)" "$(BUILD)"
