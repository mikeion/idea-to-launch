---
title: Project Parameters
---

# Project Parameters

Guidelines and constraints for the types of projects we want to build.

## Core Principles

- **Build for value**: Projects should solve a real problem for users
- **Lean approach**: Start small, iterate quickly
- **Monetization path**: Clear way to generate revenue
- **Reasonable scope**: Completable within 1-3 months of part-time work
- **Leveraged technology**: Use tools and platforms we already know

## Technical Requirements

- Maintainable codebase
- Reasonable hosting costs (<$20/month initially)
- Preference for technologies we have experience with:
  - Next.js/React or Python
  - Railway for backend services
  - Authentication via Clerk
  - Obsidian for documentation/planning

## Project Metadata Structure

We'll use this consistent metadata format in project files to make them queryable with Dataview:

```yaml
---
title: Project Name
status: backlog|in-progress|completed|on-hold
priority: high|medium|low
start-date: YYYY-MM-DD
target-date: YYYY-MM-DD
technologies:
  - tech1
  - tech2
monetization:
  - method1
  - method2
estimated-costs: $X/month
---