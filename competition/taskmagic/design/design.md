# TaskMagic Design

## Look And Feel

- Marketing design is playful and non-technical: "magic", "clone yourself", unlimited/free task language, product screenshots, and repeated visual proof that browser actions are captured by pointing and clicking.
- The product design combines a desktop app, Chrome recording window, step list, builder tray, and Apps-style workflow pieces.
- User flow starts from recording real behavior rather than drawing a workflow from scratch. The builder exposes steps after the user performs the work.

## Design Tokens To Track

```yaml
surface: desktop app plus connected Chrome recorder
accent: playful no-code automation branding
primary_control: record automation
core_objects:
  - automation
  - recorded step
  - browser recording
  - AI agent prompt
  - apps piece
  - run history
  - cloud runtime hour
information_density: medium-high
pricing_signal: unlimited flows and low monthly apps/browser tiers
```

## Differentiators

- Recording through a desktop app connected to Chrome makes the product feel like replaying the user's actual work instead of configuring APIs.
- AI agent prompting is positioned as a helper inside the recording flow, so users can mix manual capture with prompt-generated or repaired steps.
- Apps pieces let browser automation connect to webhook/app workflow logic without leaving the TaskMagic builder.

## What Is Good

- The recorder-first design is highly legible for non-technical users: act once, review captured steps, run again.
- Headed versus headless language gives users a simple mental model for watching an automation or letting it run in the background.
- Keeping desktop, browser, and apps automation in one product captures workflows that pure browser extensions or pure API automators miss.

## Where It Breaks Down

- Playful marketing and "unlimited" claims can obscure the operational complexity of selectors, waits, local desktop state, and cloud-runtime limits.
- Desktop plus extension plus cloud/app pieces is powerful but increases setup and failure surface.
- Recorded browser steps are vulnerable to dynamic pages, native dropdown quirks, profile mismatch, session expiry, and sites that resist automation.

## Screenshot References

- Browser automation landing page screenshots and pricing cards: `https://www.taskmagic.com/automate/browser-automation`
- Recording/AI Agent help screenshots for builder, step list, and connected Chrome window: `https://help.taskmagic.com/browser/recording/ai-agent`
