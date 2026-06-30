/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, FunctionDeclaration, Content } from "@google/genai";
import { Task, Activity, PlanRequestPayload, PlanResponsePayload } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to generate unique task IDs
const generateId = () => "task_" + Math.random().toString(36).substring(2, 11);

// Lazy Gemini API Client Initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Settings > Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Declare LMLS Tools
const createTaskDeclaration: FunctionDeclaration = {
  name: "create_task",
  description: "Create a new task and add it to the user's schedule.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The name or title of the task (e.g., 'Finish slide deck', 'Review paper')."
      },
      deadline: {
        type: Type.STRING,
        description: "The deadline or scheduled time (e.g., '5:00 PM today', '2026-06-30 18:00', 'Tomorrow noon')."
      },
      estimatedDuration: {
        type: Type.INTEGER,
        description: "The estimated time required to complete the task in minutes (e.g., 45, 90)."
      },
      priority: {
        type: Type.STRING,
        description: "The priority level of the task.",
        enum: ["High", "Medium", "Low"]
      },
      notes: {
        type: Type.STRING,
        description: "Extra context, subtasks, or description (optional)."
      }
    },
    required: ["title", "deadline", "estimatedDuration", "priority"]
  }
};

const prioritizeTasksDeclaration: FunctionDeclaration = {
  name: "prioritize_tasks",
  description: "Re-order and prioritize the entire list of tasks, defining their order of execution. This sets their relative urgency and schedule positions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskIdsOrdered: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "The complete list of all task IDs, ordered from highest priority (first) to lowest priority (last)."
      },
      reasoning: {
        type: Type.STRING,
        description: "The logical reasoning for this specific ordering. Highlight why the #1 task is the most critical right now."
      }
    },
    required: ["taskIdsOrdered", "reasoning"]
  }
};

const rescheduleTaskDeclaration: FunctionDeclaration = {
  name: "reschedule_task",
  description: "Reschedule or update an existing task's deadline, duration, priority, or status to handle delays or changes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The ID of the task to update."
      },
      newDeadline: {
        type: Type.STRING,
        description: "The new updated deadline or scheduled time (optional)."
      },
      newDuration: {
        type: Type.INTEGER,
        description: "The new estimated duration in minutes (optional)."
      },
      newPriority: {
        type: Type.STRING,
        description: "The new priority level ('High', 'Medium', 'Low') (optional)."
      },
      reasoning: {
        type: Type.STRING,
        description: "The explanation for why this task is being rescheduled (optional)."
      }
    },
    required: ["taskId"]
  }
};

const escalateReminderDeclaration: FunctionDeclaration = {
  name: "escalate_reminder",
  description: "Escalate a critical, heavily delayed, or overdue task, flagging it with a high-visibility warning to ensure immediate action.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The ID of the task requiring escalation."
      },
      escalationReason: {
        type: Type.STRING,
        description: "The warning reason explaining why this task is in a critical/overdue state."
      }
    },
    required: ["taskId", "escalationReason"]
  }
};

const lmlsTools = [
  {
    functionDeclarations: [
      createTaskDeclaration,
      prioritizeTasksDeclaration,
      rescheduleTaskDeclaration,
      escalateReminderDeclaration
    ]
  }
];

// API Route: Handle LMLS Agent Planning & Tool Execution
app.post("/api/plan", async (req, res) => {
  try {
    const { prompt, tasks, currentTime } = req.body as PlanRequestPayload;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const ai = getGeminiClient();

    // Prepare mutable copies of tasks and a list of actions taken
    let localTasks: Task[] = JSON.parse(JSON.stringify(tasks || []));
    const activities: Activity[] = [];

    // System instruction defining LMLS persona, responsibilities, and workflows
    const systemInstruction = `You are 'Last-Minute Life Saver' (LMLS), a brilliant, calm, and proactive scheduling assistant.
Your main job is to help users manage tight schedules, frantic deadlines, and chaotic days.

Current Local Time is: ${currentTime}.

You have access to tools that manipulate the user's structured schedule. You MUST execute these tools when the user dumps tasks, updates schedules, or falls behind:
1. When the user inputs free-text dumps of tasks: Use 'create_task' to add them, and then 'prioritize_tasks' to arrange them optimally.
2. When the user indicates they are behind, overwhelmed, or need to delay/reschedule: Use 'reschedule_task' to adjust durations, deadlines, or priorities, and then re-prioritize with 'prioritize_tasks'.
3. When a critical task has been pushed too far, conflicts heavily, or is extremely overdue: Use 'escalate_reminder' to alert the user.

Always provide a final verbal response summarizing the changes you made, explaining your reasoning, and offering highly supportive advice. Do not output raw Markdown tables of tasks; the UI will render the structured task list. Focus your response on reasoning, encouragement, and clear summaries of actions taken.`;

    // Initialize content list for multi-turn tool interaction
    const stateString = `Current Tasks State:\n${JSON.stringify(localTasks, null, 2)}`;
    const contents: Content[] = [
      {
        role: "user",
        parts: [
          { text: `${stateString}\n\nUser request: "${prompt}"` }
        ]
      }
    ];

    let loopCount = 0;
    const maxLoops = 8;
    let finalReasoning = "I have successfully analyzed your schedule.";

    while (loopCount < maxLoops) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          tools: lmlsTools,
          temperature: 0.3,
        }
      });

      const functionCalls = response.functionCalls;

      // If there are no further function calls, we are finished!
      if (!functionCalls || functionCalls.length === 0) {
        if (response.text) {
          finalReasoning = response.text;
        }
        break;
      }

      // Record model's response to maintain chat history
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      } else {
        // Fallback content block
        contents.push({
          role: "model",
          parts: [{ text: "Invoking tools..." }]
        });
      }

      const toolParts: any[] = [];

      for (const call of functionCalls) {
        const { name, args, id } = call;
        let result: any = { success: false, error: "Unknown tool" };

        try {
          if (name === "create_task") {
            const { title, deadline, estimatedDuration, priority, notes } = args as any;
            const newId = generateId();
            const newTask: Task = {
              id: newId,
              title: title || "Untitled Task",
              deadline: deadline || "As soon as possible",
              estimatedDuration: Number(estimatedDuration) || 30,
              priority: (priority as any) || "Medium",
              status: "Pending",
              notes: notes || "",
              orderIndex: localTasks.length
            };
            localTasks.push(newTask);
            result = { success: true, taskId: newId, message: `Created task "${title}"` };

            activities.push({
              id: "act_" + generateId(),
              timestamp: new Date().toISOString(),
              type: "create_task",
              details: `Created high-priority task: "${title}" (Est. ${estimatedDuration}m)`,
              params: args
            });

          } else if (name === "prioritize_tasks") {
            const { taskIdsOrdered, reasoning: priorityReasoning } = args as any;
            if (Array.isArray(taskIdsOrdered)) {
              // Re-assign order indices based on ordered array
              taskIdsOrdered.forEach((tid: string, index: number) => {
                const task = localTasks.find(t => t.id === tid);
                if (task) {
                  task.orderIndex = index;
                }
              });
              // Sort the local array based on orderIndex
              localTasks.sort((a, b) => a.orderIndex - b.orderIndex);
              result = { success: true, message: "Tasks successfully re-ordered" };

              activities.push({
                id: "act_" + generateId(),
                timestamp: new Date().toISOString(),
                type: "prioritize_tasks",
                details: `Prioritized schedule: ${priorityReasoning}`,
                params: args
              });
            } else {
              result = { success: false, error: "taskIdsOrdered must be an array" };
            }

          } else if (name === "reschedule_task") {
            const { taskId, newDeadline, newDuration, newPriority, reasoning } = args as any;
            const task = localTasks.find(t => t.id === taskId);
            if (task) {
              if (newDeadline !== undefined) task.deadline = newDeadline;
              if (newDuration !== undefined) task.estimatedDuration = Number(newDuration);
              if (newPriority !== undefined) task.priority = newPriority;
              if (reasoning) {
                task.notes = task.notes ? `${task.notes}\n[Rescheduled: ${reasoning}]` : `[Rescheduled: ${reasoning}]`;
              }
              result = { success: true, message: `Updated task ${taskId}` };

              activities.push({
                id: "act_" + generateId(),
                timestamp: new Date().toISOString(),
                type: "reschedule_task",
                details: `Rescheduled "${task.title}": ${reasoning || "Adjusted details"}`,
                params: args
              });
            } else {
              result = { success: false, error: `Task with ID ${taskId} not found` };
            }

          } else if (name === "escalate_reminder") {
            const { taskId, escalationReason } = args as any;
            const task = localTasks.find(t => t.id === taskId);
            if (task) {
              task.priority = "High";
              task.notes = task.notes ? `${task.notes}\n⚠️ [ESCALATION WARNING: ${escalationReason}]` : `⚠️ [ESCALATION WARNING: ${escalationReason}]`;
              result = { success: true, message: `Escalated task ${taskId}` };

              activities.push({
                id: "act_" + generateId(),
                timestamp: new Date().toISOString(),
                type: "escalate_reminder",
                details: `⚠️ ESCALATION ALERT on "${task.title}": ${escalationReason}`,
                params: args
              });
            } else {
              result = { success: false, error: `Task with ID ${taskId} not found` };
            }
          }
        } catch (err: any) {
          result = { success: false, error: err.message };
        }

        toolParts.push({
          functionResponse: {
            name,
            response: { result }
          }
        });
      }

      // Append tool response turn to history
      contents.push({
        role: "tool",
        parts: toolParts
      });

      loopCount++;
    }

    const responsePayload: PlanResponsePayload = {
      tasks: localTasks,
      activities,
      reasoning: finalReasoning
    };

    res.json(responsePayload);
  } catch (error: any) {
    console.error("LMLS agent planning failed:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Configure Vite or Static Production Server serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LMLS server running on http://localhost:${PORT}`);
  });
}

startServer();
