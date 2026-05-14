## Vendored schemas and fixtures

`cap_simulator/schemas/` and `cap_simulator/tests/fixtures/` are intended to contain **vendored local copies** of CAP XSD schemas and CAP XML samples.

- These assets must be committed to the repository.
- Do **not** fetch schemas or fixtures from the network at runtime.
- Schema resolution should rely on the checked-in relative file layout under `cap_simulator/schemas/`.
