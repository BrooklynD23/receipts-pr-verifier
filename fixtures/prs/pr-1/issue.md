# Support "===" arbitrary equality in SpecifierSet.filter

`SpecifierSet.filter` currently runs every specifier through the normal
version-comparison path. A specifier like `===release-1.0` (arbitrary
equality) compares the raw string, not a parsed `Version`, so items that
are not valid versions — or that look like prereleases — get dropped or
mis-filtered before the `===` comparison can run.

## Requirements

- R1: `SpecifierSet` accepts `===` specifiers and `filter()` yields items
  whose raw string exactly equals the `===` operand.
- R2: `===` matching never drops raw items because of prerelease handling;
  it compares strings, not parsed versions.
- R3: Tests cover `===` in `filter()` for matching items, non-matching
  items, and prerelease-looking raw strings.
