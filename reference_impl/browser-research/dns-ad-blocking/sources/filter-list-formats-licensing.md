# Filter List Formats and Licensing

## Filter List Formats

### ABP (Adblock Plus) Syntax — The De Facto Standard

The ABP filter syntax is the most widely supported format across ad blockers. It supports:

- **Basic URL blocking**: `||example.com/ads/*`
- **Exception rules**: `@@||example.com/good-ads/*`
- **Domain-specific rules**: `||ads.example.com^$domain=news.site.com`
- **Resource type filters**: `$script`, `$image`, `$stylesheet`, `$xmlhttprequest`, etc.
- **Cosmetic filters**: `example.com##.ad-banner` (CSS selector hiding)
- **Extended CSS**: Pseudo-selectors for more complex element matching

### uBlock Origin Extended Syntax

uBlock Origin adds extensions beyond ABP syntax:
- **Scriptlet injection**: `example.com##+js(abort-on-property-read, adBlockDetected)`
- **Procedural cosmetic filters**: `:has()`, `:has-text()`, `:matches-path()`
- **HTML filtering**: `example.com##^script:has-text(ad)`
- **Hostname-based filters stored in compressed trie**: Optimized with WebAssembly lookup for tens of thousands of hostname filters with negligible performance impact

`adblock-rust` can parse UBO's resource file format directly.

### AdGuard Extended Syntax

AdGuard supports a superset of ABP syntax with additional features:
- Extended CSS selectors
- HTML filtering rules
- JavaScript rules
- Stealth mode rules

`adblock-rust` has partial support for AdGuard syntax.

## Major Filter Lists

### EasyList Family
- **EasyList**: Primary international ad-blocking list. Removes most adverts including unwanted frames, images, and objects.
- **EasyPrivacy**: Tracker blocking companion to EasyList
- **EasyList Cookie**: Cookie consent notice removal
- **Fanboy's Annoyances**: Blocks social media widgets, in-page popups, and other annoyances

### AdGuard Lists
- **AdGuard Base**: AdGuard's maintained ad-blocking list
- **AdGuard Tracking Protection**: Tracker blocking
- **AdGuard Annoyances**: Similar to Fanboy's

### Regional Lists
- Various language/region-specific lists (EasyList Germany, EasyList China, etc.)

## Licensing

### EasyList
**Dual-licensed**: GNU GPLv3 (or later) **AND** Creative Commons Attribution-ShareAlike 3.0 Unported (or later).

Users can choose which license to comply with. Both require attribution to "The EasyList authors." For a browser distribution, the **CC BY-SA 3.0** option is likely more practical — it requires attribution and share-alike but doesn't impose the copyleft requirements of GPLv3 on the browser's own code.

### adblock-rust
**MPL-2.0** (Mozilla Public License 2.0). This is a weak copyleft license — modifications to MPL-licensed files must be shared, but the license doesn't extend to the larger work. Very compatible with proprietary or differently-licensed browser code. This is one reason Waterfox chose it over uBlock Origin (GPLv3).

### uBlock Origin
**GPLv3**. Strong copyleft — any derived work must also be GPLv3. This can create compatibility issues for browser distribution, which is one reason Waterfox and others prefer adblock-rust's MPL-2.0 licensing.

### Practical Licensing Strategy

For the custom browser:
1. Use `adblock-rust` (MPL-2.0) as the engine — commercially friendly
2. Bundle EasyList under CC BY-SA 3.0 — include attribution in the browser's about/credits page
3. Allow users to add additional filter lists of their choice
4. Consider maintaining a small supplementary filter list for browser-specific optimizations

## Sources

- https://easylist.to/pages/licence.html
- https://github.com/easylist/easylist
- https://github.com/gorhill/uBlock/wiki/Static-filter-syntax
- https://github.com/gorhill/uBlock/wiki/Filter-list-licenses
- https://github.com/brave/adblock-rust (LICENSE file)
- https://adguard.com/kb/general/ad-filtering/adguard-filters/
