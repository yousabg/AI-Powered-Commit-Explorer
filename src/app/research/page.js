"use client";

import {useEffect, useState} from "react";
import {
    deletePrompt,
    getPrompts,
    getResearch,
    PasswordNotSet,
    postPassword,
    postPrompt,
    toggleEvaluate
} from "@/app/services/api";

export default function Research() {
    const [password, setPassword] = useState("");
    const [submissions, setSubmissions] = useState([]);
    const [error, setError] = useState(null);
    const [expandedPatches, setExpandedPatches] = useState({});
    const [loading, setLoading] = useState(false);
    const [prompts, setPrompts] = useState([]);
    const [activeTab, setActiveTab] = useState("submissions");
    const [loggedIn, setLoggedIn] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [newPromptType, setNewPromptType] = useState("");
    const [evaluationPrompt, setEvaluationPrompt] = useState("");

    useEffect(() => {
        if (activeTab === "evaluation_prompt") {
            fetchEvaluationPrompt();
        }
    }, [activeTab]);


    const fetchEvaluationPrompt = async () => {
        try {
            const response = await fetch("/refinement_prompt.txt");
            const text = await response.text();
            setEvaluationPrompt(text);
        } catch (error) {
            console.error("Error fetching evaluation prompt:", error);
            setEvaluationPrompt("Failed to load evaluation prompt.");
        }
    };

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const data = await getResearch(password);
            setSubmissions(data.submissions);
            await fetchPrompts();
            console.log(data)
            setLoggedIn(true);
            setError(null);
        } catch (err) {
            if (err instanceof PasswordNotSet) {
                setError("Password not set. Please set your password.");
            } else {
                setError(err.message);
            }
            setSubmissions([]);
        } finally {
            setLoading(false);
        }
    };

    const setNewPassword = async () => {
        setLoading(true);
        try {
            await postPassword(password);
            const data = await getResearch(password);
            await fetchPrompts();
            setLoggedIn(true);
            setSubmissions(data.submissions);
            setError(null);
        } catch (error) {
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    const togglePatch = (fileId) => {
        setExpandedPatches((prev) => ({
            ...prev,
            [fileId]: !prev[fileId],
        }));
    };

    const fetchPrompts = async () => {
        const data = await getPrompts();
        setPrompts(data.map(prompt => ({
            id: prompt.id,
            message: prompt.message,
            promptType: prompt.promptType,
            evaluate: prompt.evaluate || false
        })));
    };

    const addPrompt = async () => {
        try {
            setLoading(true);
            await postPrompt(newMessage, newPromptType);
            await fetchPrompts();
        } catch (error) {
            setError(error);
        } finally {
            setLoading(false);
        }
    }

    const removePrompt = async (promptId) => {
        try {
            setLoading(true);
            await deletePrompt(promptId);
            await fetchPrompts();
        } catch (error) {
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEvaluateState = async (promptId) => {
        try {
            setLoading(true);
            await toggleEvaluate(promptId);
            await fetchPrompts();
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

        return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Research Submissions</h1>

            <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 rounded w-full mb-4"
            />

            <button
                onClick={fetchSubmissions}
                className="bg-blue-500 text-white px-4 py-2 rounded"
                disabled={loading}
            >
                {loading ? "Loading..." : "Fetch Submissions"}
            </button>

            {error && (
                <div className="text-red-500 mt-4">
                    <p>{error}</p>
                    {error === "Password not set. Please set your password." && (
                        <div className="mt-2">
                            <input
                                type="password"
                                placeholder="Set your password"
                                className="border p-2 rounded w-full mb-4"
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                            />
                            <button
                                onClick={setNewPassword}
                                className="bg-blue-500 text-white px-4 py-2 rounded"
                                disabled={loading}
                            >
                                {loading ? "Setting Password..." : "Set Password and Fetch Submissions"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {loading && <p className="mt-4 text-gray-500">Fetching data, please wait...</p>}

            <div className="mt-6">
                {loggedIn && (
                    <div className="mb-4 flex space-x-4">
                        <button
                            className={`px-4 py-2 rounded ${activeTab === "submissions" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                            onClick={() => setActiveTab("submissions")}>
                            Submissions
                        </button>
                        <button
                            className={`px-4 py-2 rounded ${activeTab === "prompts" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                            onClick={() => setActiveTab("prompts")}>
                            Prompts
                        </button>
                        <button
                            className={`px-4 py-2 rounded ${activeTab === "evaluation_prompt" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                            onClick={() => setActiveTab("evaluation_prompt")}>
                            Refinement Prompt
                        </button>
                    </div>
                )}
                {activeTab === "submissions" && (
                    submissions.map((submission) => (
                        <div key={submission.id} className="border p-4 mb-4 rounded shadow">
                            <h3 className="text-lg font-semibold">Commit ID: {submission.commit_id}</h3>
                        <p><strong>Issue Report:</strong> {submission.issue_report}</p>
                        <p><strong>Commit Type:</strong> {submission.commit_type}</p>
                        <p><strong>Original Message:</strong> {submission.original_message}</p>
                        <p><strong>Pull Request Title:</strong> {submission.pull_request_title}</p>
                        <p><strong>Timestamp:</strong> {submission.timestamp}</p>

                        <h4 className="mt-2 font-semibold">Files:</h4>
                        <ul className="list-disc ml-5">
                            {submission.files.map((file) => (
                                <li key={file.id} className="mb-2">
                                    {file.filename} (Changes: {file.changes})
                                    <button
                                        onClick={() => togglePatch(file.id)}
                                        className="ml-2 text-blue-500 underline"
                                    >
                                        {expandedPatches[file.id] ? "Hide Patch" : "Show Patch"}
                                    </button>
                                    {expandedPatches[file.id] && (
                                        <pre className="bg-gray-100 p-2 mt-2 rounded overflow-auto">{file.patch}</pre>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <h4 className="mt-2 font-semibold">Ratings:</h4>
                        {submission.ratings.map((rating) => (
                            <div key={rating.id} className="mt-2 p-2 border rounded">
                                <p><strong>Message:</strong> {rating.message}</p>
                                <p><strong>Message Label:</strong> {rating.prompt_type}</p>
                                <p><strong>Accuracy:</strong> {rating.accuracy}</p>
                                <p><strong>Applicability:</strong> {rating.applicability}</p>
                                <p><strong>Completeness:</strong> {rating.completeness}</p>
                                <p><strong>Integrity:</strong> {rating.integrity}</p>
                                <p><strong>Readability:</strong> {rating.readability}</p>
                                <p><strong>Rationale:</strong> {rating.rationale}</p>
                                <p><strong>Success:</strong> {rating.success ? "Yes" : "No"}</p>
                                <p><strong>Used Refinement:</strong> {rating.used_evaluate ? "Yes" : "No"}</p>
                                <p><strong>Metrics:</strong></p>
                                <ul className="list-disc ml-5">
                                {rating.metrics.map((metric) => (
                                        <li key={metric.id}>
                                            BLEU: {metric.bleu_score}, METEOR: {metric.meteor_score},
                                            ROUGE-L: {metric.rouge_l_score}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )))}
                {activeTab === "prompts" && (
                    <div className="mt-6">
                        <h2 className="text-xl font-bold">Prompts</h2>
                        <ul className="list-disc ml-5">
                            {prompts.map((prompt) => (
                                <div key={prompt.id} className="mb-4 p-2 border rounded">
                                    <p><strong>Label:</strong> {prompt.promptType}</p>
                                    <p><strong>Message:</strong> {prompt.message}</p>
                                    <button
                                        onClick={() => removePrompt(prompt.id)}
                                        className="mt-2 bg-red-500 text-white px-4 py-2 rounded mr-4"
                                        disabled={loading}
                                    >
                                        Remove
                                    </button>
                                    <button
                                        onClick={() => toggleEvaluateState(prompt.id)}
                                        className={`mt-2 px-4 py-2 rounded ${prompt.evaluate ? "bg-green-500" : "bg-red-500"} text-white`}
                                        disabled={loading}
                                    >
                                        {prompt.evaluate ? "Using Refinement Prompt" : "Not Using Refinement Prompt"}
                                    </button>
                                </div>
                            ))}
                        </ul>

                        <h3 className="text-lg font-semibold mt-6">Add New Prompt</h3>
                        <p className="text-gray-600 text-sm mb-2">
                            Use the following optional references in your message:
                        </p>
                        <ul className="text-gray-500 text-xs mb-4 list-disc ml-5">
                            <li><span className="font-mono text-blue-600">[DIFF]</span> - Highlights differences between
                                code versions.
                            </li>
                            <li><span className="font-mono text-blue-600">[PR]</span> - Represents a pull request title.
                            </li>
                            <li><span className="font-mono text-blue-600">[IR]</span> - Denotes an issue report related
                                to the submission.
                            </li>
                            <li><span className="font-mono text-blue-600">[CT]</span> - Specifies the type of commit
                                (e.g., feature, bug fix).
                            </li>
                            <li><span className="font-mono text-blue-600">[OM]</span> - Refers to the original commit
                                message.
                            </li>
                        </ul>


                        <input
                            type="text"
                            placeholder="Enter message"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="border p-2 rounded w-full mb-2"
                        />

                        <input
                            type="text"
                            placeholder="Enter prompt label"
                            value={newPromptType}
                            onChange={(e) => setNewPromptType(e.target.value)}
                            className="border p-2 rounded w-full mb-2"
                        />

                        <button
                            onClick={addPrompt}
                            className="bg-green-500 text-white px-4 py-2 rounded"
                        >
                            Add Prompt
                        </button>
                    </div>
                )}

                {activeTab === "evaluation_prompt" && (
                    <div className="mt-4 p-4 border rounded bg-gray-100">
                        <h2 className="text-xl font-bold">Refinement Prompt</h2>
                        <pre className="whitespace-pre-wrap mt-2">{evaluationPrompt}</pre>
                    </div>
                )}
            </div>
        </div>
        );
}
