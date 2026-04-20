import type { ActivityStatus } from "@pi-watch/shared";

export interface ActivitySnapshot {
  activity: ActivityStatus;
  lastEventTime: string;
}

export class ActivityTracker {
  activity: ActivityStatus = "idle";
  runningTools = 0;
  permissionStack: ActivityStatus[] = [];
  private lastEventTime = new Date().toISOString();

  snapshot(): ActivitySnapshot {
    return { activity: this.activity, lastEventTime: this.lastEventTime };
  }

  private transition(next: ActivityStatus): void {
    this.activity = next;
    this.lastEventTime = new Date().toISOString();
  }

  onAgentStart(): void {
    this.transition("processing");
  }

  onAgentEnd(): void {
    this.transition("idle");
  }

  onToolStart(): void {
    this.runningTools++;
    this.transition("running_tool");
  }

  onToolEnd(): void {
    if (this.runningTools <= 0) {return;}
    this.runningTools--;
    if (this.runningTools === 0) {
      this.transition("processing");
    } else {
      this.lastEventTime = new Date().toISOString();
    }
  }

  onPermissionStart(): void {
    this.permissionStack.push(this.activity);
    this.transition("pending_approval");
  }

  onPermissionEnd(): void {
    const prev = this.permissionStack.pop() ?? this.activity;
    this.transition(prev);
  }
}
