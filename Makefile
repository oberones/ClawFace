SHELL := /bin/sh

NPM := npm
TSCP := ./node_modules/.bin/tsc --noEmit

.PHONY: help install dev build preview typecheck test-unit check-runtime check-rollup-linux check-env verify desktop-build-web desktop-dev desktop-pack desktop-dist-mac desktop-dist-mac-x64 desktop-dist-win desktop-dist-linux hooks-install clean

help:
	@echo "ClawFace Make targets:"
	@echo "  make install            Install dependencies"
	@echo "  make dev                Start Vite dev server"
	@echo "  make build              Build the web app"
	@echo "  make preview            Preview the built app"
	@echo "  make typecheck          Run TypeScript type checking"
	@echo "  make test-unit          Run focused Node-based regression tests"
	@echo "  make check-runtime      Run runtime checks"
	@echo "  make check-rollup-linux Check Linux rollup package resolution"
	@echo "  make check-env          Run environment validation"
	@echo "  make verify             Run the CI-style verification command"
	@echo "  make desktop-build-web  Build renderer assets for desktop packaging"
	@echo "  make desktop-dev        Start Vite + Electron for desktop development"
	@echo "  make desktop-pack       Build unpacked Electron app"
	@echo "  make desktop-dist-mac   Build macOS arm64 distributables"
	@echo "  make desktop-dist-mac-x64 Build macOS x64 distributables"
	@echo "  make desktop-dist-win   Build Windows distributables"
	@echo "  make desktop-dist-linux Build Linux distributables"
	@echo "  make hooks-install      Install repo git hooks"
	@echo "  make clean              Remove generated build output"

install:
	ELECTRON_CACHE=$(CURDIR)/.cache/electron $(NPM) install --include=dev

dev:
	$(NPM) run dev

build:
	$(NPM) run build

preview:
	$(NPM) run preview

typecheck:
	$(TSCP)

test-unit:
	$(NPM) run test:unit

check-runtime:
	$(NPM) run check:runtime

check-rollup-linux:
	$(NPM) run check:rollup-linux

check-env:
	$(NPM) run check:env

verify:
	ELECTRON_CACHE=$(CURDIR)/.cache/electron $(NPM) run verify:ci

desktop-build-web:
	$(NPM) run desktop:build:web

desktop-dev:
	$(NPM) run desktop:dev

desktop-pack:
	$(NPM) run desktop:pack

desktop-dist-mac:
	$(NPM) run desktop:dist:mac

desktop-dist-mac-x64:
	$(NPM) run desktop:dist:mac:x64

desktop-dist-win:
	$(NPM) run desktop:dist:win

desktop-dist-linux:
	$(NPM) run desktop:dist:linux

hooks-install:
	$(NPM) run hooks:install

clean:
	rm -rf dist desktop-dist
