import {Octokit} from "@octokit/core";

// GitHub API
export const getRepos = async (token) => {
    const octokit = new Octokit({auth: token});
    return await octokit.request("GET /user/repos", {
        headers: {"X-GitHub-Api-Version": "2022-11-28"},
    });
}

export const getCommits = async (token, username, selectedRepo) => {
    const octokit = new Octokit({auth: token});
    return await octokit.request("GET /repos/{owner}/{repo}/commits", {
        owner: username,
        repo: selectedRepo,
        headers: {"X-GitHub-Api-Version": "2022-11-28"},
    });
}

export const getCommitData = async (token, username, selectedRepo, sha) => {
    const octokit = new Octokit({auth: token});
    return await octokit.request("GET /repos/{owner}/{repo}/commits/{sha}", {
        owner: username,
        repo: selectedRepo,
        sha: sha,
    });
}

export const getPullRequestAndIssues = async(sha, token, username, selectedRepo) => {
    try {
        const octokit = new Octokit({auth: token});
        const prResponse = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
            owner: username,
            repo: selectedRepo,
        });
        const issueResponse = await octokit.request("GET /repos/{owner}/{repo}/issues", {
            owner: username,
            repo: selectedRepo,
        });
        return {
            pull_request: prResponse.data.find(pr => pr.head.sha === sha) || null,
            issue_report: issueResponse.data.find(issue => issue.pull_request && issue.pull_request.sha === sha) || null
        };
    } catch (error) {
        console.error("Error fetching PR/issues:", error);
        return {pull_request: null, issue_report: null};
    }
}

//LLM API
export const getDeepSeekResponse = async (input) => {
    console.log(input);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "deepseek/deepseek-r1:free",
            "messages": [
                {
                    "role": "user",
                    "content": input
                }
            ]
        })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    if (data && data.choices && data.choices.length > 0) {
        const content = data.choices[0].message.content.trimStart();
        if (content) {
            if (content.includes("<tool_response>")) {
                throw new Error("Invalid response")
            }
            return content;
        } else {
            throw new Error("Empty message received");
        }
    } else {
        throw new Error("No choices found");
    }

}

//Server API
export const postSubmission = async (completeRatings) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/add_submission`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(completeRatings)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(errorData)}`);
    }

}

export const getScores = async (original_message, AI_message) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/evaluate_message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            original_message: original_message,
            ai_message: AI_message
        })
    });

    if (!response.ok) {
        console.error("Error fetching scores", response.statusText);
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }

    return await response.json();
}

export class PasswordNotSet extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        Error.captureStackTrace(this, this.constructor);
    }
}
export const getResearch = async (password) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/get_submissions/${password}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const message = await response.json();

    if (!response.ok) {
        if (message.error === "No password set.") {
            console.log(message)
            throw new PasswordNotSet();
        } else {
            throw new Error(`HTTP error! Status: ${response.statusText}`);
        }
    }
    return message;
}

export const postPassword = async (password) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/set_password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            new_password: password,
        })
    });

    if (!response.ok) {
        console.error("Error setting password", response.statusText);
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }
}

export const getPrompts = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/get_prompts`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }
    return await response.json();
}

export const postPrompt = async (prompt, promptType) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/add_prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: prompt,
            promptType: promptType,
        })
    });

    if (!response.ok) {
        console.error("Error setting password", response.statusText);
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }
}

export const deletePrompt = async (id) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/delete_prompt`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }
}

export const toggleEvaluate = async (id) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/toggle_evaluate`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.statusText}`);
    }
}