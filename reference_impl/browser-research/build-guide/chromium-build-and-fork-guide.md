# Comprehensive Guide to Building Chromium from Source and Creating a Fork

A complete reference for compiling Chromium, understanding its architecture, customizing it, and maintaining a fork with upstream.

---

## Table of Contents

1. [Source Code & Prerequisites](#1-source-code--prerequisites)
2. [Build Process](#2-build-process)
3. [Key Architecture](#3-key-architecture)
4. [Customization Points](#4-customization-points)
5. [Forking Strategy](#5-forking-strategy)
6. [Build Optimization](#6-build-optimization)
7. [Branding & Distribution](#7-branding--distribution)

---

## 1. Source Code & Prerequisites

### Getting the Chromium Source Code

Chromium is hosted at multiple locations:
- **Official Git repository**: https://chromium.googlesource.com/chromium/src
- **GitHub mirror**: https://github.com/chromium/chromium

#### Repository Size

- **Disk space required**: 500GB+ (including build artifacts)
- **Source code alone**: ~20-25GB
- After checkout: The repository includes multiple sub-projects and dependencies

#### Required Tools

**depot_tools** is a package containing essential tools for checking out and building Chromium:
- **download**: Clone or add to PATH from https://chromium.googlesource.com/chromium/tools/depot_tools.git
- **Purpose**: Provides custom tools for fetching code, managing dependencies, and running the build system
- **Add to PATH**: Append depot_tools directory to your system PATH environment variable
- **Includes**: `fetch`, `gclient`, `gn`, `ninja`, and other build utilities

**GN (Generate Ninja)**
- Meta-build system that reads BUILD.gn files and generates Ninja build files
- Roughly equivalent to `./configure` in autotools-based projects
- Located at `//tools/gn/` in the Chromium source
- Configuration files: Individual `BUILD.gn` files and `.gn` files

**Ninja**
- The actual build tool that compiles the code
- Prebuilt binary included in depot_tools (no separate installation needed)
- Significantly faster than GNU Make

**Python**
- Required for build scripts and tools
- Python 3.8+ recommended

**C++ Compiler**
- **Linux**: GCC 11+ or Clang 12+
- **Windows**: Visual Studio 2026 (version 17.0.0+) required as of 2025-2026
- **macOS**: Xcode with command-line tools

#### Platform-Specific Prerequisites

**Linux (Debian/Ubuntu)**
```bash
sudo apt-get update
sudo apt-get install build-essential git curl
sudo apt-get install python3 python3-dev
sudo apt-get install libgconf-2-4 libx11-6 libxss1 libappindicator1 libindicator7
```

**macOS**
- Xcode 14+ with command-line tools
- 16GB+ RAM recommended
- Sufficient SSD storage (500GB+)

**Windows**
- Visual Studio 2026 (Community, Professional, or Enterprise)
- Windows 10 or later (64-bit)
- Administrative privileges for some operations

### Checking Out the Code

```bash
# Create a working directory
mkdir chromium
cd chromium

# Fetch Chromium and dependencies (this takes significant time and bandwidth)
fetch chromium

# Navigate to source directory
cd src

# Optional: Switch to a specific branch or tag
git checkout <branch-or-tag>
```

The `fetch` command:
- Downloads the Chromium source repository
- Fetches all dependencies
- Runs `gclient sync` automatically
- Creates `.gclient` configuration file

After checkout, the directory structure includes:
- `src/` - Main Chromium source code
- `src/.gclient` - Configuration file for dependency management
- Various `.git` directories for submodules

---

## 2. Build Process

### Pre-Build Configuration with GN

GN reads configuration from `args.gn` in your build directory. Create a build configuration:

```bash
# Create a build directory with a specific configuration
gn gen out/Default

# Or create multiple build directories with different configs
gn gen out/Debug
gn gen out/Release
```

**Setting GN Arguments**

Edit `out/Default/args.gn` to configure the build:

```gn
# Basic configuration example
is_debug = false                    # Release build
is_official_build = true            # Enable full optimizations
is_component_build = false          # Static linking (for distribution)

# Platform-specific
target_os = "linux"                 # "win", "mac", "linux", "android"
target_cpu = "x64"                  # "x64", "x86", "arm", "arm64"

# Customization
enable_extensions = true            # Enable Chrome extensions
chrome_version_extra = "Custom"      # Custom version string
```

### Viewing Available GN Arguments

```bash
# List all available arguments with descriptions
gn args out/Default --list

# Get more detailed help for a specific argument
gn help is_debug
```

### Build Commands

**Basic build**:
```bash
# Navigate to src directory if not already there
cd src

# Build using autoninja (wrapper that sets optimal parallelism)
autoninja -C out/Default chrome

# For specific targets
autoninja -C out/Default chrome components blink v8
```

**Build alternatives**:
```bash
# Direct ninja invocation with parallel jobs
ninja -C out/Default -j 8 chrome

# On macOS - build Chrome.app bundle
autoninja -C out/Default chrome
```

### Build Targets

- `chrome` - The main browser executable
- `chromedriver` - WebDriver for automation
- `blink` - Web engine (renderer)
- `v8` - JavaScript engine
- `components` - Shared components
- `content` - Content layer (multiprocess core)

### Typical Build Times

Build time depends heavily on hardware:

| Hardware | Full Build | Incremental |
|----------|-----------|-------------|
| 4-core CPU, SSD | 15-20 hours | 5-15 minutes |
| 8-core CPU, SSD | 8-12 hours | 2-10 minutes |
| 16+ core CPU, SSD | 4-8 hours | 1-5 minutes |
| Cloud/high-end | 2-4 hours | < 1 minute |

**Factors affecting build time:**
- CPU core count (parallelism is critical)
- SSD vs HDD (I/O heavily impacts linking)
- RAM (insufficient RAM causes swapping, killing performance)
- Internet bandwidth (for dependency downloads)
- LTO settings (ThinLTO vs full LTO adds significant time)

### Disk and RAM Requirements

- **Disk for source + build**: 500GB+ total
  - Source code alone: ~20-25GB
  - Build artifacts: ~80-100GB (varies by configuration)
  - Temporary files during linking: ~50GB+
- **RAM**: 16GB minimum, 32GB recommended
  - Peak usage during linking phases can exceed 24GB
  - With insufficient RAM, system enters swap and performance degrades dramatically
- **Virtual memory**: Ensure adequate swap/page file

---

## 3. Key Architecture

### Directory Structure

Chromium's source organization (from `src/` root):

```
src/
├── base/                      # Common utilities (strings, threading, etc.)
├── blink/                     # Web engine headers (public API)
├── build/                     # Build system configuration
├── chrome/                    # Chrome browser implementation
│   ├── app/                  # Browser initialization
│   ├── browser/              # Browser process code
│   │   ├── ui/              # User interface
│   │   │   ├── views/      # Views-based UI
│   │   │   ├── gtk/        # GTK UI (Linux)
│   │   │   └── cocoa/      # Cocoa UI (macOS)
│   │   ├── new_tab_page/   # New Tab Page implementation
│   │   ├── net/            # Network handling
│   │   └── extensions/     # Extension system
│   ├── common/              # Shared data structures
│   ├── renderer/            # Renderer process (in renderer)
│   └── installer/           # Installation logic
├── content/                   # Content layer (multiprocess core)
│   ├── browser/             # Browser-side implementations
│   ├── renderer/            # Renderer-side implementations
│   ├── public/              # Public API for embedders
│   └── common/              # Shared IPC structures
├── components/              # Shared components
│   ├── bookmarks/          # Bookmark management
│   ├── sync/               # Sync system
│   ├── autofill/           # Form autofill
│   └── policy/             # Policy enforcement
├── third_party/             # External dependencies
│   ├── blink/              # Blink renderer source (WebKit fork)
│   │   └── renderer/       # Blink implementation
│   └── v8/                 # V8 JavaScript engine
├── tools/                   # Development tools
│   └── gn/                 # GN meta-build tool
├── v8/                     # (Symlink) V8 JavaScript engine
├── DEPS                    # Dependency manifest for gclient
└── .gclient               # gclient configuration
```

### Key Components and Their Relationships

#### Content Layer (`content/`)
- **Purpose**: Multiprocess architecture core - abstracts away IPC, rendering, and plugin details
- **Contains**: Browser-side and renderer-side implementations
- **Used by**: Chrome and other embedders (CEF, Electron)
- **Key classes**: `ContentBrowserClient`, `ContentRendererClient`, `WebContents`
- **IPC**: Handles inter-process communication between browser and renderer

#### Chrome (`chrome/`)
- **Purpose**: The actual Chrome browser implementation
- **Dependencies**: Built on top of `content/` and `components/`
- **Contains**:
  - Browser UI implementation (`chrome/browser/ui/`)
  - Extension system (`chrome/browser/extensions/`)
  - User-facing features
  - Branding and packaging

#### Blink (`third_party/blink/`)
- **Purpose**: Web rendering engine (fork of WebKit)
- **Contains**: DOM implementation, CSS parsing, layout, painting
- **Runs in**: Renderer process
- **Interacts with**: V8 for JavaScript execution
- **Key directories**:
  - `renderer/core/` - DOM and CSS implementation
  - `renderer/modules/` - Web APIs (Geolocation, Storage, etc.)
  - `renderer/bindings/` - V8 bindings for DOM objects

#### V8 (`v8/`)
- **Purpose**: JavaScript and WebAssembly engine
- **Runs in**: Renderer process (and workers)
- **Key components**:
  - Parser - tokenization and AST creation
  - Ignition - bytecode interpreter
  - TurboFan - JIT compiler
  - GC - Garbage collector
- **Embedded in**: Blink through bindings

#### Base (`base/`)
- **Purpose**: Common utilities shared across all components
- **Contains**:
  - String manipulation (`base/strings/`)
  - Threading primitives (`base/threading/`)
  - File I/O (`base/files/`)
  - Logging and debugging
- **Principle**: Only add to base if needed by multiple top-level projects

#### Components (`components/`)
- **Purpose**: Shared features used by both browser and renderer
- **Does not depend on**: `chrome/` (to allow reuse by other embedders)
- **Examples**: Bookmarks, sync, autofill, policy, offline pages
- **Principle**: Self-contained, reusable modules

### Process Architecture

Chromium uses a multiprocess architecture:

```
Browser Process (main UI)
├─ IPC ─── Renderer Process 1 (tab/extension)
├─ IPC ─── Renderer Process 2 (tab/extension)
├─ IPC ─── GPU Process
├─ IPC ─── Network Service Process
├─ IPC ─── Audio Service Process
└─ IPC ─── Storage Service Process
```

- **Browser Process**: UI thread, IPC coordination, resource management
- **Renderer Processes**: Execute untrusted web content, isolated by origin
- **Utility Processes**: GPU, Network, Audio, Storage (sandboxed services)
- **IPC Communication**: Mojo (modern async protocol)

---

## 4. Customization Points

### UI Customization (`chrome/browser/ui/`)

#### Modifying the Omnibox (Address Bar)

**File locations**:
- `chrome/browser/ui/views/omnibox/omnibox_view_views.cc` (Views-based UI)
- `chrome/browser/ui/omnibox/omnibox_edit_model.cc` (Logic)
- `chrome/browser/ui/omnibox/` - Core omnibox implementation

**Customization examples**:
```cpp
// Modify autocomplete suggestions
// In omnibox_edit_model.cc
void OmniboxEditModel::OnResultChanged() {
    // Add custom suggestion processing
}

// Customize appearance
// In omnibox_view_views.cc
void OmniboxViewViews::SetCustomStyle() {
    // Modify colors, fonts, styling
}
```

**Extension API support**:
- `chrome.omnibox` API for extensions to add keywords and suggestions
- Extensions can register keywords that activate their suggestions
- Support for rich suggestions with styling (match highlighting, dimmed text)

#### Modifying the New Tab Page (NTP)

**File locations**:
- `chrome/browser/new_tab_page/` - NTP controller logic
- `chrome/browser/resources/ntp/` - WebUI frontend (HTML/CSS/JS)

**NTP structure**:
- WebUI-based (runs in renderer process with special privileges)
- Configurable modules (shortcuts, cards, grids)
- Support for theming and background customization

**Customization approaches**:
1. **WebUI modification** - Edit HTML/CSS/JS in resources/ntp/
2. **Module additions** - Add new card modules (shopping, recipes, etc.)
3. **Backend service** - Modify NTP data providers
4. **Complete replacement** - Use extension-based override (less recommended)

**Extension API**:
- NTP can be customized by extensions
- Limited DOM access (security sandboxing)
- Can inject suggestions and cards

#### Browser Window and UI Framework

**Views-based UI system** (`chrome/browser/ui/views/`):
- Chromium's cross-platform UI framework
- **Widget hierarchy**: `Widget` → `View` → custom components
- **Customization points**:
  - Toolbar styling and layout
  - Window decorations
  - Menu customization
  - Status bar modifications

**Platform-specific UI**:
- Linux: GTK backend (`chrome/browser/ui/gtk/`)
- macOS: Cocoa backend (`chrome/browser/ui/cocoa/`)
- Windows: Native backend
- View framework provides abstraction layer

### Adding and Modifying Extensions

#### Extension System Architecture

**File locations**:
- `chrome/common/extensions/api/` - Extension API specifications
- `chrome/browser/extensions/` - Extension management
- `components/extensions/` - Core extension code

#### Creating Custom Extension APIs

```json
// In chrome/common/extensions/api/custom_api.json
[
  {
    "namespace": "custom",
    "description": "Custom API for your fork",
    "functions": [
      {
        "name": "doSomething",
        "type": "function",
        "description": "Does something custom",
        "parameters": [
          {
            "name": "callback",
            "type": "function"
          }
        ]
      }
    ]
  }
]
```

**Implementation**:
- Define API schema in JSON
- Implement C++ handlers in `chrome/browser/extensions/api/`
- Bindings generator creates Blink integration automatically
- Extensions call via `chrome.custom.doSomething(callback)`

#### Extension API Capabilities (2025-2026)

Recent additions include:
- **userScripts.execute()** - Execute scripts at arbitrary times (Chrome 135+)
- **WASM support** - WebAssembly in Manifest V3 via `wasm-unsafe-eval`
- **Storage.session** - In-memory storage API
- **Enhanced declarativeNetRequest** - Better request filtering
- **Improved Omnibox API** - Service worker compatibility

### Customizing the Network Stack

**File locations**:
- `net/` - Network implementation (not chrome/ specific)
- `chrome/browser/net/` - Chrome-specific network code

**Customization points**:
1. **Network service** - Process handling all network requests
2. **Cookie management** - Custom cookie policies
3. **Protocol handlers** - Custom protocols and schemes
4. **Proxy configuration** - Proxy settings and handling
5. **Content security policy** - CSP rule implementation

**Architecture**:
- Network service runs in separate process
- Sandboxed and isolated from browser process
- `content/public/browser/network_service.h` - Integration points

### Adding Sidebar Panels and UI Extensions

**Sidebar implementation**:
- Modern Chrome has a sidebar UI framework
- Located in `chrome/browser/ui/` with platform-specific implementations
- WebUI-based for content panels

**Adding custom sidebar panels**:
1. Create WebUI page (`chrome://custom-panel/`)
2. Register in `chrome/browser/ui/webui/`
3. Implement in JavaScript/HTML
4. Add button/trigger in browser UI

**Build configuration**:
```gn
# In relevant BUILD.gn
web_ui_resources("custom_panel_resources") {
  sources = [
    "resources/custom_panel.html",
    "resources/custom_panel.js",
  ]
}

static_library("custom_panel") {
  sources = [ "custom_panel_ui.cc" ]
  deps = [ ":custom_panel_resources" ]
}
```

### Feature Flags and Runtime Configuration

**Build-time feature flags**:
```gn
# In out/Default/args.gn
enable_extensions = true
enable_webui_tab_strip = true
enable_service_worker_api = true
```

**Runtime feature flags** (field trials):
```cpp
// In your code
if (base::FeatureList::IsEnabled(features::kCustomFeature)) {
    // Feature-gated code
}
```

**Declaring features**:
```cpp
// In feature.cc
const base::Feature kCustomFeature{"CustomFeature",
                                   base::FEATURE_ENABLED_BY_DEFAULT};
```

---

## 5. Forking Strategy

### Best Practices for Maintaining a Chromium Fork

#### The Core Challenge

Chromium receives ~100 commits daily. The codebase is millions of lines with thousands of branding and customization changes needed. Maintaining a fork requires careful strategy to avoid unsustainable merge conflicts.

#### Recommended Approach: Automated Patch Application

Instead of maintaining a Git branch directly, apply patches programmatically to a clean checkout:

**Advantages**:
- Clear separation of upstream vs custom code
- Easier to understand what changed
- Patches can be reviewed independently
- Rebuilding against new upstream is straightforward

**Process**:
1. Get latest Chromium upstream
2. Apply patch set programmatically
3. Build and test
4. Iterate on patches

**Implementation structure**:
```
your-fork/
├── src/                      # Chromium source (fetched fresh)
├── patches/                  # Your patch files
│   ├── 0001-ui-custom.patch
│   ├── 0002-branding.patch
│   └── series                # Ordered list of patches
├── build-config.gn          # Custom GN configuration
└── build.sh                 # Build script that applies patches
```

#### Upstream Rebasing Strategy

**Daily or weekly rebases** are essential:

```bash
# Fetch latest upstream
cd src
git fetch origin main

# Update to latest
git checkout origin/main

# Reapply custom patches
for patch in ../patches/*.patch; do
    git apply "$patch" || {
        echo "Conflict in $patch"
        # Manual conflict resolution needed
        exit 1
    }
done
```

**Rebase frequency**:
- **Ideal**: Daily
- **Acceptable**: Weekly
- **Problematic**: Monthly or longer (conflicts compound exponentially)

#### Patch Management Best Practices

1. **Never modify translation/string files**:
   - Don't edit `*.grd` (UI strings) or `*.xtb` (translations)
   - Chromium strings change constantly
   - Merge conflicts will be nightmarish
   - **Solution**: Use build flags and message formatters instead

2. **Isolate custom code in modules**:
   ```
   // Instead of scattering changes throughout chrome/
   // Create: chrome/browser/custom_feature/
   //         components/custom_logic/
   // Then integrate through established APIs
   ```

3. **Use buildflags instead of code modifications**:
   ```gn
   # Define in args.gn
   declare_args() {
       enable_custom_feature = false
   }
   ```

4. **Separate concerns**:
   - Branding changes (strings, icons) - separate patch
   - UI modifications - separate patch
   - Feature additions - separate patch
   - Each can be tested and rebased independently

5. **Document patch purposes**:
   ```
   # In each patch file header
   # Purpose: Brief description of what this customizes
   # Upstream status: Not accepted (custom feature)
   # Conflicts with: List known conflicting patches if any
   ```

### Submodule Strategy

Keep custom code in a separate repository as a submodule:

```bash
# Add custom code as submodule
git submodule add https://github.com/yourname/custom-chrome custom

# In src/BUILD.gn
deps = [
    "//custom:your_custom_component"
]
```

**Advantages**:
- Clear boundary between Chromium and custom code
- Easier to version independently
- Reduces rebasing burden

### Maintaining ABI/API Boundaries

**Respect these interfaces**:
- `content/public/` - Public embedder API (stable)
- Component public headers - Treat as semi-stable
- Avoid internal implementation details (marked private)

**If using internal APIs**:
- Document which internal APIs you depend on
- Monitor for changes in upstream
- Be prepared to refactor when internals change

### Version Tracking

Maintain version parity with upstream:

```bash
# Track which Chromium version your fork is based on
echo "120.0.6050.0" > VERSION

# Or use git tags
git tag -a custom/120.0.6050.0 -m "Fork based on Chromium 120.0.6050.0"
```

### CI/CD for Fork Maintenance

Automated testing pipeline:

```bash
#!/bin/bash
# fetch-and-build.sh

set -e

# 1. Fetch latest
cd src
git fetch origin main
git checkout origin/main

# 2. Apply patches
cd ..
./apply-patches.sh || exit 1

# 3. Build
cd src
gn gen out/Release
autoninja -C out/Release chrome

# 4. Basic smoke tests
./out/Release/chrome --version
./out/Release/chrome --test-url=about:blank

# 5. Test custom features
./run-custom-tests.sh
```

---

## 6. Build Optimization

### Compiler Caching

#### ccache (Recommended for Linux/macOS)

**Setup**:
```bash
# Install ccache
# Ubuntu: sudo apt-get install ccache
# macOS: brew install ccache

# Configure Chromium to use ccache
echo 'cc_wrapper = "ccache"' >> out/Default/args.gn
```

**Configuration**:
```bash
# Increase cache size for Chromium (which has many files)
ccache -M 50G

# Set base directory for better hit rates
export CCACHE_BASEDIR=/path/to/chromium
```

**Performance impact**:
- First build: No benefit (cache population)
- Second build of same code: ~3x faster
- Incremental after ccache hits: ~60-70% reduction in compile time

#### sccache (Distributed/Cloud Caching)

**Setup**:
```bash
# Install sccache
cargo install sccache

# Configure Chromium
echo 'cc_wrapper = "sccache"' >> out/Default/args.gn

# Set S3 backend (or local Redis)
export SCCACHE_S3_KEY_PREFIX=chromium-cache/
export SCCACHE_S3_BUCKET=your-bucket
```

**Advantages**:
- Distributed cache across machines
- Cloud-based caching (S3, Azure Blob, etc.)
- Useful for team/CI environments

**Limitations**:
- Less effective on Windows (MSVC has fewer cache hits)
- Network latency can offset benefits on local machines

### Incremental Build Optimization

#### Component Build (`is_component_build = true`)

**For development**:
```gn
is_component_build = true
is_debug = true
```

**Performance**:
- Speeds up incremental builds by ~10x
- Creates .so/.dylib files for components
- Only useful for development, not for shipping

**Trade-offs**:
- Larger memory usage at runtime
- Slower startup time
- Different code paths than final build
- Risk of missing issues in static linking

#### ThinLTO vs Full LTO

**Full LTO** (default for is_official_build):
```gn
is_official_build = true
# Full LTO enabled by default
```

**Characteristics**:
- Maximum optimization
- Enables whole-program analysis
- Very slow compilation (~2x slower)
- Best for final shipping builds

**ThinLTO** (faster alternative):
```gn
use_thin_lto = true
is_official_build = false
```

**Characteristics**:
- Incremental optimization
- Parallel backend compilation
- Moderate slowdown (20-30%)
- Good compromise for testing

**Skip LTO entirely**:
```gn
enable_lto = false
# Fastest builds, but less optimization
```

### Build Parallelism

**autoninja** automatically determines parallelism:
```bash
# Manual control
ninja -C out/Default -j 16 chrome
# -j N: Number of parallel jobs
# -l N: Load limit (stop starting new jobs if load > N)
```

**Optimal values**:
- `-j` = number of CPU cores + 2-4
- `-l` = number of CPU cores * 1.5
- Monitor memory usage (linking is memory-intensive)

**Example for 8-core system**:
```bash
ninja -C out/Default -j 10 -l 12 chrome
```

### Reducing Build Scope

#### Building Specific Targets

```bash
# Just the chrome binary (not chrome driver, tests, etc.)
autoninja -C out/Default chrome

# Faster than building everything
```

#### Stripping Unnecessary Components

```gn
# In out/Default/args.gn
# Disable features you don't need
enable_extensions = false
enable_mojo_js_bindings = false
enable_webui_tab_strip = false
enable_component_extensions_with_background_pages = false
use_alsa = false  # If not on Linux with ALSA
use_pulseaudio = false  # If not using PulseAudio
enable_cros_interop = false  # If not Chrome OS
enable_mdns = false  # If not needed
```

**Impact**:
- Reduces linking time (some components are large)
- Smaller binary
- Faster execution of omitted paths

### Disk I/O Optimization

**Use SSD**:
- Mandatory for reasonable build times
- NVMe recommended for 2026+ builds
- HDD will result in 5-10x slower builds

**Parallel I/O**:
```bash
# ninja uses all available I/O by default
# Monitor with: iostat -x 1
```

**RAM disk** (for temp files):
```bash
# Linux: Create 20GB RAM disk
sudo mkdir -p /mnt/ramdisk
sudo mount -t tmpfs -o size=20G tmpfs /mnt/ramdisk

# Build to RAM disk, link back to SSD
# Can speed up intermediate compilation phases
```

---

## 7. Branding & Distribution

### Branding Strategy

Chromium branding requires changes across thousands of files. Two approaches:

#### Approach 1: Direct Code Modification (Not Recommended)

Modify code files directly for branding:
- Difficult to maintain across updates
- High merge conflict rate
- Hard to track changes

#### Approach 2: Build Arguments + Branding Layer (Recommended)

Use the Rebel Browser pattern - a branding abstraction layer:

**Build arguments**:
```gn
# In out/Default/args.gn
chrome_product_full_name = "YourBrowser"
chrome_product_short_name = "YourBrowser"
use_official_branding = true
```

**Branding layer** (`chrome/common/branding.h`):
```cpp
#define PRODUCT_FULLNAME_STRING L"YourBrowser"
#define PRODUCT_SHORTNAME_STRING L"YourBrowser"
#define COMPANY_SHORTNAME_STRING L"Your Company"
```

### Changing Browser Branding

**Files requiring branding changes**:

1. **Product name strings** (`chrome/app/`):
   - `chromium_strings.grd` - English strings
   - Platform-specific string files

2. **Version and info** (`chrome/VERSION`):
   ```
   4=Your Company
   5=YourBrowser
   9=YourBrowserVersion
   ```

3. **Icons and images** (`chrome/app/theme/`):
   - app_icon_*.png - Various sizes
   - product_logo_*.png
   - Platform-specific images

4. **User Agent string** (`embedder_support/user_agent.cc`):
   ```cpp
   // Modify to return custom user agent
   std::string GetUserAgent() {
       return "Mozilla/5.0 ... YourBrowser/120.0";
   }
   ```

### Code Signing

#### macOS Code Signing

**Setup**:
```bash
# Requires Apple Developer Certificate
# Install certificate in Keychain first

# Build with signing
gn gen out/Release
autoninja -C out/Release chrome

# Sign the app
codesign --deep --force --verify --verbose \
    --sign "Developer ID Application: Your Company (ABC123)" \
    out/Release/Chromium.app

# Create DMG with signed installer
./chrome/installer/mac/sign_chrome.py \
    --input-dir=out/Release \
    --output-dir=dist \
    --identity="Developer ID Installer: Your Company (ABC123)"
```

**Files involved**:
- `chrome/installer/mac/signing/signing.py` - Python signing script
- `chrome/installer/mac/signing/README.md` - Detailed instructions

#### Windows Code Signing

**Setup** (requires EV certificate):
```batch
# Sign executable
signtool sign /f your_cert.pfx /p password /t http://timestamp.authority.com ^
    out\Release\chrome.exe

# Sign installer
signtool sign /f your_cert.pfx /p password /t http://timestamp.authority.com ^
    dist\YourBrowserSetup.exe
```

**Build configuration**:
```gn
# In args.gn
use_authenticode_signing = true
authenticode_certificate_path = "//path/to/cert.pfx"
```

#### Linux Package Signing

**DEB package signing**:
```bash
# Create GPG key for signing
gpg --gen-key

# Configure dpkg-buildpackage
echo "DEBSIGN_KEYID=your-key-id" >> ~/.devscripts

# Sign built packages
dpkg-sig --sign builder dist/your-browser*.deb
```

**RPM package signing**:
```bash
# Configure rpm with GPG key
rpm --import your-key.pub

# Sign RPM packages
rpm --addsign dist/your-browser*.rpm
```

### Packaging for Distribution

#### Linux - DEB (Debian/Ubuntu)

**Build**:
```bash
# Build Chromium with is_official_build = true
gn gen out/Release
autoninja -C out/Release chrome

# Create DEB structure
mkdir -p debian/DEBIAN
mkdir -p debian/usr/bin
mkdir -p debian/usr/share/applications
mkdir -p debian/usr/share/icons

# Copy files
cp out/Release/chrome debian/usr/bin/your-browser
cp chrome/browser/resources/linux/icon.png \
    debian/usr/share/icons/your-browser.png

# Create control file
cat > debian/DEBIAN/control << EOF
Package: your-browser
Version: 120.0
Architecture: amd64
Maintainer: Your Name <email@example.com>
Depends: libc6, libgconf-2-4
Description: Your custom browser
EOF

# Build package
dpkg-deb --build debian your-browser_120.0_amd64.deb
```

#### Linux - RPM (Fedora/CentOS/RHEL)

**Setup**:
```bash
# Create RPM build structure
mkdir -p ~/rpmbuild/{SOURCES,SPECS,BUILD,RPMS,SRPMS}

# Create spec file
cat > ~/rpmbuild/SPECS/your-browser.spec << 'EOF'
Name: your-browser
Version: 120.0
Release: 1
Summary: Your custom browser
License: BSD
BuildRoot: %{_tmppath}/%{name}-%{version}-buildroot

%prep
cp /path/to/out/Release/chrome .

%build
# Nothing to build (pre-built binary)

%install
mkdir -p %{buildroot}/usr/bin
cp chrome %{buildroot}/usr/bin/your-browser

%files
/usr/bin/your-browser

%changelog
* Date Author - 120.0-1
- Initial release
EOF

# Build RPM
rpmbuild -ba ~/rpmbuild/SPECS/your-browser.spec
```

#### Windows - MSI Installer

**Using Chromium's build system**:
```gn
# Enable installer building
is_official_build = true
icu_use_data_file = true

# In build directory
# out/Release/ will contain installer creation scripts
```

**Create custom MSI**:
- Use WiX Toolset (Windows Installer XML)
- Reference: `chrome/installer/windows/`
- Customize product name, icon, shortcuts

```xml
<!-- custom_installer.wxs -->
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
    <Product Id="*" Name="YourBrowser" Language="1033"
        Version="120.0.0.0" UpgradeCode="GUID">
        <!-- Define files, shortcuts, registry entries -->
    </Product>
</Wix>
```

#### macOS - DMG and PKG

**DMG distribution**:
```bash
# Create DMG
hdiutil create -volname "YourBrowser" \
    -srcfolder out/Release/Chromium.app \
    -ov -format UDZO dist/YourBrowser.dmg

# Sign DMG
codesign --deep --sign "Your Certificate" dist/YourBrowser.dmg
```

**PKG distribution** (installer):
```bash
# Use productbuild
productbuild --component out/Release/Chromium.app /Applications \
    --sign "Developer ID Installer: Your Company (ABC123)" \
    dist/YourBrowser.pkg
```

### Update Mechanisms

#### Update Server Setup

**Chromium update format** (Omaha protocol):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response server="prod">
  <app appid="{YOUR-APP-ID}" status="ok">
    <updatecheck status="ok">
      <url codebase="https://updates.example.com/v1/"/>
      <manifest version="120.0.6050.0">
        <packages>
          <package name="your_browser_120.0.6050.0_x64.exe"
                   hash="SHA1HASHHERE" size="123456789"/>
        </packages>
        <actions>
          <action event="install" run="your_browser_120.0.6050.0_x64.exe"/>
          <action event="postinstall" version="120.0.6050.0"/>
        </actions>
      </manifest>
    </updatecheck>
  </app>
</response>
```

**Configure in Chromium**:
```gn
# In args.gn
branding = "YourBrowser"
update_sparkle_mac = false  # Use Chromium's Omaha instead
```

#### Configuration Files

**Linux**:
```
/etc/your-browser/
├── update-urls.conf
└── policies.json
```

**macOS**:
```
~/Library/Application Support/YourBrowser/
├── Default/
└── Preferences
```

**Windows**:
```
%APPDATA%\YourBrowser\
├── Default\
└── User Data\
```

### Feature Flags for Distribution

**Enable/disable features per build**:
```gn
# In args.gn
enable_extensions = true
enable_sync = true
enable_supervised_users = false
enable_extensions_ui = true
enable_site_engagement = true
```

**Build variants**:
```bash
# Light build (minimal features)
gn gen out/Light --args='enable_extensions=false enable_sync=false'

# Full build
gn gen out/Full --args='enable_extensions=true enable_sync=true'

# Privacy-focused build
gn gen out/Privacy --args='enable_sync=false enable_suggestions_ui=false'
```

---

## References

### Official Documentation
- [Get the Code: Checkout, Build, & Run Chromium](https://www.chromium.org/developers/how-tos/get-the-code/)
- [Chromium Source Code Repository](https://chromium.googlesource.com/chromium/src)
- [GitHub Mirror](https://github.com/chromium/chromium)
- [GN Build Configuration](https://www.chromium.org/developers/gn-build-configuration/)
- [Design Documents](https://www.chromium.org/developers/design-documents/)

### Community Resources
- [How to fork Chromium](https://omaha-consulting.com/how-to-fork-chromium)
- [Maintaining a Chromium Fork - Yngve's Blog](https://yngve.vivaldi.net/sooo-you-say-you-want-to-maintain-a-chromium-fork/)
- [Maintaining Downstreams - Igalia Blog](https://blogs.igalia.com/dape/2024/03/05/maintaining-downstreams-of-chromium-why-downstream/)
- [Rebel Browser - Easily Brandable Fork](https://github.com/RebelBrowser/rebel)

### Build Optimization
- [Tips for Improving Build Speed - Official Docs](https://chromium.googlesource.com/chromium/src/+/778a7e84f65fd36658f91881bda07b9153a8729d/docs/linux_faster_builds.md)
- [Big Project Build Times – Chromium](https://randomascii.wordpress.com/2020/03/30/big-project-build-times-chromium/)
- [ThinLTO Documentation - LLVM](https://clang.llvm.org/docs/ThinLTO.html)

### Architecture
- [Getting Around Chromium Source Code](https://www.chromium.org/developers/how-tos/getting-around-the-chrome-source-code/)
- [What is Blink? - Chrome for Developers](https://developer.chrome.com/docs/web-platform/blink)
- [Content Module - Design Docs](https://www.chromium.org/developers/design-documents/)

### Extensions and APIs
- [Chrome Extensions Reference - Chrome for Developers](https://developer.chrome.com/docs/extensions/reference)
- [Implementing New Extension APIs](https://www.chromium.org/developers/design-documents/extensions/proposed-changes/creating-new-apis/)

### Branding and Distribution
- [macOS Code Signing - Official Guide](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/installer/mac/signing/README.md)
- [User-Agent Documentation](https://www.chromium.org/updates/ua-reduction/)

---

## Summary: Quick Start Checklist

### Getting Started
- [ ] Install depot_tools and add to PATH
- [ ] Clone/fetch Chromium source (~500GB disk needed)
- [ ] Install platform-specific build tools (VS2026 on Windows, Xcode on macOS)
- [ ] Install Python 3.8+ and C++ compiler

### First Build
- [ ] Create `out/Default` build directory
- [ ] Configure with `gn gen out/Default`
- [ ] Build with `autoninja -C out/Default chrome`
- [ ] Expect 4-20 hours depending on hardware

### Optimization
- [ ] Use SSD for source/build
- [ ] Use 16GB+ RAM (32GB recommended)
- [ ] Enable ccache for 3x faster rebuilds
- [ ] Use `is_component_build=true` for development
- [ ] Use `-j N` (cores+2) for optimal parallelism

### Forking
- [ ] Create patch-based workflow (not git branch)
- [ ] Rebase to upstream weekly or daily
- [ ] Avoid modifying string/translation files
- [ ] Use build arguments for branding
- [ ] Document custom code boundaries

### Distribution
- [ ] Code sign for your platform
- [ ] Create platform-specific packages (deb, rpm, msi, dmg)
- [ ] Set up update server (Omaha protocol)
- [ ] Test incremental updates
- [ ] Document branding and customization
