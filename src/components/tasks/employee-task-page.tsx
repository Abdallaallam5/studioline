import { TaskList } from "@/components/tasks/task-list";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireEmployee } from "@/server/context";
import { findTasks } from "@/server/task-data";

interface Section {
  title: string;
  description?: string;
  filter: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  /** Hide the section entirely when it has no tasks. */
  hideWhenEmpty?: boolean;
  empty?: { title: string; description?: string };
}

/** One of the employee's simple task views: a heading and one or more task lists. */
export async function EmployeeTaskPage({ title, description, sections }: { title: string; description: string; sections: (now: Date, timezone: string) => Section[] }) {
  const ctx = await requireEmployee();
  const tz = ctx.workspace.timezone;
  const resolved = sections(new Date(), tz);
  const lists = await Promise.all(resolved.map((s) => findTasks(ctx, s.filter, s.sort ? { sort: s.sort } : {})));

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="stagger space-y-6">
        {resolved.map((section, i) =>
          section.hideWhenEmpty && lists[i].length === 0 ? null : (
            <Card key={section.title}>
              <CardHeader title={section.title} description={section.description} action={<span className="text-xs tabular-nums text-muted">{lists[i].length}</span>} />
              <TaskList items={lists[i]} hrefBase="/my/tasks" timezone={tz} showAssignee={false} empty={section.empty} />
            </Card>
          ),
        )}
      </div>
    </>
  );
}
