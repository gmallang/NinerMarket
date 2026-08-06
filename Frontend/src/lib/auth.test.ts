import { describe, expect, it } from "vitest";
import { isCharlotteEmail, makeUserId } from "./auth";

describe("isCharlotteEmail", () => {
  it("accepts @charlotte.edu addresses", () => {
    expect(isCharlotteEmail("anna@charlotte.edu")).toBe(true);
    expect(isCharlotteEmail("  A.Park@CHARLOTTE.EDU  ")).toBe(true);
  });

  it("rejects other domains and malformed input", () => {
    expect(isCharlotteEmail("anna@gmail.com")).toBe(false);
    expect(isCharlotteEmail("anna@charlotte.edu.invalid")).toBe(false);
    expect(isCharlotteEmail("not-an-email")).toBe(false);
    expect(isCharlotteEmail("")).toBe(false);
  });
});

describe("makeUserId", () => {
  it("builds a slug from the email local part", () => {
    expect(makeUserId("Anna.Park@charlotte.edu")).toBe("u-anna-park");
  });
});
