# Ui.Vision RPA Gossip

## What People Say

- Users often describe Ui.Vision as a useful free or low-cost RPA tool, especially for browser macros, QA support, and replacing older iMacros workflows.
- Supportive comments praise the combination of Selenium-style web driving and image recognition for desktop-side tasks.
- Critical comments call out native XModule installation failures, smaller community/support footprint than UiPath, and visual automation brittleness when page layouts change.

## Product And Design Complaints

- The setup model splits capabilities between extension and XModules; users can get stuck when a native module is not detected.
- Image-based RPA can be "lost" when the visual page changes even if object- or selector-based automation would survive.
- The docs expose many commands and advanced options, which is powerful but intimidating.

## Security And Trust Signals

- Ui.Vision's local OCR and local-first claims are a strong counterpoint to hosted screenshot-to-cloud agent products.
- Native modules expand capability and risk at the same time because they can simulate real OS events and interact outside the browser.
- The open-source claim helps trust, but enterprise teams still need clear update, install, and permission governance.

## Implications For Agent Browser

- Ui.Vision proves that explicit, replayable automation artifacts still matter even as AI agents become popular.
- `agent-browser` should preserve human-readable action histories and deterministic export paths, not only chat summaries.
- Visual fallback should be paired with stable refs, screenshots, and recovery evidence so it avoids the classic image-macro brittleness.

## Sources

- https://www.reddit.com/r/rpa/comments/o9ydy1/xmodule_realuser_not_installed/
- https://www.reddit.com/r/rpa/comments/g7mbm0/your_opinion_on_kantu_uivision_rpa_as_a_rpa/
- https://www.reddit.com/r/rpa/comments/r820v9/do_any_of_you_use_uivision_in_your_automation/
- https://www.reddit.com/r/rpa/comments/tojrv1/uivision_worth_it/
