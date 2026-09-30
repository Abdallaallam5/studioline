import { describe, expect, it } from "vitest";
import { accessFor, computeWorkspaceStatus, daysUntil, isOutstanding, suspensionDate } from "@/lib/subscription/status";

const DAY = 86_400_000;
const renewalDate = new Date("2026-03-01T00:00:00Z");
const at = (iso: string) => new Date(iso);

describe("computeWorkspaceStatus", () => {
  it("is PENDING_PAYMENT until a subscription exists", () => {
    expect(computeWorkspaceStatus({ subscription: null, gracePeriodDays: 3 })).toBe("PENDING_PAYMENT");
  });

  it("is ACTIVE before the renewal date", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now: at("2026-02-28T23:59:59Z") })).toBe("ACTIVE");
  });

  it("becomes PAST_DUE the moment the renewal date arrives", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now: renewalDate })).toBe("PAST_DUE");
  });

  it("stays PAST_DUE for the whole grace period", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now: at("2026-03-03T23:59:59Z") })).toBe("PAST_DUE");
  });

  it("becomes SUSPENDED when the grace period ends", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now: at("2026-03-04T00:00:00Z") })).toBe("SUSPENDED");
  });

  it("honours a configurable grace period", () => {
    const now = at("2026-03-06T00:00:00Z");
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now })).toBe("SUSPENDED");
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 7, now })).toBe("PAST_DUE");
  });

  it("suspends immediately with a zero-day grace period", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 0, now: renewalDate })).toBe("SUSPENDED");
  });

  it("returns to ACTIVE once a payment moves the renewal date forward", () => {
    const now = at("2026-03-10T00:00:00Z");
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, gracePeriodDays: 3, now })).toBe("SUSPENDED");
    expect(computeWorkspaceStatus({ subscription: { renewalDate: at("2026-04-01T00:00:00Z") }, gracePeriodDays: 3, now })).toBe("ACTIVE");
  });

  it("lets a manual suspension override a paid-up subscription", () => {
    expect(computeWorkspaceStatus({ subscription: { renewalDate }, manualSuspendedAt: at("2026-02-01T00:00:00Z"), gracePeriodDays: 3, now: at("2026-02-10T00:00:00Z") })).toBe("SUSPENDED");
  });

  it("reports CANCELLED ahead of everything else", () => {
    expect(
      computeWorkspaceStatus({ subscription: { renewalDate, cancelledAt: at("2026-02-05T00:00:00Z") }, manualSuspendedAt: at("2026-02-01T00:00:00Z"), gracePeriodDays: 3, now: at("2026-02-10T00:00:00Z") }),
    ).toBe("CANCELLED");
  });
});

describe("accessFor", () => {
  it("allows full use while ACTIVE or PAST_DUE", () => {
    expect(accessFor("ACTIVE")).toEqual({ workspace: true, write: true });
    expect(accessFor("PAST_DUE")).toEqual({ workspace: true, write: true });
  });

  it("blocks the workspace and all writes otherwise", () => {
    for (const status of ["PENDING_PAYMENT", "SUSPENDED", "CANCELLED"] as const) {
      expect(accessFor(status)).toEqual({ workspace: false, write: false });
    }
  });
});

describe("helpers", () => {
  it("computes the suspension date from the grace period", () => {
    expect(suspensionDate(renewalDate, 3).toISOString()).toBe("2026-03-04T00:00:00.000Z");
    expect(suspensionDate(renewalDate, -5).getTime()).toBe(renewalDate.getTime());
  });

  it("counts whole days until a date", () => {
    expect(daysUntil(renewalDate, new Date(renewalDate.getTime() - 2 * DAY))).toBe(2);
    expect(daysUntil(renewalDate, new Date(renewalDate.getTime() - 2 * DAY + 1))).toBe(2);
    expect(daysUntil(renewalDate, new Date(renewalDate.getTime() + DAY))).toBe(-1);
  });

  it("treats past-due and suspended subscriptions as outstanding", () => {
    expect(isOutstanding("PAST_DUE")).toBe(true);
    expect(isOutstanding("SUSPENDED")).toBe(true);
    expect(isOutstanding("ACTIVE")).toBe(false);
    expect(isOutstanding("CANCELLED")).toBe(false);
  });
});
