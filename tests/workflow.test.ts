import { describe, expect, it } from "vitest";
import { TASK_STATUSES } from "@/lib/constants";
import { canEmployee, canManager, canManagerSetStatus, employeeTarget, isOverdue, managerTarget } from "@/lib/tasks/workflow";

describe("employee transitions", () => {
  it("can start a new task without any approval", () => {
    expect(canEmployee("start", "NEW")).toBe(true);
    expect(employeeTarget("start")).toBe("IN_PROGRESS");
  });

  it("can resume after changes were requested or a block cleared", () => {
    expect(canEmployee("start", "CHANGES_REQUESTED")).toBe(true);
    expect(canEmployee("start", "BLOCKED")).toBe(true);
  });

  it("cannot start, submit, or ask for help on finished work", () => {
    for (const status of ["SUBMITTED_FOR_REVIEW", "COMPLETED", "CANCELLED"] as const) {
      expect(canEmployee("start", status)).toBe(false);
      expect(canEmployee("submit", status)).toBe(false);
      expect(canEmployee("requestHelp", status)).toBe(false);
    }
  });

  it("submits into review", () => {
    expect(canEmployee("submit", "IN_PROGRESS")).toBe(true);
    expect(canEmployee("submit", "CHANGES_REQUESTED")).toBe(true);
    expect(employeeTarget("submit")).toBe("SUBMITTED_FOR_REVIEW");
  });

  it("keeps the status when asking for help", () => {
    expect(employeeTarget("requestHelp")).toBeNull();
  });
});

describe("manager review", () => {
  it("only acts on submitted work", () => {
    for (const status of TASK_STATUSES) {
      const expected = status === "SUBMITTED_FOR_REVIEW";
      expect(canManager("approve", status)).toBe(expected);
      expect(canManager("requestChanges", status)).toBe(expected);
    }
  });

  it("approves to COMPLETED and sends back to CHANGES_REQUESTED", () => {
    expect(managerTarget("approve")).toBe("COMPLETED");
    expect(managerTarget("requestChanges")).toBe("CHANGES_REQUESTED");
  });
});

describe("manager manual status", () => {
  it("allows housekeeping moves", () => {
    expect(canManagerSetStatus("NEW", "CANCELLED")).toBe(true);
    expect(canManagerSetStatus("CANCELLED", "NEW")).toBe(true);
    expect(canManagerSetStatus("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("never sets review outcomes directly", () => {
    expect(canManagerSetStatus("IN_PROGRESS", "SUBMITTED_FOR_REVIEW")).toBe(false);
    expect(canManagerSetStatus("SUBMITTED_FOR_REVIEW", "CHANGES_REQUESTED")).toBe(false);
  });

  it("rejects no-op moves", () => {
    expect(canManagerSetStatus("NEW", "NEW")).toBe(false);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-05-10T12:00:00Z");
  const past = new Date("2026-05-10T11:00:00Z");
  const future = new Date("2026-05-10T13:00:00Z");

  it("flags open tasks past their deadline", () => {
    expect(isOverdue({ deadline: past, status: "IN_PROGRESS" }, now)).toBe(true);
    expect(isOverdue({ deadline: future, status: "IN_PROGRESS" }, now)).toBe(false);
  });

  it("ignores tasks without a deadline and work that is already handed in or closed", () => {
    expect(isOverdue({ deadline: null, status: "NEW" }, now)).toBe(false);
    expect(isOverdue({ deadline: past, status: "SUBMITTED_FOR_REVIEW" }, now)).toBe(false);
    expect(isOverdue({ deadline: past, status: "COMPLETED" }, now)).toBe(false);
    expect(isOverdue({ deadline: past, status: "CANCELLED" }, now)).toBe(false);
  });
});
