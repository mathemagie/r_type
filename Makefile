# R-TYPELIKE — Neon Drift
# Static HTML5 Canvas game, zero dependencies, no build step.

PORT    ?= 8765
URL     := http://localhost:$(PORT)
PYTHON  := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
ZIP     := R-TYPELIKE.zip
SRC     := index.html style.css js LISEZ-MOI.txt Lancer.bat lancer.sh

# Detect the platform's "open browser" command
ifeq ($(shell uname),Darwin)
  OPEN := open
else
  OPEN := xdg-open
endif

.DEFAULT_GOAL := help

.PHONY: help serve run open package clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

serve: ## Start a local HTTP server on $(PORT)
	@test -n "$(PYTHON)" || { echo "Python 3 not found. Install from python.org."; exit 1; }
	@echo "Serving $(URL) (Ctrl-C to stop)"
	@$(PYTHON) -m http.server $(PORT)

run: ## Open the browser, then serve on $(PORT)
	@test -n "$(PYTHON)" || { echo "Python 3 not found. Install from python.org."; exit 1; }
	@( sleep 1 && $(OPEN) $(URL) ) &
	@$(PYTHON) -m http.server $(PORT)

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
