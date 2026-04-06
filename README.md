# MeloStudio
# MeloForge - Desktop Multi-Track DAW

A full-featured Digital Audio Workstation (DAW) that runs completely in the browser. Load audio tracks onto a timeline, mix them, and apply high-performance effects — all without installing any software.

**Student:** Niko Dima  
**Class:** D2D

## Project Description

This project is a browser-based multi-track DAW. Users can import audio files, arrange them on a timeline, control volume and panning, and apply real-time audio effects.

The unique aspect of MeloForge is the combination of a fast and reactive **SolidJS** frontend with a high-performance **C++ audio engine** compiled to **WebAssembly**. This approach solves a common problem in web audio applications: heavy effects often cause cracking, latency, or high CPU usage. By moving the critical audio calculations to C++, the DAW aims to feel almost as smooth and powerful as a native desktop program (like Ableton Live or FL Studio).

The application is designed for musicians who want to work on their tracks quickly from anywhere, directly in the browser.

## Goals

- Demonstrate that a browser-based DAW can deliver near-desktop performance using modern web technologies.
- Build a responsive, professional-looking interface with SolidJS and SCSS.
- Create a powerful audio processing engine in C++ that runs efficiently in the browser via WebAssembly.
- Implement cloud-based project saving using Neon PostgreSQL.
- Show good software development practices: planning, designing, realizing, testing, and reflecting.

## Technologies

### Frontend
- **SolidJS** with **TypeScript**
- **SCSS** for styling (dark professional theme)
- **Lucide-Solid** for clean icons (play, stop, record, etc.)
- **GSAP** for smooth animations

### Audio Engine
- **C++** compiled to **WebAssembly** using Emscripten
- **Maximilian** library for audio processing (filters, effects, etc.)
- Browser **Web Audio API** + AudioWorklet for integration

### Backend / Database
- **Neon** (Serverless PostgreSQL)
- Used to save project data: track names, volumes, panning, user projects, etc.

## Competences Demonstrated

This project covers the following competences:

- **Planning and progress monitoring** (B1-K1-W1): Using GitHub Projects with sprints and backlog
- **Designing** (B1-K1-W2): Technical design (data flow between C++ and browser) + wireframes in Figma
- **Realizing** (B1-K1-W3): Building the full application with SolidJS frontend and C++ audio engine
- **Testing** (B1-K1-W4): Performance tests, latency measurements, and browser compatibility
- **Improvement proposals** (B1-K1-W5): Optimizing based on test results and user feedback
- **Consultation and presentation** (B1-K2): Weekly meetings with mentor + final presentation
- **Reflection** (B1-K2-W3): Writing a final reflection report on choices, challenges, and personal growth

## Development Phases & Planning

### Phase 1: Design & Foundation (Weeks 1–4)
- Week 1: Project setup, GitHub repo, SolidJS + SCSS installation
- Week 2: Technical design and Figma wireframes (timeline + mixer)
- Week 3: Building the basic timeline UI
- Week 4: Drag-and-drop audio files + moving playhead

### Phase 2: Audio & Cloud (Weeks 5–8)
- Week 5: Basic Web Audio API integration + Play/Stop functionality
- Week 6: Connect Neon database
- Week 7: Saving and loading projects (volumes, track data)
- Week 8: Mixer controls (volume faders, pan)

### Phase 3: C++ Audio Engine (Weeks 9–13)
- Week 9: Emscripten setup + Hello World WebAssembly
- Week 10: AudioWorklet bridge between SolidJS and C++
- Week 11: First effect – Low-pass filter using Maximilian
- Week 12: Pitch shifter / Auto-Tune implementation in C++
- Week 13: Effect GUI controls in SolidJS

### Phase 4: Polish & Delivery (Weeks 14–18)
- Week 14: Add drum pads / sample player
- Week 15: Performance testing and bug fixing
- Week 16: User testing with classmates + iterations
- Week 17: Documentation, screenshots, and demo video
- Week 18: Final delivery and presentation

## Proof of Work Strategy

Evidence will be collected through:
- GitHub commit history (showing consistent work and progress)
- Screenshots and screen recordings of the working application
- Technical explanation documents (especially about the C++ ↔ SolidJS integration)
- Figma designs
- Performance test results
- Final reflection report

## Project Structure (Planned)
