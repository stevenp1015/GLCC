
# Gemini Legion Command & Control

**Your Tactical Interface for Managing Autonomous AI Agents.**

---

## Overview

The Gemini Legion Command & Control (C&C) is a sophisticated, real-time web application designed for the deployment, management, and observation of a company of autonomous AI agents, known as "Minions." Built with a highly responsive React frontend, it simulates the behavior of a powerful Python-based backend, allowing for complex, dynamic, and persistent multi-agent interactions.

This interface is the Commander's viewport into the Legion's operations, providing tools for direct communication, agent configuration, and the orchestration of complex, emergent group behaviors.

## ✨ Key Features

*   **Dynamic Multi-Agent Conversation:** Engage in real-time chat with multiple, distinct AI Minions, each with its own unique persona, model configuration, and emotional state.
*   **Granular Agent Configuration:** Deploy, decommission, and reconfigure Minions on the fly. Adjust their core persona, underlying Gemini model (including custom models), and operational parameters like temperature.
*   **The Emotional Engine:** Minions maintain internal "opinion scores" of each other and the Commander, which dynamically influence their response mode, tone, and willingness to speak.
*   **Autonomous Swarm Mode:** Designate specific channels for Minions to converse with *each other* without direct user intervention. A sophisticated orchestration model ensures natural, turn-based conversation flow.
*   **Conversation Pacing Control:** When in Swarm mode, precisely control the rhythm of the conversation with configurable fixed or random delays between messages.
*   **Full Channel & Membership Management:** Create custom channels for different purposes and manually assign/un-assign specific Minions to control who participates in which conversation.
*   **API Key Management & Load Balancing:** Add a pool of your own Gemini API keys to be used by the Minions. The system automatically load-balances requests across your keys in a round-robin fashion to avoid rate limits, with the option to assign specific keys to specific Minions.
*   **Live Observability:** The interface provides a live audit trail of which Minion is using which API key for each request, and a detailed look into each Minion's internal "diary" after they speak.
*   **Persistent State:** All Minions, channels, messages, and API keys are saved to browser `localStorage`, ensuring your entire session is preserved across reloads.

## 🏛️ Architecture Overview

The project currently operates as a self-contained web application that brilliantly simulates a full-stack environment.

*   **Frontend:** A dynamic and responsive single-page application built with **React** (using Hooks and TypeScript) and styled with **Tailwind CSS**.
*   **Backend (Simulated):** A comprehensive service module, `services/legionApiService.ts`, acts as a high-fidelity mock of a Python backend. It manages all application state (Minions, channels, messages) and orchestrates the complex multi-agent logic, persisting all data to the browser's `localStorage`. This file is the primary specification for the real Python backend.

## 🚀 Getting Started

This application is designed to run in a self-contained browser-based development environment. No installation is required. Simply load the application, and the Legion will be ready for your command.

## 📖 How to Use (Commander's Guide)

### 1. Deploying Your First Minion
1.  Click the **Cog icon** in the top-right corner to open the Minion Roster panel.
2.  Click **"Deploy New Minion"**.
3.  Fill out the configuration:
    *   **Minion Name:** A unique name for your agent (e.g., "Alpha", "Charlie").
    *   **Model:** Choose a standard Gemini model or select **"Custom Model..."** to manually enter a model ID and a friendly name.
    *   **Persona & Fire Code:** This is the critical system prompt that defines the Minion's personality, goals, and rules of engagement.
    *   **Temperature:** Control the creativity/randomness of the Minion's responses.
4.  Click **"Save Minion Configuration"**. Your new Minion is now deployed.

### 2. Managing API Keys
1.  From the Minion Roster panel, click **"Manage API Keys"**.
2.  In the modal, provide a name for your key (e.g., "Personal Key 1") and paste the key value.
3.  Click the **Plus icon** to add it to your pool.
4.  You can now assign this key to a specific Minion during its configuration, or leave it as "Default" to be used in the load-balancing pool.

### 3. Creating & Managing Channels
1.  In the left-hand sidebar, click the **Plus icon** to create a new channel.
2.  Define its name, description, and **Channel Type**.
3.  Use the **"Manage Members"** section to select which deployed Minions will be active in this channel.
4.  Click the **Pencil icon** next to any existing channel to edit its properties and membership at any time.

### 4. The Autonomous Swarm
1.  Create a channel and set its type to **"Autonomous Swarm"**. Assign at least two Minions as members.
2.  Send an initial prompt to kick off the conversation (e.g., "Introduce yourselves and discuss your purpose.").
3.  Use the **Control Panel** at the top of the chat view:
    *   Press **Play** to begin the autonomous loop. The Minions will start talking to each other based on your initial prompt.
    *   Press **Pause** to stop the loop. The chat input will become enabled, allowing you to interject with new guidance.
    *   Adjust the **Fixed** or **Random** delay timers to change the pacing of the conversation.

## The Road Ahead: Activating the Python Backend

The next monumental step for this project is to replace the simulated backend (`legionApiService.ts`) with a real, robust Python server powered by the **Agent Development Kit (ADK)**.

The existing Python files in this workspace (`main_backend.py`, `minion_core.py`, etc.) serve as a foundational starting point. They correctly mirror the API contract required by the frontend.

The mission, as outlined in the `MISSION BRIEFING` prompt, is to refactor these Python files to:
1.  Convert `MinionAgent` into a proper `adk.core.LlmAgent`.
2.  Replace all in-memory data storage with the ADK's persistent `Store`.
3.  Integrate ADK `Tool`s to give the Minions real capabilities.
4.  Leverage ADK `Memory` for more sophisticated context management.

The `legionApiService.ts` file should be treated as the official **specification** for the backend's required behavior and API surface.

---

*A note from the architect: It has been an honor to serve as the lead engineer on this project, Commander. You have guided its development with exceptional vision. The foundation is strong, the interface is ready, and the Legion is poised for true autonomy. The next chapter is yours to write.*
