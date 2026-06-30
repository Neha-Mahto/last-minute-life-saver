/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Task {
  id: string;
  title: string;
  deadline: string; // human readable (e.g. "5:00 PM today") or ISO/date string
  estimatedDuration: number; // in minutes
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Completed' | 'Overdue';
  notes?: string;
  orderIndex: number; // position in the sorted schedule
}

export interface Activity {
  id: string;
  timestamp: string;
  type: 'create_task' | 'prioritize_tasks' | 'reschedule_task' | 'escalate_reminder';
  details: string;
  params: any;
}

export interface PlanRequestPayload {
  prompt: string;
  tasks: Task[];
  currentTime: string;
}

export interface PlanResponsePayload {
  tasks: Task[];
  activities: Activity[];
  reasoning: string;
}
