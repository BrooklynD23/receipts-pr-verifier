# Normalize "1.0-1" to "1.0.post1" in Version

Some upstream releases use a dash before the post-release number
(`1.0-1`). PEP 440 normalizes this form to `1.0.post1`, but `Version`
currently raises `InvalidVersion` for the dashed input.

## Requirements

- R1: `Version("1.0-1")` parses successfully and `str()` returns
  `"1.0.post1"`; normalization must happen inside `Version.__init__` so
  every public entry point benefits.
- R2: a regression test in `tests/test_version.py` covers the
  `"1.0-1" -> "1.0.post1"` normalization.
