# R-TYPELIKE — Neon Drift
# Static HTML5 Canvas game, zero dependencies, no build step.

PORT    ?= 8765
URL     := http://localhost:$(PORT)
PYTHON  := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
ZIP     := R-TYPELIKE.zip
SRC     := index.html style.css js LISEZ-MOI.txt Lancer.bat lancer.sh
LOG     := server.log
PIDFILE := .server.pid

# Detect the platform's "open browser" command
ifeq ($(shell uname),Darwin)
  OPEN := open
else
  OPEN := xdg-open
endif

.DEFAULT_GOAL := help

.PHONY: help serve run dev logs stop open package clean free

# Kill any process already listening on $(PORT) so we can rebind cleanly
define free_port
	@pids=$$(lsof -ti tcp:$(PORT) 2>/dev/null); \
	if [ -n "$$pids" ]; then \
		echo "Port $(PORT) busy — stopping $$pids"; \
		kill $$pids 2>/dev/null || true; \
		sleep 1; \
	fi
endef

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

serve: ## Start a local HTTP server on $(PORT) (frees the port first)
	@test -n "$(PYTHON)" || { echo "Python 3 not found. Install from python.org."; exit 1; }
	$(call free_port)
	@echo "Serving $(URL) (Ctrl-C to stop)"
	@$(PYTHON) -m http.server $(PORT)

run: ## Open the browser, then serve on $(PORT) (frees the port first)
	@test -n "$(PYTHON)" || { echo "Python 3 not found. Install from python.org."; exit 1; }
	$(call free_port)
	@( sleep 1 && $(OPEN) $(URL) ) &
	@$(PYTHON) -m http.server $(PORT)

free: ## Stop whatever is listening on $(PORT)
	$(call free_port)
	@echo "Port $(PORT) free."

dev: ## Start the server in the background, logging to $(LOG)
	@test -n "$(PYTHON)" || { echo "Python 3 not found. Install from python.org."; exit 1; }
	$(call free_port)
	@$(PYTHON) -m http.server $(PORT) > $(LOG) 2>&1 & echo $$! > $(PIDFILE)
	@sleep 1
	@echo "Serving $(URL) (pid $$(cat $(PIDFILE))) — logging to $(LOG)"
	@echo "Tail logs: make logs   Stop: make stop"
	@( $(OPEN) $(URL) >/dev/null 2>&1 & ) || true

logs: ## Follow the background server log
	@test -f $(LOG) || { echo "No $(LOG) yet. Run: make dev"; exit 1; }
	@tail -f $(LOG)

stop: ## Stop the background server started by `make dev`
	@if [ -f $(PIDFILE) ]; then \
		kill $$(cat $(PIDFILE)) 2>/dev/null || true; rm -f $(PIDFILE); \
		echo "Stopped."; \
	else \
		pids=$$(lsof -ti tcp:$(PORT) 2>/dev/null); \
		[ -n "$$pids" ] && kill $$pids 2>/dev/null || true; \
		echo "No pidfile; freed port $(PORT)."; \
	fi

open: ## Open $(URL) in the default browser (server must already be running)
	@$(OPEN) $(URL)

package: ## Rebuild the distributable $(ZIP)
	@rm -f $(ZIP)
	@zip -r $(ZIP) $(SRC) -x '*.DS_Store'
	@echo "Built $(ZIP)"

clean: ## Remove packaging artifacts (zip, empty extract dir, .DS_Store)
	@rm -f $(ZIP)
	@rm -rf R-TYPELIKE
	@find . -name '.DS_Store' -delete
	@echo "Cleaned."
