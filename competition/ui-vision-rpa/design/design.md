# Ui.Vision RPA Design

## Look And Feel

- Utility-heavy browser extension and documentation surface modeled around macro recording, command references, demo macros, and Selenium IDE familiarity.
- The visual language is older and denser than newer AI-browser products, with long documentation pages, many command names, and a strong open-source/engineering feel.
- Product pages emphasize "eyes" and "hands": OCR, image recognition, real-user simulation, desktop automation, file access, and command-line control.

## Design Tokens To Track

```yaml
surface: browser extension, macro editor, command reference, desktop XModule installer, docs
accent: practical open-source RPA palette
primary_control: replay macro
core_objects:
  - macro
  - command
  - screenshot
  - OCR text
  - XModule
  - real user click
  - CSV file
  - command-line run
information_density: high
```

## Differentiators

- Uses computer vision and local OCR as first-class interaction primitives, not just fallback screenshots.
- Extends from browser automation into desktop UI automation through native XModules for mouse, keyboard, file access, screen capture, and desktop control.
- Keeps local processing and open-source claims central, which appeals to users wary of hosted AI browsing.

## What Is Good

- The command catalog is explicit and inspectable; users can see what a macro will do.
- Local OCR and screenshots make visual automation possible on canvases, images, PDFs, and desktop apps where DOM selectors are weak.
- Command-line execution lets Ui.Vision fit CI, test automation, and scheduled local jobs.

## Where It Breaks Down

- The dense command surface is harder for mainstream users than chat, templates, or a modern visual builder.
- Image-based automation can be brittle when layouts, headers, scaling, or themes change.
- Native XModule installation creates setup and support friction compared with pure extension or hosted products.

## Screenshot References

- Product homepage and extension framing: `https://ui.vision/`
- User manual and command reference: `https://ui.vision/rpa/docs/`
- XModules and native desktop automation: `https://ui.vision/rpa/x`
