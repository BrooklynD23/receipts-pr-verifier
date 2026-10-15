# Add "canonicalize_version" strip_trailing_zero option

`packaging.utils.canonicalize_version` currently returns the full canonical
form of a version, always keeping trailing zero release segments. Callers
that feed canonicalized versions into filenames and tag names want
`"1.0"` to collapse to `"1"`.

Add a keyword-only `strip_trailing_zero` option (default `True`) that drops
a single trailing `.0` release segment, and cover it with tests.

## Requirements

- **R1**: `canonicalize_version` in `src/packaging/utils.py` accepts a
  keyword-only `strip_trailing_zero` parameter defaulting to `True`.
- **R2**: When `strip_trailing_zero` is true, a single trailing `.0` release
  segment is stripped (`"1.0"` canonicalizes to `"1"`); when false the
  version string is returned unchanged.
- **R3**: `tests/test_utils.py` gains tests covering both
  `strip_trailing_zero=True` and `strip_trailing_zero=False`.
