Original Goal and Fundamental principles:
"Migrate bklit ui charts to tanstack charts
I want to migrate bklit ui charts to tanstack charts with the following critical rules:
- Same desing, animations and components api
- 1st: Start with the Tanstack chart. 2nd: Add bklit-ui design on top of Tanstack chart native backend. 3rd: Add bklit-ui interactivity features
- Migrate with identical compoennt bklit ui charts API/Prop strucuture
- Gains should me measured in performance gains:
  - Time to render
  - Runtime load
  - Onchange and interactivity load/speed"

For research use context7 mcp, fallback to web search tool

PHASE 2 GOALS

- Refactor migrated charts to our move close to a tanstack charts native backend
- Remove wrappers, uncessary complexity/extra steps, custom written overhead added for things already handled with tanstack charts native
- Make sure the Original Goal requriemnts are intact

PHASE 2 STEPS:

Phase 0: Research and Document

Note: Use sub-agents to do this according to your instructions and write the documentation ina research folder you set the strucutre for. 

0.0- set up the logs benchmark and progress files given this phase to plan doc in the @docs/ folder so we can do do things correctly throughout the whole phase 2
0.1- List the charts in bklit-ui and tanstack, and inner components, interacticity features, document components APIs for backwards compatability post miigration
  - We did this already in phase 1, you can duplicate the documents with a bash command to the phase 2 equivalent directory
0.2- Now do what we did for 0.1 on phase 1, for the mirgated charts
0.3- Given the mapping of the migrated charts and PHASE 2 GOALS:
  - for each migrated chart, we launch a sub agent to create a audit report where he flags:
    - Non tanstack charts native patterns and flows with a direct equivalent
    - Custom wrappers, unecessary complexity/extra steps, with a direct tanstack charts native equivalent
    - Broken or unreliable flows that dont follow tanstack or bklit patterns
    - Incorrect bklit frontend design, animation and other UI/UX patterns (They need to be 1:1 identical)
  - this agent should do this by reading the research talks we set up for phase 2 only )docs from step 0.1 + research/phase-2/bklitui-native, research/phase-2/tanstack-native) and the code base of our migrated charts, and in case he needs to verify how the legacy libraries do it he can also read the bklit-ui and tanstack codebases


Phase 1: Synthesize and Refactor

Note:  You are the one synthezising, and you work and orchastrate things like this depending on what you want to do

- To research, review the migrated, bklit and tanstack codebases (here is helpful to use explore agents), research the libraries and tech stack documentations using context7 cli (read this to know how to use it .commandcode/skills/find-docs/SKILL.md)
- To implement changes use sub agents with detailed instructions to execute the changes this way your efficient and can focus on how we do things and review then afterwards how the agent did think cause sometimes they will find loopholes and bypass your instructions, so make sure work is done correctly afterwards

1.0: THIS IS A FOR LOOP, WHERE FOR EACH CHART IN THE LISTED PROGRESS CHART YOU:

  1.1- pick the next open chart to work on according to the progress file
  1.2- set your todo list tasks for this loop
  1.3- Synthesize: 
    - read through audits files and synthesize everything into a plan document where:
      a- given all of the flags in the audits we concise everything into a non-redundant clean and efficient plan doc that gets us closer to the phase 2 goals
      b- When unsure or if there are open questions, you can always research to verify things NEVER ASSUME.
        - research the libraries and tech stack documentations using context7 cli (read this to know how to use it .commandcode/skills/find-docs/SKILL.md)
        - if things cannot be verified through documentation, use a sub agent to write and run scripts that output results that give you verifiable answers.
            Make sure to give the right instructions so the agent set up tests correctly and doesn't cheat to give you the results that sound good.
    - write the plan doc, if there's one from a earlier loop, you should indent the plan files of the chart into a research/phase-2/plans/(chart-name)/plan-loop-(number).md
  1.4.- Implement the code changes according to the plan
    - use a sub agent, review the code afterwards
    - Approve changes based on, the goals of the plan, QA, Benchmarks:
        - If any of tests above failed:
          1- If it's a big or a quick fix you can iterate quickly a couple of times, but if options are exausted you stop (it's ok)
          2- Log your learnings
          3- DON'T MOVE TO THE NEXT CHART. Go back to step 1.2 and do the loop again + iterate on learnings
        - If all test pass:
          1- Log your learnings and the keys to success
          2- move to step 1.1 for the next chart on the list