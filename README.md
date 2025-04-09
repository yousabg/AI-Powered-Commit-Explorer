# AI-Powered Commit Explorer (APCE)

AI-Powered Commit Explorer (APCE) is a research tool designed to explore and evaluate Git commit messages using Large Language Models (LLMs). It allows researchers and developers to generate LLM-powered commit messages, compare them to the original messages, and analyze them using common Natural Language Processing (NLP) evaluation metrics like BLEU, METEOR, and ROUGE-L.

APCE helps answer key questions such as:
- How do LLM-generated messages compare to human-written ones?
- Can LLMs improve message clarity, completeness, and applicability?
- How do developers perceive the quality of AI-generated commit messages?

---

## 🛠 Features

- View all commits from any GitHub repository using GitHub’s API via Octokit
- Generate commit messages using various LLMs (e.g., GPT, LLaMA, DeepSeek)
- Compare human-written vs. AI-generated messages using NLP metrics
- Allow commit authors to rate messages based on Accuracy, Integrity, Readability, Applicability, and Completeness
- Provide LLM-generated summaries and potential feedback on code changes

---

## 🚀 Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

### 1. Set up your environment

Before running the app, you'll need to create a `.env.local` file in the root directory and add your OpenRouter API key:

```bash
# .env.local
NEXT_PUBLIC_OPENROUTER_API_KEY=your_openrouter_api_key_here
```
You can get an API key by signing up at OpenRouter.ai.

### 2. Run the development server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
Then open http://localhost:3000 in your browser to use the tool.

## 🔐 Environment Variables

Create a `.env.local` file in the root of your project with the following:

| Variable                         | Description                               |
|----------------------------------|-------------------------------------------|
| `NEXT_PUBLIC_OPENROUTER_API_KEY` | Your OpenRouter API key (required)        |

---

## 📂 File Editing

You can start editing the app by modifying `app/page.js`. The page auto-updates as you edit.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a modern font family by Vercel.

---

## 📚 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Octokit (GitHub API)](https://github.com/octokit)
- [BLEU, METEOR, ROUGE-L Metrics](https://en.wikipedia.org/wiki/BLEU)
- [OpenRouter](https://openrouter.ai)

---

## 🌐 Deployment

The easiest way to deploy your APCE instance is using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

For more info, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

---

## 👩‍🔬 Citation

If you're referencing APCE in academic work, please cite the associated paper (coming soon) or mention:

> “AI-Powered Commit Explorer (APCE): An LLM-Driven Research Tool for Commit Message Evaluation and Generation.”

---

## 🧠 Future Plans

- Pre-commit integration (check/improve messages before committing)
- Broader support for commit history visualization
- More evaluation metrics and custom model integration

---

Feel free to fork, star, and contribute!
