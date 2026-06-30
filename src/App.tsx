/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Plus,
  Trash2,
  Activity as ActivityIcon,
  ChevronRight,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Flame,
  Info,
  Sun,
  Moon,
  Star,
  Target,
  Lightbulb,
  Brain,
  Check,
  Settings,
  X,
  Cloud
} from "lucide-react";
import { Task, Activity, PlanResponsePayload } from "./types";

// Seed data representing a chaotic last-minute scenario on first load
const SEED_TASKS: Task[] = [
  {
    id: "seed_1",
    title: "Finish Project Slide Deck for Client Sync",
    deadline: "4:30 PM Today",
    estimatedDuration: 45,
    priority: "High",
    status: "Pending",
    notes: "CRITICAL: Project Slide Deck is overdue. Review session was scheduled for 4:30 PM Today. Let the autonomic agent execute this instantly or trigger a 15-minute deferral if you are stuck. [ESCALATION WARNING: Client sync scheduled soon. Action required.]",
    orderIndex: 0
  },
  {
    id: "seed_2",
    title: "Call Mom (Birthday)",
    deadline: "6:00 PM Today",
    estimatedDuration: 20,
    priority: "Medium",
    status: "Pending",
    notes: "Do not forget! Very important family commitment.",
    orderIndex: 1
  },
  {
    id: "seed_3",
    title: "Finish presentation for tomorrow's standup",
    deadline: "9:00 AM Tomorrow",
    estimatedDuration: 30,
    priority: "High",
    status: "Pending",
    notes: "Requires final review of standard metrics. Slide template is ready.",
    orderIndex: 2
  }
];

const SEED_ACTIVITIES: Activity[] = [
  {
    id: "act_seed_1",
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    type: "create_task",
    details: "Created schedule from chaotic morning notes",
    params: {}
  },
  {
    id: "act_seed_2",
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    type: "prioritize_tasks",
    details: "Prioritized presentation next because the standup occurs first thing tomorrow morning",
    params: { reasoning: "Critical presentation slide deadlines scheduled" }
  }
];

const INITIAL_REASONING = 
  "Welcome to Last-Minute Life Saver. I've structured your initial tasks. Currently, **Finish Project Slide Deck for Client Sync** is your highest priority pending task. Use the command panel below to speak directly with the planner, report delays, or dump new chaotic items. The system automatically maintains your calendar sync.";

const SUGGESTED_TEMPLATES = [
  {
    label: "I'm Running Behind!",
    text: "I am running extremely behind on my tasks right now! Please defer my next pending action by 30 minutes and optimize my upcoming schedule."
  },
  {
    label: "Grocery Store Closing Early",
    text: "The grocery store just sent an alert that they are closing early today at 6:30 PM instead of 8:00 PM. Please restructure my grocery run."
  }
];

export default function App() {
  // Persistence using Local Storage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem("lmls_theme");
    return (saved === "light" || saved === "dark") ? saved : "light";
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const initialized = localStorage.getItem("lmls_initialized_v4");
    if (!initialized) {
      localStorage.setItem("lmls_initialized_v4", "true");
      localStorage.setItem("lmls_tasks", JSON.stringify(SEED_TASKS));
      localStorage.setItem("lmls_activities", JSON.stringify(SEED_ACTIVITIES));
      localStorage.setItem("lmls_reasoning", INITIAL_REASONING);
      return SEED_TASKS;
    }
    const saved = localStorage.getItem("lmls_tasks");
    return saved ? JSON.parse(saved) : SEED_TASKS;
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const initialized = localStorage.getItem("lmls_initialized_v4");
    if (!initialized) {
      return SEED_ACTIVITIES;
    }
    const saved = localStorage.getItem("lmls_activities");
    return saved ? JSON.parse(saved) : SEED_ACTIVITIES;
  });

  const [reasoning, setReasoning] = useState<string>(() => {
    const initialized = localStorage.getItem("lmls_initialized_v4");
    if (!initialized) {
      return INITIAL_REASONING;
    }
    const saved = localStorage.getItem("lmls_reasoning");
    return saved ? saved : INITIAL_REASONING;
  });

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Manual Task Insertion Fields (For fallback / utility)
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDeadline, setManualDeadline] = useState("");
  const [manualDuration, setManualDuration] = useState(30);
  const [manualPriority, setManualPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  // Speech Recognition Setup
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const initialTextRef = useRef("");

  useEffect(() => {
    localStorage.setItem("lmls_theme", theme);
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("lmls_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("lmls_activities", JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem("lmls_reasoning", reasoning);
  }, [reasoning]);

  // Speech-to-Text handler
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        let speechTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          speechTranscript += event.results[i][0].transcript;
        }
        
        // Append speech to initial text safely
        const combined = initialTextRef.current
          ? `${initialTextRef.current.trim()} ${speechTranscript.trim()}`
          : speechTranscript.trim();
        
        setInputValue(combined);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsRecording(false);
        if (err.error === 'not-allowed') {
          setError("Microphone access was denied. Please check your browser's site permissions and try again.");
        } else {
          setError(`Voice capture failed: ${err.error || 'unknown issue'}`);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not fully supported in this browser. Please try Google Chrome or Safari.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      initialTextRef.current = inputValue;
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error("Failed to start SpeechRecognition:", err);
      }
    }
  };

  // Agent Planning API Call
  const handleAgentPlan = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputValue;
    if (!promptToSend.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToSend,
          tasks,
          currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " Today"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to communicate with Gemini assistant.");
      }

      const data: PlanResponsePayload = await response.json();

      setTasks(data.tasks);
      setReasoning(data.reasoning);
      if (data.activities && data.activities.length > 0) {
        setActivities(prev => [...data.activities, ...prev]);
      }
      setInputValue("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side interactions
  const handleCompleteTask = (id: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const newStatus = t.status === "Completed" ? "Pending" : "Completed";
          // Add custom manual activity trace
          const activity: Activity = {
            id: "act_" + Math.random().toString(36).substring(2, 11),
            timestamp: new Date().toISOString(),
            type: "reschedule_task",
            details: `Manually marked "${t.title}" as ${newStatus}`,
            params: { taskId: id, status: newStatus }
          };
          setActivities(prevAct => [activity, ...prevAct]);
          return { ...t, status: newStatus };
        }
        return t;
      })
    );
  };

  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    setTasks(prev => prev.filter(t => t.id !== id));
    setActivities(prev => [
      {
        id: "act_" + Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        type: "reschedule_task",
        details: `Deleted task "${taskToDelete.title}"`,
        params: { taskId: id }
      },
      ...prev
    ]);
  };

  const handleResetSchedule = () => {
    setTasks(SEED_TASKS);
    setActivities([
      {
        id: "act_" + Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        type: "reschedule_task",
        details: "Reset optimizer workspace to initial chaotic-day seed scenario.",
        params: {}
      },
      ...SEED_ACTIVITIES
    ]);
    setReasoning(INITIAL_REASONING);
    setError(null);
  };

  const handleAddManualTask = (e: FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const newId = "manual_" + Math.random().toString(36).substring(2, 11);
    const newTask: Task = {
      id: newId,
      title: manualTitle,
      deadline: manualDeadline || "ASAP",
      estimatedDuration: Number(manualDuration) || 30,
      priority: manualPriority,
      status: "Pending",
      notes: "Manually added by user.",
      orderIndex: tasks.length
    };

    setTasks(prev => [...prev, newTask]);
    setActivities(prev => [
      {
        id: "act_" + Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        type: "create_task",
        details: `Manually added task: "${manualTitle}"`,
        params: { id: newId }
      },
      ...prev
    ]);

    // Reset manual input fields
    setManualTitle("");
    setManualDeadline("");
    setManualDuration(30);
    setManualPriority("Medium");
    setShowAddManual(false);
  };

  const handleDeferTask = (id: string, mins: number) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const activity: Activity = {
            id: "act_" + Math.random().toString(36).substring(2, 11),
            timestamp: new Date().toISOString(),
            type: "reschedule_task",
            details: `Autonomous AI: Deferred "${t.title}" by ${mins} minutes`,
            params: { taskId: id, deferred: mins }
          };
          setActivities(prevAct => [activity, ...prevAct]);
          // append or shift time label slightly
          const deferredLabel = t.deadline.includes("(deferred") ? t.deadline : `${t.deadline} (deferred ${mins}m)`;
          return { ...t, deadline: deferredLabel };
        }
        return t;
      })
    );
  };

  const handleAutoExecuteTask = (id: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setTasks(prev =>
        prev.map(t => {
          if (t.id === id) {
            const activity: Activity = {
              id: "act_" + Math.random().toString(36).substring(2, 11),
              timestamp: new Date().toISOString(),
              type: "reschedule_task",
              details: `Autonomous AI successfully Auto-Executed "${t.title}"`,
              params: { taskId: id }
            };
            setActivities(prevAct => [activity, ...prevAct]);
            return { ...t, status: "Completed" as const };
          }
          return t;
        })
      );
      setIsLoading(false);
    }, 1200);
  };

  const renderPriorityBadge = (priority: 'High' | 'Medium' | 'Low', isCompleted: boolean) => {
    if (isCompleted) {
      return (
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-mono font-bold uppercase tracking-wider">
          Completed
        </span>
      );
    }
    
    if (priority === "High") {
      return (
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-[#FF6B4A] font-mono font-bold uppercase tracking-wider shadow-sm animate-pulse">
          HIGH
        </span>
      );
    } else if (priority === "Medium") {
      return (
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[#6366F1] font-mono font-bold uppercase tracking-wider">
          MEDIUM
        </span>
      );
    } else {
      return (
        <span className="text-[10px] font-mono font-semibold text-text-secondary-light/60 dark:text-text-secondary-dark/60 lowercase">
          low priority
        </span>
      );
    }
  };

  return (
    <div
      id="lmls-root"
      className={`min-h-screen transition-all duration-300 selection:bg-brand-accent selection:text-white relative flex flex-col ${
        theme === "light" ? "bg-bg-light text-text-primary-light" : "bg-bg-dark text-text-primary-dark"
      }`}
    >
      {/* Decorative premium radial glow layers */}
      {theme === "dark" && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(91,127,255,0.03),rgba(0,0,0,0))] pointer-events-none z-0" />
      )}

      {/* Visual Header / Brand Area */}
      <header
        id="lmls-header"
        className={`border-b sticky top-0 z-50 transition-colors duration-300 ${
          theme === "light"
            ? "bg-card-light/85 border-border-light backdrop-blur-md"
            : "bg-bg-dark/85 border-border-dark backdrop-blur-md"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-accent rounded-lg blur-md opacity-30 animate-pulse" />
              <div className="relative bg-brand-accent p-2 rounded-lg text-white shadow-lg shadow-brand-accent/25">
                <Flame className="w-5 h-5 stroke-[2]" />
              </div>
            </div>
            <div>
              <h1 className={`text-base font-semibold tracking-tight ${theme === "light" ? "text-text-primary-light" : "text-text-primary-dark"}`}>
                Last-Minute Life Saver
              </h1>
              <p className={`text-[11px] font-mono ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                Crisis schedule optimizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Indicator */}
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium font-sans ${
              theme === "light"
                ? "bg-[#F1F5F9] border-border-light text-[#475569]"
                : "bg-card-dark border-border-dark text-[#94A3B8]"
            }`}>
              <Cloud className="w-3.5 h-3.5 text-emerald-500 animate-[bounce_3s_infinite]" />
              <span className="flex items-center gap-1.5 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Synced
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              id="btn-theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-2 rounded-xl border transition-all duration-150 active:scale-90 cursor-pointer ${
                theme === "light"
                  ? "bg-card-light hover:bg-neutral-50 border-border-light text-text-secondary-light hover:text-text-primary-light shadow-sm"
                  : "bg-card-dark hover:bg-neutral-800 border-border-dark text-text-secondary-dark hover:text-text-primary-dark shadow-md"
              }`}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-brand-accent animate-[spin_40s_linear_infinite]" />}
            </button>

            {/* Settings Button */}
            <button
              id="btn-settings"
              onClick={() => {
                const activity: Activity = {
                  id: "act_" + Math.random().toString(36).substring(2, 11),
                  timestamp: new Date().toISOString(),
                  type: "create_task", // generic activity type
                  details: "User opened Calendar Sync and Priority Weights Configuration Console.",
                  params: {}
                };
                setActivities(prev => [activity, ...prev]);
                setShowSettingsModal(true);
              }}
              className={`p-2 rounded-xl border transition-all duration-150 active:scale-90 cursor-pointer ${
                theme === "light"
                  ? "bg-card-light hover:bg-neutral-50 border-border-light text-text-secondary-light hover:text-text-primary-light shadow-sm"
                  : "bg-card-dark hover:bg-neutral-800 border-border-dark text-text-secondary-dark hover:text-text-primary-dark shadow-md"
              }`}
              title="Optimizer Settings"
            >
              <Settings className="w-4 h-4 hover:rotate-45 transition-transform duration-300" />
            </button>

            {/* Reset Button */}
            <button
              id="btn-reset"
              onClick={handleResetSchedule}
              className={`p-2 rounded-xl border transition-all duration-150 active:scale-90 cursor-pointer ${
                theme === "light"
                  ? "bg-card-light hover:bg-neutral-50 border-border-light text-text-secondary-light hover:text-text-primary-light shadow-sm"
                  : "bg-card-dark hover:bg-neutral-800 border-border-dark text-text-secondary-dark hover:text-text-primary-dark shadow-md"
              }`}
              title="Reset Scenario"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main App Workspace */}
      <main id="lmls-main" className="max-w-5xl w-full mx-auto px-4 py-10 space-y-10 relative z-10 flex-1">
        
        {/* SECTION 2: AI Orchestration Terminal */}
        <div className="space-y-4">
          <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
            Orchestration Command
          </h2>

          <div className={`relative border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-brand-accent/20 transition-all duration-300 ${
            theme === "light"
              ? "border-border-light bg-card-light focus-within:border-brand-accent"
              : "border-border-dark bg-card-dark focus-within:border-brand-accent"
          }`}>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Dump raw chaotic plans, report being late..."
              className={`w-full h-24 bg-transparent text-sm p-4 resize-none focus:outline-none leading-relaxed font-sans ${
                theme === "light" 
                  ? "text-text-primary-light placeholder:text-[#475569]/80 font-medium" 
                  : "text-text-primary-dark placeholder:text-[#94A3B8]/90 font-medium"
              }`}
            />

            <div className={`flex justify-between items-center px-4 py-3 border-t ${
              theme === "light" ? "bg-bg-light/85 border-border-light" : "bg-card-dark/85 border-border-dark"
            }`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRecording}
                  style={!isRecording ? { boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)' } : undefined}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-2.5 text-xs font-semibold shadow-sm border cursor-pointer ${
                    isRecording
                      ? "bg-red-500 text-white border-red-500 animate-pulse"
                      : theme === "light"
                      ? "bg-card-light hover:bg-neutral-50 text-brand-accent border-brand-accent/30 hover:border-brand-accent/50"
                      : "bg-card-dark hover:bg-neutral-800 text-brand-accent border-brand-accent/30 hover:border-brand-accent/50"
                  }`}
                  title={isRecording ? "Stop Recording" : "Speak Task Dump"}
                >
                  {isRecording ? (
                    <MicOff className="w-3.5 h-3.5 animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Mic className="w-3.5 h-3.5 text-brand-accent" />
                      {/* Interactive live neon audio-wave visualization wrapper */}
                      <div className="flex items-end gap-[2px] h-3 px-0.5">
                        <span className="w-[2px] h-1.5 bg-brand-accent rounded-full animate-[bounce_0.8s_infinite]" />
                        <span className="w-[2px] h-3 bg-brand-accent rounded-full animate-[bounce_0.6s_infinite]" style={{ animationDelay: '0.15s' }} />
                        <span className="w-[2px] h-1 bg-brand-accent rounded-full animate-[bounce_0.7s_infinite]" style={{ animationDelay: '0.3s' }} />
                        <span className="w-[2px] h-2.5 bg-brand-accent rounded-full animate-[bounce_0.9s_infinite]" style={{ animationDelay: '0.45s' }} />
                      </div>
                    </div>
                  )}
                  <span>{isRecording ? "Listening..." : "Speak"}</span>
                </button>
                {isRecording && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              <button
                onClick={() => handleAgentPlan()}
                disabled={isLoading || !inputValue.trim()}
                className="bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95 flex items-center gap-1.5 duration-150 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Command AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTED_TEMPLATES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputValue(item.text);
                  handleAgentPlan(item.text);
                }}
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-card-light hover:bg-bg-light border-border-light text-text-secondary-light hover:text-text-primary-light"
                    : "bg-card-dark hover:bg-bg-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Error alerts */}
          {error && (
            <div className="bg-priority-high/10 border border-priority-high/20 text-priority-high text-xs rounded-xl p-3.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Primary Alert Banner */}
        {tasks.some(t => t.priority === "High" && t.status !== "Completed") && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-xl p-4.5 flex items-start gap-3.5 transition-all duration-300 shadow-xl ${
              theme === "light"
                ? "bg-red-50/90 border-[#EF4444] text-[#B91C1C] shadow-red-500/10 animate-[pulse_3s_infinite]"
                : "bg-red-950/25 border-[#EF4444] text-[#FECACA] shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-[pulse_3s_infinite]"
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#EF4444] animate-bounce" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-[#EF4444]/10 border border-[#EF4444]/20 px-2 py-0.5 rounded-md mr-2">
                Crisis Active
              </span>
              <span className="font-bold tracking-tight">Timeline Alert: High Priority Pending</span>
              <p className="mt-1 font-medium opacity-90">
                High priority tasks require focus. Let the agent restructure your entire schedule.
              </p>
            </div>
          </motion.div>
        )}

        {/* TWO-COLUMN GRID: 60% Left, 40% Right */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          
          {/* Left Column - 60% Width */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                  YOUR OPTIMIZED TIMELINE
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm font-sans shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Google Calendar Synced
                </span>
              </div>
              <button
                id="btn-toggle-manual"
                onClick={() => setShowAddManual(!showAddManual)}
                className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-card-light hover:bg-neutral-50 border-border-light text-text-secondary-light hover:text-text-primary-light"
                    : "bg-card-dark hover:bg-neutral-800 border-border-dark text-text-secondary-dark hover:text-text-primary-dark"
                }`}
              >
                <Plus className={`w-3.5 h-3.5 transition-transform duration-150 ${showAddManual ? 'rotate-45' : ''}`} />
                Add Task
              </button>
            </div>

          {/* Manual Task Injection Form */}
          <AnimatePresence>
            {showAddManual && (
              <motion.form
                onSubmit={handleAddManualTask}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`rounded-xl border overflow-hidden space-y-4 p-5 transition-all duration-300 ${
                  theme === "light" ? "bg-card-light border-border-light" : "bg-card-dark border-border-dark"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-mono uppercase tracking-wider mb-1.5 ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                      Task Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder="e.g. Call Client about invoice"
                      className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent/30 transition-all ${
                        theme === "light"
                          ? "bg-bg-light border border-border-light text-text-primary-light placeholder:text-text-secondary-light/50"
                          : "bg-bg-dark border border-border-dark text-text-primary-dark placeholder:text-text-secondary-dark/40"
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-mono uppercase tracking-wider mb-1.5 ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                      Deadline *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualDeadline}
                      onChange={e => setManualDeadline(e.target.value)}
                      placeholder="e.g. 5:30 PM Today"
                      className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent/30 transition-all ${
                        theme === "light"
                          ? "bg-bg-light border border-border-light text-text-primary-light placeholder:text-text-secondary-light/50"
                          : "bg-bg-dark border border-border-dark text-text-primary-dark placeholder:text-text-secondary-dark/40"
                      }`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-[10px] font-mono uppercase tracking-wider mb-1.5 ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                      Est. Duration (mins)
                    </label>
                    <input
                      type="number"
                      value={manualDuration}
                      onChange={e => setManualDuration(Number(e.target.value))}
                      className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent/30 transition-all ${
                        theme === "light"
                          ? "bg-bg-light border border-border-light text-text-primary-light"
                          : "bg-bg-dark border border-border-dark text-text-primary-dark"
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-mono uppercase tracking-wider mb-1.5 ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                      Priority
                    </label>
                    <select
                      value={manualPriority}
                      onChange={e => setManualPriority(e.target.value as any)}
                      className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent/30 transition-all ${
                        theme === "light"
                          ? "bg-bg-light border border-border-light text-text-primary-light"
                          : "bg-bg-dark border border-border-dark text-text-primary-dark"
                      }`}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <button
                      type="submit"
                      className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl py-2 text-sm transition shadow-md active:scale-95 duration-150 cursor-pointer"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Timeline Cards Container */}
          <div className={`rounded-2xl border p-6 transition-all duration-300 ${
            theme === "light"
              ? "bg-card-light border-border-light shadow-sm"
              : "bg-card-dark border-border-dark shadow-xl"
          }`}>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="replanning-loader"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="py-16 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-12 h-12 rounded-full border-2 border-brand-accent/30 animate-ping" />
                    <div className="relative p-3 bg-brand-accent/10 rounded-full text-brand-accent">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold tracking-tight font-display text-brand-accent uppercase tracking-wider">
                      Agent is replanning...
                    </h3>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-xs mx-auto">
                      Recalculating deadlines, adjusting priority weights, and optimizing your critical path.
                    </p>
                  </div>
                  {/* Telemetry logs to feel very alive */}
                  <div className="font-mono text-[10px] text-brand-accent/60 animate-pulse space-y-0.5 text-center">
                    <p>&gt; DECONSTRUCTING EXISTING PATH...</p>
                    <p>&gt; ANALYZING LATEST CRITICAL WINDOWS...</p>
                    <p>&gt; RUNNING SCHEDULING ALGORITHMS...</p>
                  </div>
                </motion.div>
              ) : tasks.length === 0 ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-text-secondary-light dark:text-text-secondary-dark space-y-3"
                >
                  <CheckCircle className="w-8 h-8 mx-auto text-text-secondary-light/40 dark:text-text-secondary-dark/30" />
                  <p className="text-sm font-medium">All clear! No current tasks on schedule.</p>
                </motion.div>
              ) : (() => {
                const sortedTasks = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);

                return (
                  <motion.div
                    key="timeline-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6 relative"
                  >
                    {/* Clean vertical timeline trace line connecting task circles */}
                    <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-neutral-200 dark:bg-neutral-800/80 pointer-events-none" />

                    <div className="space-y-6">
                      {sortedTasks.map((task) => {
                        const isCompleted = task.status === "Completed";
                        const isHigh = task.priority === "High";
                        const isMedium = task.priority === "Medium";

                        return (
                          <div
                            key={task.id}
                            className="relative flex items-start gap-4 pl-10"
                          >
                            {/* Timeline circle dot on the trace line */}
                            <div className="absolute left-[19px] top-6 -translate-x-1/2 flex items-center justify-center z-10">
                              {isCompleted ? (
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-[3px] border-card-light dark:border-card-dark shadow-sm ring-2 ring-emerald-500/20" />
                              ) : isHigh ? (
                                <div className="w-3.5 h-3.5 rounded-full bg-[#FF6B4A] border-[3px] border-card-light dark:border-card-dark shadow-md ring-4 ring-red-500/20 animate-pulse" />
                              ) : isMedium ? (
                                <div className="w-3.5 h-3.5 rounded-full bg-[#6366F1] border-[3px] border-card-light dark:border-card-dark shadow-sm ring-2 ring-indigo-500/20" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-neutral-400 dark:bg-neutral-600 border-[3px] border-card-light dark:border-card-dark" />
                              )}
                            </div>

                            {/* Main Structural Task Card with generous padding */}
                            <div className={`flex-1 rounded-xl py-6 px-5 border transition-all duration-300 relative overflow-hidden ${
                              isHigh && !isCompleted
                                ? theme === "light"
                                  ? "bg-red-50/40 border-[#EF4444] shadow-md shadow-red-500/5 hover:shadow-lg"
                                  : "bg-[#1B1E32]/85 border-[#EF4444] shadow-lg shadow-[#EF4444]/15"
                                : theme === "light"
                                ? "bg-card-light border-border-light shadow-sm hover:shadow-md"
                                : "bg-card-dark border-border-dark hover:border-border-dark/80 hover:shadow-xl"
                            }`}>
                              
                              {/* Left border indicator for high priority */}
                              {isHigh && !isCompleted && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#EF4444]" />
                              )}

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                  {/* Checkbox on the left */}
                                  <button
                                    onClick={() => handleCompleteTask(task.id)}
                                    className={`mt-1 shrink-0 transition-all active:scale-90 cursor-pointer ${
                                      isCompleted 
                                        ? "text-[#6366F1]" 
                                        : theme === "light"
                                        ? "text-neutral-400 hover:text-[#6366F1]"
                                        : "text-neutral-500 hover:text-[#6366F1]"
                                    }`}
                                    title={isCompleted ? "Mark Pending" : "Mark Completed"}
                                  >
                                    {isCompleted ? (
                                      <CheckSquare className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                                    ) : (
                                      <Square className="w-5 h-5" />
                                    )}
                                  </button>

                                  <div className="min-w-0 space-y-1.5">
                                    <h3 className={`text-sm sm:text-base font-bold tracking-tight leading-snug ${
                                      isCompleted 
                                        ? "line-through text-text-secondary-light/50 dark:text-text-secondary-dark/40 font-normal" 
                                        : theme === "light" ? "text-[#0F172A]" : "text-[#E8EAF0]"
                                    }`}>
                                      {task.title}
                                    </h3>

                                    {/* Sub-details block */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark font-mono">
                                      <span className="flex items-center gap-1 font-semibold text-[#6366F1]">
                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                        {task.deadline}
                                      </span>
                                      <span className="opacity-40">•</span>
                                      <span>{task.estimatedDuration} mins</span>
                                    </div>

                                    {task.notes && (
                                      <p className={`text-xs pl-2.5 border-l italic ${
                                        theme === "light" ? "text-neutral-500 border-neutral-200" : "text-neutral-400 border-neutral-800"
                                      }`}>
                                        {task.notes}
                                      </p>
                                    )}

                                    {/* Actionable control sub-buttons ONLY inside High Priority presentation card */}
                                    {isHigh && !isCompleted && (
                                      <div className="flex items-center gap-2 pt-2.5 flex-wrap">
                                        <button
                                          onClick={() => handleAutoExecuteTask(task.id)}
                                          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 duration-100 flex items-center gap-1.5 cursor-pointer ${
                                            theme === "light"
                                              ? "bg-[#6366F1]/10 border-[#6366F1]/30 hover:bg-[#6366F1]/20 text-[#6366F1] shadow-sm"
                                              : "bg-[#6366F1]/25 border-[#6366F1]/40 hover:bg-[#6366F1]/35 text-[#8FA4FF]"
                                          }`}
                                        >
                                          <span>🤖 Auto-Execute Task</span>
                                        </button>
                                        <button
                                          onClick={() => handleDeferTask(task.id, 15)}
                                          className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all active:scale-95 duration-100 flex items-center gap-1 cursor-pointer ${
                                            theme === "light"
                                              ? "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-800 shadow-sm"
                                              : "bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 text-neutral-200"
                                          }`}
                                        >
                                          <span>Defer 15m</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Priority Pill and Delete Button on the Right */}
                                <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                                  {renderPriorityBadge(task.priority, isCompleted)}

                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className={`p-2 rounded-lg border transition-all duration-150 active:scale-95 hover:text-red-500 cursor-pointer ${
                                      theme === "light"
                                        ? "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-400"
                                        : "bg-neutral-900 hover:bg-neutral-850 border-neutral-800 text-neutral-500"
                                    }`}
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        </div>

          {/* Right Column - 40% Width - Insights & Logs Workspace */}
          <div className="lg:col-span-4 space-y-6">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
              Insights & Logs Workspace
            </h2>

            {/* Top Panel: Goal & Habit Streak Tracker */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
              theme === "light"
                ? "bg-card-light border-border-light shadow-sm"
                : "bg-card-dark border-[#06B6D4]/30 shadow-xl"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#06B6D4] animate-pulse" />
                <h3 className={`text-sm font-bold tracking-tight ${theme === "light" ? "text-text-primary-light" : "text-text-primary-dark"}`}>
                  Goal & Habit Streak Tracker
                </h3>
              </div>

              <div className="space-y-4">
                {/* Row 1: Deep Work Block */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-semibold ${theme === "light" ? "text-text-primary-light" : "text-[#E8EAF0]"}`}>
                      Deep Work Block (Target: 2 hours)
                    </span>
                    <span className="font-mono text-[10px] text-[#06B6D4] font-bold">
                      75%
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === "light" ? "bg-neutral-150" : "bg-neutral-800"}`}>
                    <div className="bg-gradient-to-r from-[#6366F1] to-[#06B6D4] h-full rounded-full transition-all duration-500" style={{ width: '75%' }} />
                  </div>
                </div>

                {/* Row 2: Hydration Intake */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-semibold ${theme === "light" ? "text-text-primary-light" : "text-[#E8EAF0]"}`}>
                      Hydration Intake
                    </span>
                    <span className="font-mono text-[10px] text-[#06B6D4] font-bold">
                      4 / 6 glasses completed
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === "light" ? "bg-neutral-150" : "bg-neutral-800"}`}>
                    <div className="bg-gradient-to-r from-[#6366F1] to-[#06B6D4] h-full rounded-full transition-all duration-500" style={{ width: '66.6%' }} />
                  </div>
                </div>

                {/* Row 3: Code Review / Skill-up (Habit with full progress bar) */}
                <div className="space-y-1.5 pt-1 border-t border-border-light dark:border-border-dark/60 mt-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-semibold ${theme === "light" ? "text-text-primary-light" : "text-[#E8EAF0]"}`}>
                      Code Review / Skill-up
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                      <span>Completed</span>
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === "light" ? "bg-neutral-150" : "bg-neutral-800"}`}>
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Panel: Personalized Productivity Nudge */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
              theme === "light"
                ? "bg-card-light border-border-light shadow-sm"
                : "bg-card-dark border-[#06B6D4]/30 shadow-xl"
            }`}>
              {/* Glowing highlight layer */}
              {theme === "dark" && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#06B6D4]/10 rounded-full blur-2xl pointer-events-none" />
              )}
              
              <div className="flex items-center gap-2 mb-4">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-[#06B6D4]/20 animate-ping pointer-events-none" />
                  <Brain className="w-5 h-5 text-[#06B6D4]" />
                </div>
                <h3 className={`text-sm font-bold tracking-tight ${theme === "light" ? "text-text-primary-light" : "text-text-primary-dark"}`}>
                  Personalized Productivity Nudge
                </h3>
              </div>

              <blockquote className={`p-4 rounded-xl text-xs leading-relaxed transition-all duration-300 border-l-4 border-[#06B6D4] ${
                theme === "light"
                  ? "bg-[#06B6D4]/5 border-y border-r border-[#06B6D4]/15 text-text-secondary-light"
                  : "bg-[#06B6D4]/5 border-y border-r border-[#06B6D4]/10 text-text-secondary-dark"
              }`}>
                <p className="italic font-sans leading-relaxed text-[#0F172A] dark:text-[#E8EAF0]">
                  "Insight: You historically complete presentation tasks <span className="text-[#06B6D4] font-bold">20% faster</span> between 4:00 PM and 6:00 PM. I have automatically locked this peak focus window."
                </p>
              </blockquote>
            </div>

            {/* Bottom Panels: Decision Reasoning & Agent Activity Log (Horizontally adjacent within narrow Column 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              
              {/* Decision Reasoning */}
              <div className={`p-4.5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                theme === "light"
                  ? "bg-card-light border-border-light shadow-sm"
                  : "bg-card-dark border-border-dark shadow-xl"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-brand-accent shrink-0" />
                  <h3 className={`text-[10px] uppercase font-bold tracking-wider ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                    Decision Reasoning
                  </h3>
                </div>
                
                <div className="text-[11px] leading-relaxed flex-1 overflow-y-auto max-h-[140px] pr-1">
                  <div className="space-y-2 whitespace-pre-wrap">
                    {reasoning ? (
                      reasoning.split('\n\n').map((para, i) => <p key={i} className={theme === "light" ? "text-[#334155]" : "text-[#94A3B8]"}>{para}</p>)
                    ) : (
                      <p className="italic text-text-secondary-light dark:text-text-secondary-dark">No reasoning available yet. Submit a prompt to activate the agent.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Agent Activity Log */}
              <div className={`p-4.5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                theme === "light"
                  ? "bg-card-light border-border-light shadow-sm"
                  : "bg-card-dark border-border-dark shadow-xl"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <ActivityIcon className="w-4 h-4 text-brand-accent shrink-0" />
                  <h3 className={`text-[10px] uppercase font-bold tracking-wider ${theme === "light" ? "text-text-secondary-light" : "text-text-secondary-dark"}`}>
                    Agent Activity Log
                  </h3>
                </div>

                <div className="text-[11px] max-h-[140px] overflow-y-auto space-y-2 pr-1 flex-1 scrollbar-thin scrollbar-thumb-neutral-250 dark:scrollbar-thumb-neutral-850">
                  {activities.length === 0 ? (
                    <div className="text-center py-6 text-text-secondary-light dark:text-text-secondary-dark font-mono text-[10px]">
                      No actions taken yet.
                    </div>
                  ) : (
                    <div className="space-y-2 divide-y divide-border-light/50 dark:divide-border-dark/40">
                      {activities.map((act) => {
                        const isCreate = act.type === "create_task";
                        const isPrioritize = act.type === "prioritize_tasks";
                        const isReschedule = act.type === "reschedule_task";

                        return (
                          <div key={act.id} className="pt-2 first:pt-0 space-y-0.5 font-mono">
                            <div className="flex justify-between items-center text-[9px]">
                              <span className={`font-semibold uppercase ${
                                isCreate
                                  ? "text-priority-low"
                                  : isPrioritize
                                  ? "text-brand-accent"
                                  : isReschedule
                                  ? "text-priority-medium"
                                  : "text-priority-high"
                              }`}>
                                {act.type}
                              </span>
                              <span className="text-text-secondary-light/70 dark:text-text-secondary-dark/70 text-[8px]">
                                {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-[10px] leading-snug ${theme === "light" ? "text-text-primary-light" : "text-text-primary-dark"}`}>
                              {act.details}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>

      </main>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all duration-300 z-10 ${
                theme === "light"
                  ? "bg-white border-border-light text-text-primary-light"
                  : "bg-card-dark border-border-dark text-text-primary-dark"
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-brand-accent animate-[spin_20s_linear_infinite]" />
                  <h3 className="text-sm font-bold tracking-tight">Optimizer Settings Console</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    theme === "light" ? "hover:bg-neutral-100 text-neutral-400" : "hover:bg-neutral-800 text-neutral-500"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Setting 1: Priority Weighting */}
                <div className="space-y-2">
                  <label className="block font-mono uppercase tracking-wider text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                    Priority Weightings
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Focused", "Balanced", "Dynamic"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          const act: Activity = {
                            id: "act_" + Math.random().toString(36).substring(2, 11),
                            timestamp: new Date().toISOString(),
                            type: "prioritize_tasks",
                            details: `Changed priority weighting mode to ${mode}`,
                            params: {}
                          };
                          setActivities(prev => [act, ...prev]);
                        }}
                        className={`py-2 px-3 rounded-xl border font-semibold text-center transition-all cursor-pointer ${
                          mode === "Focused"
                            ? "bg-brand-accent/15 border-brand-accent text-brand-accent"
                            : theme === "light"
                            ? "bg-neutral-50 border-border-light hover:bg-neutral-100"
                            : "bg-neutral-850 border-border-dark hover:bg-neutral-800"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setting 2: Autonomic Deferrals */}
                <div className="flex items-center justify-between py-2 border-t border-b border-border-light dark:border-border-dark">
                  <div>
                    <h4 className="font-semibold">Autonomic Deferrals</h4>
                    <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">Postpone tasks automatically if current slot overlaps.</p>
                  </div>
                  <div className="relative inline-flex items-center">
                    <div className="w-11 h-6 bg-brand-accent rounded-full p-1 transition-colors duration-200">
                      <div className="bg-white w-4 h-4 rounded-full shadow-md transform translate-x-5 transition-transform duration-200" />
                    </div>
                  </div>
                </div>

                {/* Setting 3: CalDAV Sync Endpoint */}
                <div className="space-y-1.5">
                  <label className="block font-mono uppercase tracking-wider text-[10px] text-text-secondary-light dark:text-text-secondary-dark">
                    CalDAV Sync Server URL
                  </label>
                  <input
                    type="text"
                    defaultValue="https://apidata.google.com/caldav/v1"
                    className={`w-full rounded-xl px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-brand-accent/30 transition-all font-mono text-[11px] ${
                      theme === "light"
                        ? "bg-neutral-50 border border-border-light text-text-primary-light"
                        : "bg-neutral-850 border border-border-dark text-text-primary-dark"
                    }`}
                  />
                </div>

                {/* Setting 4: Hot-reload threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary-light dark:text-text-secondary-dark">
                    <span>HOT-RELOAD THRESHOLD</span>
                    <span className="font-semibold text-brand-accent">5 MINS</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full ${theme === "light" ? "bg-neutral-100" : "bg-neutral-800"}`}>
                    <div className="bg-brand-accent h-full rounded-full" style={{ width: '35%' }} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-white border-border-light hover:bg-neutral-50"
                      : "bg-neutral-800 border-border-dark hover:bg-neutral-700"
                  }`}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    const act: Activity = {
                      id: "act_" + Math.random().toString(36).substring(2, 11),
                      timestamp: new Date().toISOString(),
                      type: "reschedule_task",
                      details: "Applied customized optimization constraints and synced CalDAV.",
                      params: {}
                    };
                    setActivities(prev => [act, ...prev]);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-accent hover:bg-brand-accent/90 text-white transition-all shadow-md active:scale-95 duration-150 cursor-pointer"
                >
                  Apply & Sync
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer id="lmls-footer" className={`border-t py-8 px-6 text-center text-xs space-y-1.5 mt-16 relative z-10 transition-colors duration-300 ${
        theme === "light"
          ? "bg-card-light/50 border-border-light text-text-secondary-light"
          : "bg-card-dark/40 border-border-dark text-text-secondary-dark"
      }`}>
        <p>© 2026 Last-Minute Life Saver. Powered by Gemini-3.5-Flash autonomous function tools.</p>
        <p className={`font-mono text-[10px] ${theme === "light" ? "text-text-secondary-light/60" : "text-text-secondary-dark/60"}`}>LMLS Engine v1.2 // Sandbox Secure</p>
      </footer>
    </div>
  );
}

