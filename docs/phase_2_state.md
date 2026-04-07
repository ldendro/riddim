# Riddim: Phase 2 State

## Overview
Phase 2 (Taste Mapping & Discovery) successfully builds upon the data ingestion pipeline formulated in Phase 1 to close the user interaction loop. We introduced an interactive feedback overlay on the Discover page that registers user reactions synchronously to the backend SQLite model, capturing real-time EDM taste preferences mapping directly to the underlying Librosa features.

## Major Changes & Additions

### 1. Interactive Taste Collection UI
The Discover view was completely converted from a mock view into a highly-functional rating component:
- **Neon Feedback Overlay:** A premium dark-mode interface containing bespoke inline SVG reaction buttons (`Love`, `Like`, `Neutral`, `Not My Sound`, `Skip`).
- **State Persistence:** User interaction metadata is pushed functionally to a localized `userReactions` React state object. Navigating seamlessly into the track history (via the custom `SkipBack` icon button) dynamically restores vivid tooltip outlines organically mapping towards their previously recorded choice. 
- **Custom CSS Engine Architecture:** Scrapped the default operating system lag-inducing HTML `title` tooltip properties in favor of lightning-fast cascading `data-tooltip` tags operating gracefully over `cubic-bezier()` transitions.

### 2. The Feedback Database API Layer
- **`feedback.py` Backend Instance:** Orchestrated an independent REST endpoint over `/api/feedback/reaction` hooking our interactive web payloads natively into the `FastAPI` instance.
- **SQLite Transactions:** Translated raw HTTP reactions onto `schema.sql` boundaries, managing implicit user instantiation logic via deterministic `INSERT OR IGNORE` fallbacks natively protecting `local_user` data architectures.

### 3. Lifecycle Audio Optimization 
- Overcame canonical React 18 `fetch()` and `useEffect()` double-instantiating limitations destroying synchronous WebAudio outputs. By assigning rigid `<AudioPlayer key={...} />` identity hooks combined against aggressive `ws.pause()` intercept safeguards prior to tearing down `WaveSurfer.js` objects, track transitions seamlessly buffer forwards and backwards without retaining ghost audio trails.

## Transition to Phase 3 (Taste Profile Modelling & Visualization)
With robust UI components delivering dense interaction nodes to the SQLite endpoints natively correlated with numeric characteristics, we stand prepared strictly for inference pipelines.
In Phase 3 we will:
1. Orchestrate the core machine-learning component—a `TasteModel` logic bridging librosa measurements sequentially calculated via exponential moving averages (EMA).
2. Wire interactions toward an active taste centroid and visualize these multi-dimensional taste spaces via UMAP frontend clusters!
