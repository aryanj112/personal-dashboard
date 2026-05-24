# Project
Personal Dashboard — a life operating system that grew from a simple habit tracker into a custom hub for tasks, workouts, networking, internship sourcing, and resume tailoring.

## Goal
I wanted to stop stitching together generic tools that only partially fit how I work. The goal was to evolve a basic habit tracker into software that actually matched my life: something I could use to run my day, track progress, manage recruiting, and apply to internships from one place.

## Context
This was a personal full-stack codebase with a React frontend, a FastAPI backend, and a SQLite database. The project started small: it was mainly for habit tracking. Over time, I used the coding agent as a product and engineering partner to repeatedly reshape it around my real workflows instead of forcing myself into whatever existing software happened to support.

The session was not one isolated bug fix. It was a long, iterative build where I kept tightening the product around myself. That meant a mix of architecture, database-backed features, workflow design, and a lot of taste-driven UI iteration.

## Session Transcript (Curated)

### 1. Reframing the project from “habit tracker” to “life hub”
- **My prompt:** I wanted the app to become “a hub for my whole life,” not just a tracker.
- **The agent’s key response/code:** It helped expand the app into a multi-page dashboard with dedicated surfaces for Today, Dashboard, Workouts, Networking, Internships, Resume, and Settings, all tied together with shared routing, preferences, and local API-backed data loading.
- **Why this step mattered:** This was the product thesis change. Instead of adding disconnected features, I started treating the app like my own operating system. That framing made later decisions much clearer: every new feature had to support a real recurring workflow in my life.

### 2. Turning daily tracking into something I would actually open every day
- **My prompt:** I kept asking for practical daily improvements: better task editing, a notes section, a week view that could expand, clearer streaks, editable workout history, and cleaner habit visualization.
- **The agent’s key response/code:** It added a much more usable Today workflow: day-specific notes with bullets and checklists, a weekly calendar that could switch dates or open an expanded modal view, inline task editing, collapsible history, editable past workouts, heatmap filtering, and better streak handling such as showing how many days it had been since a habit was last completed.
- **Why this step mattered:** The app stopped being passive self-quantification and became actionable. I could use it not just to observe my habits, but to plan my day, review previous days, and quickly update things without friction. A surprising amount of product value came from many small UX decisions rather than one big feature.

### 3. Building a real outreach workflow on top of my own recruiting data
- **My prompt:** I had a database table of `potential_connects` and wanted a page that would actually help me send LinkedIn messages in batches, edit the message cleanly, update statuses, and move people into my broader network if they replied.
- **The agent’s key response/code:** It analyzed the table first, then built a true outreach queue around it: filters by company and status, an editor with a large message pane, copy-to-clipboard and open-LinkedIn actions, fast status transitions, a replied pool, a “save to network” action, and database-backed syncing so outreach contacts and networking contacts did not diverge. Later, it added persistence rules like `converted_to_network` so the queue reflected reality instead of becoming cluttered.
- **Why this step mattered:** This was one of the first moments where the project moved beyond “productivity app” into something deeply specific to me. Instead of adopting a CRM, I built one around my exact outreach style. The important technical lesson was to let the schema drive the UI: read the real table first, then design the workflow around the actual data.

### 4. Solving the hardest product/technical problem: internship scraping
- **My prompt:** I wanted a backend-first internships system that could pull live postings for selected companies, start with companies on Greenhouse or Lever, and then surface the roles I actually wanted without drowning me in irrelevant results.
- **The agent’s key response/code:** It created a dedicated internships page and backend pipeline with tracked companies, normalized internship postings, source-specific adapters, and company fetch endpoints. Then it evolved the filter logic from a naive keyword pass into a safer two-stage system: keep internships broadly, but organize them into `prime`, `other`, `not prime`, and later `hidden` buckets. Crucially, the agent recommended persistent manual overrides per role ID so I would not lose good postings and would not have dismissed postings reappear after refresh.
- **Why this step mattered:** This was the smartest product decision in the whole project. The easy thing would have been to overfit the filter and silently miss roles. Instead, I ended up with a system that balanced automation and judgment: broad enough not to miss opportunities, structured enough not to overwhelm me, and persistent enough to respect the work I already did sorting roles.

### 5. Iterating from scraping to application workflow
- **My prompt:** Once the internships page existed, I wanted it to feel like a real recruiting tool: favorites, ordering, easy company navigation, careers-site links, and the ability to curate results without losing them.
- **The agent’s key response/code:** It added company favorites and reordering, a cleaner left rail, soft-hide behavior for roles, recovery views for hidden items, and subtle UI distinctions between prime roles and the rest. It also helped remove anything that felt like clutter when it did not help me move faster.
- **Why this step mattered:** This phase taught me that good software is often subtractive. I kept noticing when something looked clever but was not actually useful, and the agent helped me simplify the product instead of only adding more. That felt like real product judgment, not just coding.

### 6. Closing the loop with a resume-tailoring workspace
- **My prompt:** I make my resume in LaTeX, so I wanted a dedicated Resume page with a three-panel workflow: resume list, code editor, and rendered output, plus PDF export.
- **The agent’s key response/code:** It built a resume-tailoring environment with a backend LaTeX compile endpoint, live rendered preview, export to PDF, syntax-highlighted editing, and later a cleaner rendering experience without distracting browser PDF controls. It also tuned the layout so the page was wider and more focused on the code and the rendered resume.
- **Why this step mattered:** This connected the project end to end. The internships page helped me find opportunities, but the resume page helped me act on them. At that point the dashboard was no longer just a tracker or organizer; it had become a system for actually moving my career forward.

### 7. Using the agent not just for generation, but for technical investigation
- **My prompt:** I asked the agent to audit a Tesla jobs scraper that another model had started but not finished, including reading the context file, checking what was stale, and figuring out what still depended on being in the US.
- **The agent’s key response/code:** Instead of pretending it was solved, it inspected the code, compared it to the context note, identified stale assumptions, confirmed the current Tesla path, and then hardened the scraper with better diagnostics and configurable browser behavior. It also clearly separated what could be spoofed in-browser from what genuinely depended on IP geography and anti-bot systems.
- **Why this step mattered:** This showed a more advanced use of the agent: not just “build feature X,” but “help me understand the true state of a messy system.” That kind of honest debugging and scope control is exactly where I think AI is most powerful.

## Key Breakthroughs
- I stopped treating the app like a collection of widgets and started treating it like a personal operating system with real workflows behind each page.
- On internships, I avoided the classic mistake of over-automating too early. Persistent manual buckets (`prime`, `other`, `not prime`, `hidden`) gave me control without losing the benefits of scraping and ranking.
- On networking, I used the underlying database schema to design the interface, which made the resulting tool feel much more coherent than a generic CRM.
- The project became much stronger through iteration and removal: many of the best improvements were simplifying interactions until the product matched how I naturally think.

## Final Outcome
What started as a habit tracker is now a highly tailored personal dashboard that I use to manage multiple parts of my life in one place. It handles daily planning and notes, tracks habits and workouts, supports outreach and relationship management, pulls and curates internship postings from selected companies, and gives me a resume-tailoring environment for applications. The app feels cohesive because the features were not brainstormed abstractly; they were pulled directly from pain points in my own routines.

## Why I’m Proud of This Session
I’m proud of this session because it shows more than “I used AI to add features.” It shows judgment. I kept pushing the software toward real usefulness, cut things that were not helping, and used the agent for both implementation and reasoning. The result is software that feels deeply personal to me in a way off-the-shelf tools never have. That is the part I care about most: I did not just ship more code — I shaped the product around how I actually live and work.
