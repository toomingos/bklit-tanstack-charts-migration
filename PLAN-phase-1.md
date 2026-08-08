Migrate bklit ui charts to tanstack charts
I want to migrate bklit ui charts to tanstack charts with the following critical rules:
- Same desing, animations and components api
- Gains should me measured in performance gains:
  - Time to render
  - Runtime load
  - Onchange and interactivity load/speed

Repos (download these locally): 
https://github.com/bklit/bklit-ui
https://github.com/TanStack/charts

For research use context7 mcp, fallback to web search tool

When working with Sonnet agents: You as fable want to be the one theorizing, researching and deciding. Using sonnet agents to do bulk work, like information gathering, script buidling under your instructions. Make sure to review scripts/code is done according to the your research, our goals and instructions, Sonnet agents have a tendency to cheat to achieve certain metrics, write slopply code or use dissalowed workaorunds

Steps:

Phase 0: Research and Document

Note: Use sonnet agents to do this according to your instructions and write the documentation ina research folder you set the strucutre for. 

0.1- List the charts in bklit-ui, and inner components, interacticity features, document components APIs for backwards compatability post miigration
0.2- List the equivalent charts in TanStack charts, and inner components, document components APIs too
0.3- Understand, map and document the stacks used for both bklit-ui TanStack charts. We need to understand the core rendering and principles of each
0.4- Set the metrics we are going to evaluate for Time to render, Runtime load, Onchange and interactivity load/speed, and create baseline benchmark based on scripts we can rerun later and add migrated components to compare
0.5- Define deterministic tests for Migration QA and Benchmarking:
  - QA: Design needs to be blkit-ui 1:1 (can we make this headless)
  - Benchmarking: Performance gains goal needed for each metric to approve migration
These need to be created (use sonnet agents) so we can run them easily as scripts later on.
0.6- Create:
  - A progress doc with placholders for all compoents that need to be migrated 
  - A respective benchmarks doc
  - A log doc for key decisions, insights, deviations to keep mind in longer time frames of the work


Phase 1: Strategize

Note:  You, as Fable have higher intelligence than sonnet so it do this yourself as it's the foudation for the rest of the work.

1.1- Pick a component to migrate first, where once done, all of the other component migrations become more easier as the insightis were proven
1.2.- Read the research docs, use context7 mcp for futher research, scripts to verify assumptions so we can nail empirically this approach:
- 1st: Start with the Tanstack chart we selected
- 2nd: Add bklit-ui design to it
- 3rd: Add bklit-ui interactivity features: This part is crucial, and we need to find a a way that is closest to the Tanstack chart stack so it's effcient, non redudant and according to the core technical  Tanstack chart fundamentals. Run this workflow steps:
  - Research, make thesis, if unsure verify and test different routes. Remember your north stars are Time to render, Runtime load, Onchange and interactivity load/speed. We want to be as close to native Tanstack chart benchmakrs as possible, and much better than bklit-ui.
  - Approve ideas based on benchmarks
  - Redo the first Research, verify and benchmark step for possible  improvements
  - Once you feel like you exausted all options
    - Criteria: If Perfomance metrics aren't much closer to Tanstack chart benchmarks than bklit-ui then you failed.
- 4th: if successful refactor, cleanup, remove uncessery complexity and duplicated logic

1.3.- Document learnings and the keys to success and approach for the next

Phase 2: Migrate

Note: You, as Fable, with the proven approach are now the orchestrator of sub Sonnet agents. You focus on the migatrion with this loop:

2.1- Pick the next chart on the list
2.2- Review things, to see if there are any edge cases/unique chareteristics to this compoent we havent faced before. if so Research and Verify
2.3- Launch a Sonnet agent to do the migration
2.4- Launch  a Sonnet agent to do the QA
- If failed, you, as Fable, log learnings,  Review Research and Verify, have Sonnet agent fix
2.5- Launch a Sonnet agent to do benchmarking
- If failed, you, as Fable, log learnings,  go back to step 2.2., iterate on learnings
2.6-  Launch a refactor, cleanup, remove uncessery complexity and duplicated logic (must run the same QA + Benchmarking scripts for sanity check at the end)

Run phase 2 until all compoents are migrated

Phase 3: Showcase

Note: repos/ is read-only, so copy studio-docs' scaffolding out into a showcase/ app at the project root and build there. You, as Fable, define the page structure; Sonnet agents build it.

3.1- Copy apps/studio-docs' scaffolding (fumadocs setup, layout, shared components) into showcase/, leave its existing content behind (content/, nav config), and rewire the @bklit/ui workspace dep to a path dependency on repos/bklit-ui/packages/ui (importing from the clone is fine, writing isn't)
3.2- Define page structure: one page per chart, in docs/PROGRESS.md order, plus an overview page
3.3- Each chart page renders bklit-ui vs migrated side by side, live and interactive, with status/QA/benchmark numbers pulled straight from docs/PROGRESS.md so the docs never drift from the tracker, these sections need to be short, consice and withotu fluff, use tables and use x times instead of % to explain gains
3.4- Overview page: gap count, approved/in-progress/not-started counts, aggregate M1a/M3a/M3c deltas across approved charts
3.5- Launch Sonnet agents to build pages per your structure; review each against docs/PROGRESS.md and docs/LOG.md before approving
