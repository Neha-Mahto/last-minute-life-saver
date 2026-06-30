# Last-Minute Life Saver 🔥

**Crisis schedule optimizer** — an AI-powered productivity companion that doesn't just remind you of deadlines, it actively replans your day and takes action when you fall behind.

Built for the **Vibe2Ship Hackathon** (Problem Statement: *The Last-Minute Life Saver*).

## 🚀 Live Demo
👉 **[View the Live Website Here](https://last-minute-life-saver-234940868764.asia-southeast1.run.app)**

## The Problem
Existing productivity tools rely on passive reminders that are easy to ignore. They tell you what's due — they don't help you actually finish it.

## The Solution
An autonomous AI agent (powered by Gemini) that:
- Parses messy, free-text task dumps into a structured, prioritized schedule
- Detects when you're falling behind and **autonomously reschedules and re-prioritizes** your day
- Escalates genuinely at-risk deadlines with specific, actionable nudges — not generic "hurry up" alerts
- Can **autonomously execute or defer tasks** on your behalf
- Surfaces personalized productivity insights based on your patterns
- Tracks goals and habit streaks alongside your task list
- Supports voice input for hands-free task dumping
- Syncs with Google Calendar

## Key Features
- 🧠 Intelligent task prioritization with visible reasoning
- 📅 AI-powered scheduling and rescheduling
- ⚠️ Context-aware escalation for at-risk deadlines
- 🤖 Autonomous task execution (Auto-Execute / Defer)
- 🎯 Goal & habit streak tracking
- 🎙️ Voice-enabled task input
- 📊 Personalized productivity nudges based on usage patterns
- 🔗 Google Calendar integration
- 🌗 Light/dark theme support

## How It Works (Agent Architecture)
User input → Gemini agent core (reasoning + function calling) → tool calls (`create_task`, `prioritize_tasks`, `reschedule_task`, `escalate_reminder`) → actions taken → outcomes loop back into the agent core to continuously replan.

This is what differentiates it from a typical to-do app: the model doesn't just generate text, it calls structured tools that actually modify the schedule, and explains its reasoning for every change.

## Tech Stack
- React + TypeScript
- Google AI Studio (build & deploy)
- Gemini API (function calling / tool use)
- Google Calendar API
- Web Speech API (voice input)

## Google Technologies Utilized
- Google AI Studio — core build and deployment platform
- Gemini API — agent reasoning and function/tool calling
- Google Calendar API — calendar sync

## Running Locally
This project was built and is deployed via Google AI Studio. To run locally:

```bash
npm install
npm run dev
```

You'll need a Gemini API key — see `.env.example` for the required environment variable.

## Evaluation Focus
This project demonstrates how AI can move beyond passive reminders to proactively plan, prioritize, and **act** on a user's behalf — closing the gap between "knowing what to do" and "actually getting it done."
