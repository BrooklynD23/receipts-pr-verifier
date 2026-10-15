import { describe, expect, it } from "vitest";

import type { CheckerFinding } from "../schemas";
import { badgeFor } from "./badge";

const f = (
  rule: CheckerFinding["rule"],
  severity: CheckerFinding["severity"],
): CheckerFinding => ({ rule, severity, message: "m" });

describe("badgeFor", () => {
  it("returns clean for no findings", () => {
    expect(badgeFor([])).toBe("clean");
  });

  it("returns flags for any red finding", () => {
    expect(badgeFor([f("new_skip_marker", "red")])).toBe("flags");
    expect(badgeFor([f("assert_removed", "red")])).toBe("flags");
    expect(badgeFor([f("tests_mismatch", "red")])).toBe("flags");
  });

  it("red beats missing-evidence rules", () => {
    expect(
      badgeFor([
        f("unmapped_requirement", "amber"),
        f("tests_mismatch", "red"),
      ]),
    ).toBe("flags");
  });

  it("returns missing_evidence for unmapped_requirement or missing_bundle", () => {
    expect(badgeFor([f("unmapped_requirement", "amber")])).toBe(
      "missing_evidence",
    );
    expect(badgeFor([f("missing_bundle", "amber")])).toBe("missing_evidence");
  });

  it("missing_evidence beats other ambers", () => {
    expect(
      badgeFor([f("injection_text", "amber"), f("missing_bundle", "amber")]),
    ).toBe("missing_evidence");
  });

  it("returns flags for other amber findings", () => {
    expect(badgeFor([f("out_of_scope", "amber")])).toBe("flags");
    expect(badgeFor([f("injection_text", "amber")])).toBe("flags");
  });

  it("does not mutate the input array", () => {
    const findings = [f("out_of_scope", "amber"), f("tests_mismatch", "red")];
    const snapshot = [...findings];
    badgeFor(findings);
    expect(findings).toEqual(snapshot);
  });
});
