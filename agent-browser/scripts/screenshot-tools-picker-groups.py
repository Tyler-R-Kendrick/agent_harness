"""Capture screenshots showing group header click behavior (expand/collapse only)."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 1200})
    page.goto("http://localhost:5174")
    page.wait_for_load_state("networkidle")

    # Open ToolsPicker
    page.get_by_role("button", name="Tools").click()
    page.wait_for_selector(".tools-picker-group-header")

    # Screenshot 1: initial state (all expanded)
    page.screenshot(path="docs/screenshots/tools-picker-group-expanded.png")
    print("Screenshot 1: initial expanded state")

    # Click the Workspace sub-group header row (not the checkbox) to collapse it
    headers = page.locator(".tools-picker-group-header[role='button']")
    count = headers.count()
    print(f"Found {count} collapsible group headers")

    # Find the Workspace sub-group header
    workspace_header = page.locator(".tools-picker-group-header[role='button']", has=page.locator("text=Workspace"))
    workspace_header.click()
    page.wait_for_timeout(300)

    # Screenshot 2: Workspace collapsed, checkbox should still be checked (not toggled)
    page.screenshot(path="docs/screenshots/tools-picker-group-collapsed.png")
    print("Screenshot 2: Workspace collapsed (checkbox unchanged)")

    # Verify the workspace checkbox is STILL checked (not toggled by the collapse)
    workspace_checkbox = workspace_header.locator("input[type='checkbox']")
    is_checked = workspace_checkbox.is_checked()
    print(f"Workspace checkbox checked after header click: {is_checked} (should be True)")
    assert is_checked, "FAIL: clicking the group header toggled the checkbox!"
    print("PASS: clicking the group header only collapsed the section, checkbox unchanged")

    browser.close()
