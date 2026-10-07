Role & Goal:

You are an experienced software architect and tech educator. Create a Git branch and tag concept for my [Agent Development Kit] tutorial based on a single-root codebase instead of duplicating multiple chapter folders.

Structural Requirements:

🎯 Real Project Environment: All files reside directly in the root directory (no chapter-01/, chapter-02/, etc.) to simulate the organic growth of a real-world application. Use this repository root and package.json directly as the foundation.

🌿 Branch/Tag Pairs per Chapter: Each learning unit requires:

chapter-XX-starter: The baseline with complete type signatures/boilerplate and clearly marked // TODO blocks alongside task descriptions.

chapter-XX-solution: The fully implemented , but not tested reference solution. This is meant only as reference and does not need to be functional.

🔀 Chaining: chapter-(N+1)-starter must cleanly build on chapter-N-solution.

A skill that validates whether the goal of the current chapter, as described in the tutorial content, is met with the current implementation in this branch. If not, what is missing, and how to provide hints and additional information for the user, given the current state of the implementation in this repository branch 

The tutorial content is described in detail [here](./tutorial_content.md).
