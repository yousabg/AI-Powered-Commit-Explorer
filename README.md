# AI-Powered Commit Explorer (APCE)

AI-Powered Commit Explorer (APCE) is a research tool designed to explore and evaluate Git commit messages using Large
Language Models (LLMs). It allows researchers and developers to generate LLM-powered commit messages, compare them to
the original messages, and analyze them using common Natural Language Processing (NLP) evaluation metrics like BLEU,
METEOR, and ROUGE-L.

APCE helps answer key questions such as:

- How do LLM-generated messages compare to human-written ones?
- Can LLMs improve message clarity, completeness, and applicability?
- How do developers perceive the quality of AI-generated commit messages?

---

## 📑 Table of Contents

- [Features](#-features)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [File Editing](#-file-editing)
- [Learn More](#-learn-more)
- [Deployment](#-deployment)
- [Backend Setup](#-backend-setup-backend-folder)
- [Common Errors](#-common-errors--fixes)
- [Citation](#-citation)
- [Future Plans](#-future-plans)

## 🛠 Features

- View all commits from any GitHub repository using GitHub’s API via Octokit
- Generate commit messages using various LLMs (e.g., GPT, LLaMA, DeepSeek)
- Compare human-written vs. AI-generated messages using NLP metrics
- Allow commit authors to rate messages based on Accuracy, Integrity, Readability, Applicability, and Completeness
- Provide LLM-generated summaries and potential feedback on code changes

---

## 🚀 Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [
`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

### 1. Set up your environment

Before running the app, you'll need to create a `.env.local` file in the root directory and add your OpenRouter API key:

      NEXT_PUBLIC_OPENROUTER_API_KEY=your_openrouter_api_key_here

You can get an API key by signing up at OpenRouter.ai.

### 2. Run the development server

      npm run dev
      # or
      yarn dev
      # or
      pnpm dev
      # or
      bun dev

Then open http://localhost:3000 in your browser to use the tool.

## 🔐 Environment Variables

Create a `.env.local` file in the root of your project with the following:

| Variable                         | Description                        |
|----------------------------------|------------------------------------|
| `NEXT_PUBLIC_OPENROUTER_API_KEY` | Your OpenRouter API key (required) |

---

## 📂 File Editing

You can start editing the app by modifying `app/page.js`. The page auto-updates as you edit.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically
optimize and load [Geist](https://vercel.com/font), a modern font family by Vercel.

---

## 📚 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Octokit (GitHub API)](https://github.com/octokit)
- [BLEU, METEOR, ROUGE-L Metrics](https://en.wikipedia.org/wiki/BLEU)
- [OpenRouter](https://openrouter.ai)

---

## 🌐 Deployment

The easiest way to deploy your APCE instance is using
the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

For more info, see
the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

---

## 🧩 Backend Setup (`/backend` folder)

The APCE backend is a Flask server located in the `/backend` directory. It handles commit submission storage, prompt
management, and evaluation metric calculations (BLEU, METEOR, ROUGE-L).

Although it can be run locally, it is **recommended to deploy the backend to a public-facing server** (e.g.,
PythonAnywhere, Render, Railway) so that the frontend can communicate with it from any device without running into CORS
or localhost restrictions.

### 🔧 Backend Setup Instructions

1. **Navigate to the backend directory**:

         cd backend

### 2. Create and activate a virtual environment:

      python3 -m venv venv
      source venv/bin/activate

### 3. Install dependencies:

    pip install -r requirements.txt

### 4. Set up your Flask app entry point:

Ensure the bottom of flask_app.py includes:

    if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

### 5. Run the Flask server:
    python flask_app.py

### 6. Ensure your frontend is configured to talk to the backend:

Add this to your .env.local in the frontend directory:

    NEXT_PUBLIC_API_BASE=http://<your-deployed-backend-url>

### 7. Setup your MySQL

Add a .env file to the backend directory, and structure it as such:

      DB_USERNAME=<your_db_username>
      DB_PASSWORD=<your_db_password>
      DB_HOST=<your_db_host>
      DB_NAME=<your_db_name>


### 8. Setup the MySQL table:

In your MySQL database, add the following tables:

    
    CREATE TABLE Submission (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      issue_report TEXT,
      commit_id VARCHAR(255),
      commit_type VARCHAR(100),
      original_message TEXT,
      pull_request_title TEXT,
      timestamp DATETIME
    );

### 📄 File

    CREATE TABLE File (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      submission_id BIGINT,
      additions INT,
      changes INT,
      deletions INT,
      filename TEXT,
      patch LONGTEXT,
      sha VARCHAR(255),
      status VARCHAR(50),
      FOREIGN KEY (submission_id) REFERENCES Submission(id) ON DELETE CASCADE
    );

### 📄 Rating

    CREATE TABLE Rating (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    submission_id BIGINT,
    message VARCHAR(255),
    prompt_type VARCHAR(255),
    success TINYINT(1) NOT NULL,
    used_evaluate TINYINT(1) NOT NULL,
    accuracy DECIMAL(5,2),
    applicability DECIMAL(5,2),
    completeness DECIMAL(5,2),
    integrity DECIMAL(5,2),
    readability DECIMAL(5,2),
    rationale TEXT,
    FOREIGN KEY (submission_id) REFERENCES Submission(id) ON DELETE CASCADE
    );

### 📄 Metric

    CREATE TABLE Metric (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rating_id BIGINT,
    bleu_score DECIMAL(10,5),
    meteor_score DECIMAL(10,5),
    rouge_l_score DECIMAL(10,5),
    FOREIGN KEY (rating_id) REFERENCES Rating(id) ON DELETE CASCADE
    );

### 🧪 Common Errors & Fixes

Here are some issues encountered during development and how to resolve them:

---

#### ❌ `ModuleNotFoundError: No module named 'argon2'`

This error occurs when Flask can't find the Argon2 password hashing module.

✅ **Fix**:

      pip install argon2-cffi

---

#### ❌ `ModuleNotFoundError: No module named 'mysql'`

This happens when the MySQL connector required for SQLAlchemy isn’t installed.

✅ **Fix**:

      pip install mysql-connector-python


---

#### ❌ Port 5000 already in use

Flask will throw an error if something else is already using port 5000.

✅ **Fix**:

Check which process is using the port:

      lsof -i :5000

Then kill the process:

      kill -9 <PID>

---

#### ❌ IntelliJ/PyCharm: `ModuleNotFoundError` even after installing

This usually means IntelliJ is not using the correct Python interpreter.

✅ **Fix**:

- Go to \`Preferences > Project > Python Interpreter\`
  - Set it to:

         /path/to/your/project/backend/venv/bin/python

- Apply and re-run your script.


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
