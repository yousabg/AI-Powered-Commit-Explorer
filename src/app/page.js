"use client";

import {useState, useEffect} from "react";
import {Listbox} from "@headlessui/react";
import {CheckIcon, ChevronDownIcon} from "@heroicons/react/20/solid";
import {
    getCommitData,
    getCommits,
    getDeepSeekResponse, getPrompts,
    getPullRequestAndIssues,
    getRepos, getScores, postSubmission
} from "@/app/services/api";
import {
    checkIfValidCommit,
    chooseResponse,
    classifyCommitType,
    replaceEvaluation,
    replacePlaceholders
} from "@/app/helper_functions";

export default function Home() {
    const [commitData, setCommitData] = useState([]);
    const [selectedCommit, setSelectedCommit] = useState(null);
    const [error, setError] = useState(null);
    const [token, setToken] = useState("");
    const [showDiffs, setShowDiffs] = useState(false);
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState("");
    const [username, setUsername] = useState("");
    const [aiMessages, setAiMessages] = useState([]);
    const [aiMessageScores, setAiMessageScores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingLog, setLoadingLog] = useState("Loading... (This may take a while)");
    const [consentGiven, setConsentGiven] = useState(false);
    const [showAiMessagesModal, setShowAiMessagesModal] = useState(false);
    const [ratings, setRatings] = useState({});
    const [shuffledMessages, setShuffledMessages] = useState([]);
    const [successfulSubmission, setSuccessfulSubmission] = useState(false);

    useEffect(() => {
        if (aiMessages.length > 0) {
            const messagesWithIndex = aiMessages.map((messageObj, index) => ({
                message: messageObj.message,
                promptType: messageObj.promptType,
                index
            }));

            const shuffled = [...messagesWithIndex].sort(() => Math.random() - 0.5);
            setShuffledMessages(shuffled);
        } else {
            setShuffledMessages([]);
        }
    }, [aiMessages]);

    const handleRatingChange = (id, characteristic, value) => {
        if (id === 'original' || (aiMessages[id] && aiMessages[id].success !== false)) {
            setRatings((prev) => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    [characteristic]: value,
                    rationale: prev[id]?.rationale || '',
                    commitId: selectedCommit?.sha || '',
                    files: selectedCommit?.files?.map(({ blob_url, contents_url, raw_url, ...rest }) => rest) || [],
                    pullRequestTitle: selectedCommit?.pull_request?.title || '',
                    associatedIssueReport: selectedCommit?.issue_report?.title || '',
                    commitType: selectedCommit?.commit_type || '',
                    originalMessage: selectedCommit?.commit?.message || '',
                    message: aiMessages[id]?.message || '',
                    promptType: aiMessages[id]?.promptType || '',
                    metrics: aiMessageScores[id] || {}
                }
            }));
        }
    };

    const handleRationaleChange = (id, value) => {
        setRatings((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                rationale: value
            }
        }));
    };

    const handleFetchRepos = async () => {
        if (!token || !username) {
            setError("Please provide a valid GitHub token and username.");
            return;
        }

        try {
            const response = await getRepos(token);
            setRepos(response.data);
            setError(null);
        } catch (err) {
            setError(err.message);
            setRepos([]);
        }
    };

    const handleFetchCommits = async () => {
        if (!token || !selectedRepo) {
            setError("Please select a repository.");
            return;
        }

        try {
            const response = await getCommits(token, username, selectedRepo);
            setCommitData(response.data);
            setError(null);
        } catch (err) {
            setError(err.message);
            setCommitData([]);
        }
    };


    const handleSelectCommit = async (sha) => {
        setLoading(true);
        setLoadingLog("Loading... (This may take a while)")
        try {
            const response = await getCommitData(token, username, selectedRepo, sha)
            console.log(response)
            const additionalContext = await getPullRequestAndIssues(sha, token, username, selectedRepo);

            setSelectedCommit({
                ...response.data,
                ...additionalContext,
                commit_type: classifyCommitType(response.data.commit.message),
            });
            setAiMessages([])
            setAiMessageScores([])
            setRatings({})
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    const getAiMessage = async (input, retries = 3, delay = 5000) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    addToLoadingLog("Sending request to AI")
                    const data = await getDeepSeekResponse(input)
                    addToLoadingLog(`Message generated. Continuing...`)
                    return data
                } catch (err) {
                    addToLoadingLog(`Attempt ${attempt} failed: ${err.message}`)
                    console.log(`Attempt ${attempt} failed: ${err.message}`);

                    if (attempt < retries) {
                        addToLoadingLog(`Retrying...`)
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        return "error";
                    }
                }
            }
    }

    const addToLoadingLog = (newMessage) => {
        setLoadingLog(prevLog => prevLog + "\n\n" + newMessage);
    };


    const getValidCommitMessage = async (inputText, promptType, evaluate) => {
        addToLoadingLog(`Calling AI`)
        let response = await getAiMessage(inputText);
        if (response !== "error") {
            let finalResponse = checkIfValidCommit(response);
            if (evaluate) {
                const data = await fetch('evaluation_prompt.txt');
                const dataText = await data.text();
                const evaluationText = replaceEvaluation(dataText, response);
                addToLoadingLog(`Awaiting message evaluation from AI`)
                let response2 = await getAiMessage(evaluationText);
                finalResponse = chooseResponse(response, response2)
            }
            addToLoadingLog(`Calculated the commit message`);
            await handleFetchScores(finalResponse);
            setAiMessages(prevMessages => [...prevMessages, {
                message: finalResponse,
                promptType: promptType,
                usedEvaluate: evaluate,
                success: finalResponse !== "Could not generate a valid message"
            }]);

        }
    };

    const generateCommitMessage = async () => {
        setLoading(true);
        setRatings({})
        setSuccessfulSubmission(false)
        setLoadingLog("Loading... (This may take a while)")
        const fileDiffs = selectedCommit.files
            .map(file => `File: ${file.filename}\nStatus: ${file.status.toUpperCase()}\n${file.patch ? `\nDiff:\n${file.patch}` : ""}`)
            .join("\n\n");

        try {
            const prompts = await getPrompts()
            for (let index = 0; index < prompts.length; index++) {
                const prompt = prompts[index];
                addToLoadingLog(`Starting AI Generation with prompt ${index + 1}:`);
                const modifiedMessage = replacePlaceholders(prompt.message, fileDiffs, selectedCommit);
                await getValidCommitMessage(modifiedMessage, prompt.promptType, prompt.evaluate);
            }
            setLoading(false);
        } catch (error) {
            setLoadingLog("There was a problem trying to access the API. The API may be down, or your internet may be off. Please try again, maybe with a different commit.")
        }

    };

    const handleSubmitRatings = async () => {

        function encodePatch(patch) {
            return btoa(unescape(encodeURIComponent(patch)));
        }

        const completeRatings = {
            commit_id: selectedCommit?.sha || '',
            files: selectedCommit?.files?.map(({blob_url, contents_url, raw_url, patch, ...rest}) => ({
                ...rest,
                patch: patch ? encodePatch(patch) : null
            })) || [],
            pull_request_title: selectedCommit?.pull_request?.title || '',
            issue_report: selectedCommit?.issue_report?.title || '',
            commit_type: selectedCommit?.commit_type || '',
            original_message: selectedCommit?.commit?.message || '',
            ratings: [
                {
                    accuracy: ratings['original']?.accuracy || null,
                    integrity: ratings['original']?.integrity || null,
                    readability: ratings['original']?.readability || null,
                    applicability: ratings['original']?.applicability || null,
                    completeness: ratings['original']?.completeness || null,
                    rationale: ratings['original']?.rationale || '',
                    message: selectedCommit?.commit?.message || '',
                    prompt_type: 'original_message',
                    success: true,
                    used_evaluate: false,
                    metrics: []
                },
                ...aiMessages.map((messageObj, index) => ({
                    accuracy: ratings[index]?.accuracy || null,
                    integrity: ratings[index]?.integrity || null,
                    readability: ratings[index]?.readability || null,
                    applicability: ratings[index]?.applicability || null,
                    completeness: ratings[index]?.completeness || null,
                    rationale: ratings[index]?.rationale || '',
                    message: messageObj.message || '',
                    prompt_type: messageObj.promptType || '',
                    success: messageObj.success !== false,
                    used_evaluate: messageObj.usedEvaluate || false,
                    metrics: aiMessageScores[index] ? [aiMessageScores[index]] : []
                }))
            ]
        };

        console.log("Sending Data:", completeRatings);

        if (successfulSubmission) {
            try {
                await postSubmission(completeRatings);
                setSuccessfulSubmission(true);
                alert("Submission successful!");
            } catch (error) {
                console.error("Error submitting ratings:", error);
                alert("Failed to submit ratings. Please try again.");
            }
        } else {
            alert("You've already submitted these results.");
        }
    };

    const handleFetchScores = async (AI_message) => {
        addToLoadingLog(`Calculating metrics for the generated message`);
        const data = await getScores(selectedCommit.commit.message, AI_message);
        console.log(data)
        setAiMessageScores(prevScores => [
            ...prevScores,
            {
                bleuScore: data["BLEU Score"],
                meteorScore: data["METEOR Score"],
                rougeLScore: data["ROUGE-L Score"]
            }
        ]);
        addToLoadingLog(`Finished calculating metrics for the generated message`);
    };

    return (
        <div className="max-w-5xl mx-auto p-10 bg-gray-50 min-h-screen rounded-lg shadow-lg border border-gray-200">
            {showAiMessagesModal && aiMessages.length > 0 && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
                    <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">Rate the AI-Generated Commit Messages</h2>
                            <button
                                onClick={() => setShowAiMessagesModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                                     viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-4">
                            {/* Original Message Section */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <p className="mb-4">
                                    <strong>Original Commit Message:</strong> {selectedCommit.commit.message}
                                </p>

                                {/* Rating Characteristics for Original Message */}
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <p className="text-sm font-semibold">Accuracy (Is it correct?):</p>
                                        <div className="flex gap-2 mt-1">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <label key={value} className="flex items-center space-x-1">
                                                    <input
                                                        type="radio"
                                                        name="accuracy-original"
                                                        value={value}
                                                        checked={ratings['original']?.accuracy === value}
                                                        onChange={() => handleRatingChange('original', 'accuracy', value)}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold">Integrity (Does it say what changed and why?):</p>
                                        <div className="flex gap-2 mt-1">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <label key={value} className="flex items-center space-x-1">
                                                    <input
                                                        type="radio"
                                                        name="integrity-original"
                                                        value={value}
                                                        checked={ratings['original']?.integrity === value}
                                                        onChange={() => handleRatingChange('original', 'integrity', value)}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold">Readability (Is it clear and gramatically accurate?):</p>
                                        <div className="flex gap-2 mt-1">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <label key={value} className="flex items-center space-x-1">
                                                    <input
                                                        type="radio"
                                                        name="readability-original"
                                                        value={value}
                                                        checked={ratings['original']?.readability === value}
                                                        onChange={() => handleRatingChange('original', 'readability', value)}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold">Applicability (Would you use it?):</p>
                                        <div className="flex gap-2 mt-1">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <label key={value} className="flex items-center space-x-1">
                                                    <input
                                                        type="radio"
                                                        name="applicability-original"
                                                        value={value}
                                                        checked={ratings['original']?.applicability === value}
                                                        onChange={() => handleRatingChange('original', 'applicability', value)}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold">Completeness (Does it cover the entire change?):</p>
                                        <div className="flex gap-2 mt-1">
                                            {[1, 2, 3, 4, 5].map((value) => (
                                                <label key={value} className="flex items-center space-x-1">
                                                    <input
                                                        type="radio"
                                                        name="completeness-original"
                                                        value={value}
                                                        checked={ratings['original']?.completeness === value}
                                                        onChange={() => handleRatingChange('original', 'completeness', value)}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Rationale:</label>
                                        <textarea
                                            value={ratings['original']?.rationale || ''}
                                            onChange={(e) => handleRationaleChange('original', e.target.value)}
                                            className="w-full p-2 border rounded"
                                            rows="2"
                                            placeholder="Any additional comments about your ratings..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* AI Messages Section */}
                            {shuffledMessages.map(({message, index, promptType}, shuffledIndex) => {
                                const messageObj = aiMessages[index];
                                const isSuccessful = messageObj?.success !== false;

                                return (
                                    <div key={shuffledIndex} className="mb-6 p-4 bg-gray-50 rounded-lg">
                                        <p className="mb-4">
                                            <strong>Commit Message {shuffledIndex + 1}:</strong> {message}
                                            <br />
                                        </p>

                                        {/* Rating Characteristics for AI Message */}
                                        <div className="space-y-4 mt-4">
                                            <div>
                                                <p className="text-sm font-semibold">Accuracy (Is it correct?):</p>
                                                <div className="flex gap-2 mt-1">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <label key={value} className="flex items-center space-x-1">
                                                            <input
                                                                type="radio"
                                                                name={`accuracy-${index}`}
                                                                value={value}
                                                                checked={ratings[index]?.accuracy === value}
                                                                onChange={() => handleRatingChange(index, 'accuracy', value)}
                                                                className="form-radio text-blue-600"
                                                                disabled={!isSuccessful}
                                                            />
                                                            <span className={!isSuccessful ? "text-gray-400" : ""}>{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-sm font-semibold">Integrity (Does it say what changed and why?):</p>
                                                <div className="flex gap-2 mt-1">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <label key={value} className="flex items-center space-x-1">
                                                            <input
                                                                type="radio"
                                                                name={`integrity-${index}`}
                                                                value={value}
                                                                checked={ratings[index]?.integrity === value}
                                                                onChange={() => handleRatingChange(index, 'integrity', value)}
                                                                className="form-radio text-blue-600"
                                                                disabled={!isSuccessful}
                                                            />
                                                            <span className={!isSuccessful ? "text-gray-400" : ""}>{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-sm font-semibold">Readability (Is it clear and gramatically accurate?):</p>
                                                <div className="flex gap-2 mt-1">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <label key={value} className="flex items-center space-x-1">
                                                            <input
                                                                type="radio"
                                                                name={`readability-${index}`}
                                                                value={value}
                                                                checked={ratings[index]?.readability === value}
                                                                onChange={() => handleRatingChange(index, 'readability', value)}
                                                                className="form-radio text-blue-600"
                                                                disabled={!isSuccessful}
                                                            />
                                                            <span className={!isSuccessful ? "text-gray-400" : ""}>{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-sm font-semibold">Applicability (Would you use it?):</p>
                                                <div className="flex gap-2 mt-1">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <label key={value} className="flex items-center space-x-1">
                                                            <input
                                                                type="radio"
                                                                name={`applicability-${index}`}
                                                                value={value}
                                                                checked={ratings[index]?.applicability === value}
                                                                onChange={() => handleRatingChange(index, 'applicability', value)}
                                                                className="form-radio text-blue-600"
                                                                disabled={!isSuccessful}
                                                            />
                                                            <span className={!isSuccessful ? "text-gray-400" : ""}>{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-sm font-semibold">Completeness (Does it cover the entire change?):</p>
                                                <div className="flex gap-2 mt-1">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <label key={value} className="flex items-center space-x-1">
                                                            <input
                                                                type="radio"
                                                                name={`completeness-${index}`}
                                                                value={value}
                                                                checked={ratings[index]?.completeness === value}
                                                                onChange={() => handleRatingChange(index, 'completeness', value)}
                                                                className="form-radio text-blue-600"
                                                                disabled={!isSuccessful}
                                                            />
                                                            <span className={!isSuccessful ? "text-gray-400" : ""}>{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold mb-1">Rationale (optional):</label>
                                                <textarea
                                                    value={ratings[index]?.rationale || ''}
                                                    onChange={(e) => handleRationaleChange(index, e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                    rows="2"
                                                    placeholder="Any additional comments about your ratings..."
                                                    disabled={!isSuccessful}
                                                />
                                            </div>
                                        </div>

                                        {!isSuccessful && (
                                            <p className="text-sm text-gray-500 mt-2">
                                                Rating disabled - AI couldn't generate a valid message for this prompt
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setShowAiMessagesModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleSubmitRatings}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Submit Ratings
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {!consentGiven && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80">
                    <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg max-h-[90vh] flex flex-col">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                            BELMONT UNIVERSITY RESEARCH CONSENT
                        </h2>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2 text-center">
                            USING LARGE LANGUAGE MODELS (LLMS) TO ANALYZE GIT COMMITS
                        </h3>
                        <p className="text-gray-700 mb-4 text-center">
                            Please click accept at the bottom to confirm your consent to participate in the research.
                        </p>
                        <div className="flex-1 overflow-y-scroll pr-4">
                            <p className="text-gray-700 mb-4">
                                You are invited to participate in a research study on the use of Large Language Models
                                (LLMs) in the
                                creation and visualization of commit messages for source code commits in GitHub.
                            </p>
                            <p className="text-gray-700 mb-4">
                                You may participate in this study if you are at least 18 years old, own a GitHub
                                account,
                                and have made
                                commit messages to at least one project on GitHub. If you agree to participate, you will
                                be
                                asked to use
                                our research tool, which will use AI to analyze your GitHub commits. You will also be
                                asked
                                to rate
                                the AI-generated messages.
                            </p>
                            <p className="text-gray-700 mb-4">
                                The benefit of this research is to contribute to the body of knowledge regarding the use
                                of
                                LLMs
                                in software engineering and programming.
                            </p>
                            <p className="text-gray-700 mb-4">
                                There are no physical risks and no risks beyond daily stressors. If you have any
                                questions
                                or concerns
                                about the study, please contact us using the information provided below.
                            </p>
                            <p className="text-gray-700 mb-4">
                                Participation in this study is voluntary. You may choose to withdraw at any time.
                            </p>
                            <p className="text-gray-700 mb-4">
                                We will protect the confidentiality of your research records by not collecting
                                identifiable
                                information
                                such as your name, GitHub username, or authentication token. GitHub commit data will be
                                stored for
                                evaluation but will not be linked back to you. Data will be securely stored on the
                                investigators’ and/or
                                faculty advisor’s password-protected computers.
                            </p>
                            <p className="text-gray-700 mb-4">
                                Collected information may be shared with other researchers involved in this project.
                                However, we will
                                not share any identifiable information outside the research team. If the results of this
                                study are
                                published or presented, personal details will not be included.
                            </p>
                            <p className="text-gray-700 mb-4">
                                If you have any questions about this research, please contact:<br/>
                                <strong>Dr. Esteban Parra Rodriguez</strong> – <a
                                href="mailto:esteban.parrarodriguez@belmont.edu" className="text-blue-600 underline">
                                esteban.parrarodriguez@belmont.edu
                            </a>
                            </p>
                                <p className="text-gray-700 mb-4">
                                    Or:<br/>
                                    <strong>Yousab Grees (Researcher)</strong> – <a
                                    href="mailto:yousab.grees@bruins.belmont.edu" className="text-blue-600 underline">
                                    yousab.grees@bruins.belmont.edu
                                </a>
                                </p>
                            <p className="text-gray-700 mb-4">
                                If you have concerns about your rights as a research participant, please contact:<br/>
                                <strong>Erich Baker, Ph.D.</strong>, Vice Provost for Research and Strategy
                                Initiatives<br/>
                                <a href="mailto:erich.baker@belmont.edu"
                                   className="text-blue-600 underline">erich.baker@belmont.edu</a> | (615) 460-5867
                            </p>
                            <div
                                className="flex justify-center gap-4 mt-4">
                                <button
                                    onClick={() => setConsentGiven(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md"
                                >
                                    Accept
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto p-10 bg-gray-50 min-h-screen rounded-lg shadow-lg border border-gray-200">
                <h1 className="text-4xl font-bold text-center text-gray-900 mb-6">AI-Powered Commit Explorer</h1>
                <p className="text-center text-lg text-gray-600 mb-8">A research tool to analyze commit messages and
                    enhance
                    developer workflow using AI.</p>

                <div className="text-center text-gray-700 mb-6">
                    <p><strong>Researcher:</strong> Yousab Grees</p>
                    <p><strong>Advisor:</strong> Dr. Esteban Parra Rodriguez</p>
                    <p><strong>University:</strong> Belmont University</p>
                </div>

                {error && <p className="text-red-500 text-center text-lg mb-6">Error: {error}</p>}

                {commitData.length < 1 && repos.length < 1 && (
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 rounded-lg shadow-md text-white">
                        <h2 className="text-2xl font-semibold mb-4">Enter GitHub Credentials</h2>
                        <input type="text" placeholder="GitHub Token" value={token}
                               onChange={(e) => setToken(e.target.value)}
                               className="w-full p-3 mb-4 rounded-lg text-gray-900"/>
                        <input type="text" placeholder="GitHub Username" value={username}
                               onChange={(e) => setUsername(e.target.value)}
                               className="w-full p-3 mb-4 rounded-lg text-gray-900"/>
                        <button onClick={handleFetchRepos}
                                className="w-full p-3 bg-white text-blue-600 font-bold rounded-lg shadow-md hover:bg-gray-200 transition-all">Fetch
                            Repositories
                        </button>
                    </div>
                )}

                {repos.length > 0 && (
                    <div className="mt-6 bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Select Repository</h2>

                        <div className="relative">
                            <Listbox value={selectedRepo} onChange={setSelectedRepo}>
                                <Listbox.Button
                                    className="w-full p-3 border border-gray-300 rounded-xl text-gray-900 bg-white
                 flex justify-between items-center shadow-sm focus:ring-2
                 focus:ring-blue-500 transition-all"
                                >
                                    {selectedRepo || "Select a Repository"}
                                    <ChevronDownIcon className="w-5 h-5 text-gray-600"/> {/* Dropdown icon */}
                                </Listbox.Button>

                                <Listbox.Options
                                    className="absolute w-full mt-2 bg-white border border-gray-300
                 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto transition-all
                 transform scale-95 origin-top opacity-0 data-[headlessui-state=open]:opacity-100
                 data-[headlessui-state=open]:scale-100"
                                >
                                    {repos.map((repo) => (
                                        <Listbox.Option
                                            key={repo.id}
                                            value={repo.name}
                                            className="p-3 flex justify-between items-center hover:bg-blue-100
                     cursor-pointer transition-all"
                                        >
                                            {repo.name}
                                            {selectedRepo === repo.name &&
                                                <CheckIcon className="w-5 h-5 text-blue-600"/>} {/* Checkmark */}
                                        </Listbox.Option>
                                    ))}
                                </Listbox.Options>
                            </Listbox>
                        </div>
                        <button
                            onClick={handleFetchCommits}
                            className="w-full mt-4 p-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 transition-all"
                        >
                            Fetch Commits
                        </button>
                    </div>
                )}

                {commitData.length > 0 && (
                    <div className="mt-10 p-6 bg-white rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-4 text-gray-900">Commit Timeline</h2>
                        <div className="relative overflow-x-auto flex items-center">
                            <div
                                className="absolute left-20 h-1 bg-gray-300 top-1/2 transform -translate-y-1/2"
                                style={{width: `${(commitData.length - 1) * 160}px`}}
                            ></div>
                            <div className="flex items-center py-4" style={{minWidth: `${commitData.length * 160}px`}}>
                                {commitData.map((commit) => (
                                    <div key={commit.sha} className="relative flex-shrink-0 w-40">
                                        <div
                                            onClick={() => handleSelectCommit(commit.sha)}
                                            className="cursor-pointer w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold hover:scale-110 transition-all"
                                        >
                                            <span className="text-lg">{commit.sha.slice(0, 6)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="mt-10 p-6 bg-gray-100 rounded-lg shadow-lg mx-auto w-full max-w-4xl text-center">
                        {loadingLog.split('\n\n').map((line, i) => (
                            <p key={i} className="text-gray-700 text-lg">{line}</p>
                        ))}
                    </div>
                ) : (
                    selectedCommit && (
                        <div className="mt-10 p-6 bg-gray-100 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Commit Details</h2>
                            <p><strong>Commit ID:</strong> {selectedCommit.sha}</p>
                            <p><strong>Message:</strong> {selectedCommit.commit.message}</p>
                            <p><strong>Author:</strong> {selectedCommit.commit.author.name}</p>
                            <p><strong>Date:</strong> {selectedCommit.commit.author.date}</p>
                            <div className="mt-8 flex flex-col gap-2 w-64">
                                <button
                                    onClick={() => setShowDiffs(!showDiffs)}
                                    className="w-full p-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all"
                                >
                                    {showDiffs ? "Hide Commit Differences" : "Show Commit Differences"}
                                </button>

                                {aiMessages && aiMessages.length > 0 ? (
                                    <button
                                        onClick={() => setShowAiMessagesModal(true)}
                                        className="w-full p-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-all mb-4"
                                    >
                                        View AI-Generated Messages
                                    </button>
                                ) : (
                                    <button
                                        onClick={generateCommitMessage}
                                        className="w-full p-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all"
                                    >
                                        Generate Commit Message
                                    </button>
                                )}
                            </div>

                            {showDiffs && (
                                <div>
                                    <h3 className="text-xl font-bold mt-6">Changed Files:</h3>
                                    {selectedCommit.files && selectedCommit.files.map((file, index) => (
                                        <div key={index} className="mt-2 p-4 bg-white rounded-lg shadow-md">
                                            <p><strong>File:</strong> {file.filename}</p>
                                            <p><strong>Status:</strong> {file.status}</p>
                                            <pre className="bg-gray-200 p-4 text-sm overflow-x-auto">{file.patch}</pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}