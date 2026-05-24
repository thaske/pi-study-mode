# Pi Study Mode

A small Pi package inspired by [ChatGPT's study mode](https://openai.com/index/chatgpt-study-mode/) and [Solve It With Code](https://solve.it.com/).

Pi Study Mode first prompts you for what you want to learn, then creates a high-level curriculum. It avoids overly precise planning, instead opting for exploration: medium-sized projects, bounded work, review points, and progress that adapts as you go.

## Usage

```text
/study start TypeScript generics
/study resume
/study pause [optional stopping note]
/study status
/study help
```

For advanced changes, edit `.pi/study/CURRICULUM.md` or `.pi/study/study-state.json` directly instead of using extra subcommands.
