.RECIPEPREFIX := >
.PHONY: test run

run:
> ./run.sh

test:
> pytest
