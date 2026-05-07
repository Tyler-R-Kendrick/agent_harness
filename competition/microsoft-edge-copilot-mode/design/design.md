# Microsoft Edge Copilot Mode Design

## Look And Feel

- Copilot Mode turns Edge's new tab and browsing surface into an AI-first command center with a prominent composer and Copilot side pane.
- The design layers chat, search, navigation, voice, shopping, tab organization, and agentic Actions into the existing browser.
- Microsoft emphasizes permission controls, history settings, and the ability to switch back, but the product visual weight is clearly moving toward Copilot as the default browser companion.

## Design Tokens To Track

```yaml
surface: mainstream browser with AI-first new tab and side pane
accent: Microsoft Copilot blue/purple gradient iconography
primary_control: Copilot composer on new tab or side pane
secondary_controls:
  - voice browsing
  - open-tab summarization
  - browsing-history context
  - Copilot Actions
  - Copilot Journeys
  - shopping/deal modules
trust_controls:
  - opt-in mode toggle
  - permission settings
  - clear history
  - sensitive-task warnings
information_density: high
```

## Differentiators

- Edge combines AI browser patterns with Microsoft account, Windows, Bing, Shopping, and Copilot distribution.
- Copilot Actions can interact with open or background tabs through clicks, scrolling, and typing, making it a true agentic competitor rather than only a summarizer.
- Journeys packages browsing history into resumable projects, which is a useful bridge between tabs, memory, and task continuation.

## What Is Good

- A visible side pane preserves the webpage while keeping AI available.
- Permission-oriented copy acknowledges user control, history access, and sensitive-task limits.
- Shopping, tab organization, video summaries, and voice browsing give mainstream users concrete entry points.

## Where It Breaks Down

- AI-first new tabs and repeated Copilot affordances can feel intrusive to users who want a conventional browser.
- Retiring or reducing non-AI sidebar functionality while Copilot remains creates a perception that Microsoft is forcing AI prioritization.
- The number of AI surfaces can make Edge feel cluttered even when individual features are useful.

## Screenshot References

- Official Copilot Mode page: `https://www.microsoft.com/en-us/edge/ai-powered/copilot-mode`
- Microsoft launch blog: `https://blogs.windows.com/msedgedev/2025/07/28/introducing-copilot-mode-in-edge-a-new-way-to-browse-the-web/`
- Actions support page: `https://support.microsoft.com/en-us/topic/copilot-actions-in-edge-5ed5e17e-42df-40a3-984a-20420eba86e2`
