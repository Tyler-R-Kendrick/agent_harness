# Anchor Browser Design

## Look And Feel

- Enterprise infrastructure marketing with strong security, authentication, cost, and reliability claims.
- The design centers on "computer-use agents that can authenticate and act like humans" rather than an open-ended browser assistant.
- Docs split the product into quickstarts, live playground, authentication/identity, build tools, task deployment, agentic browser control, and OS-level control.

## Design Tokens To Track

```yaml
surface: marketing site, docs, live playground, dashboard
accent: secure authenticated browser agents
primary_control: create session, attach identity/profile, run agent task, deploy task
core_objects:
  - browser session
  - application
  - identity
  - auth flow
  - browser profile
  - OmniConnect token
  - task
  - task deployment
  - agent task
  - OS-level control
enterprise_controls:
  - SOC2
  - ISO27001
  - HIPAA
  - GDPR
  - SSO
  - RBAC
  - zero data retention
```

## Differentiators

- Anchor pushes authentication as the main wedge: Applications, Identities, Auth Flows, OmniConnect, profiles, MFA, CAPTCHA, and geolocation.
- It explicitly frames pure runtime agents as unpredictable and claims to plan/deploy deterministic browser tasks, using AI only when required at runtime.
- OS-level control gives agents access to mouse, keyboard, screenshots, browser chrome, dialogs, and keyboard shortcuts beyond DOM-only automation.
- Pricing pages expose both task-credit packaging and infrastructure-level browser/proxy/step costs.

## What Is Good

- The product targets a real production blocker: logged-in web workflows with MFA, SSO, expiring sessions, bot defenses, and end-user account connection.
- Reusable task deployment is a strong reliability pattern because it can replace repeated improvisational agent runs with reviewed TypeScript tasks.
- The live playground and browser profile docs make authentication flows more tangible than pure API documentation.

## Where It Breaks Down

- The marketing stack is dense and claim-heavy, including speed, token, and error-rate comparisons that buyers will need to validate.
- Authentication infrastructure can feel invasive or high-risk for teams not ready to delegate logged-in third-party account access.
- Credit, proxy, browser-hour, and step pricing may be hard to forecast for workflows that hit CAPTCHA, geolocation, or long-running sessions.

## Screenshot And Open Design References

- Marketing and pricing surface: https://anchorbrowser.io/
- Docs home and playground entry: https://docs.anchorbrowser.io/introduction
- Authenticated application flow: https://docs.anchorbrowser.io/essentials/authenticated-applications
- Task dashboard references: https://docs.anchorbrowser.io/advanced/tasks
