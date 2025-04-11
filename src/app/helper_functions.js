export const classifyCommitType = (message) => {
    if (/fix|bug/i.test(message)) return "Bug Fix";
    if (/add|feature/i.test(message)) return "Feature Addition";
    if (/refactor/i.test(message)) return "Refactor";
    if (/style|format/i.test(message)) return "Style Change";
    return "General Change";
};

export const replacePlaceholders = (message, fileDiffs, selectedCommit) => {
    return message
        .replace('[DIFF]', fileDiffs)
        .replace('[PR]', selectedCommit.pull_request?.title || 'None')
        .replace('[IR]', selectedCommit.issue_report?.title || 'None')
        .replace('[CT]', selectedCommit.commit_type || 'Unknown');
};

export const replaceEvaluation = (message, response) => {
    return message.replace('[MESSAGE]', response);
}

export const checkIfValidCommit = (response) => {
    if (response !== "error" && response.length < 200) {
        return response;
    } else {
        return "Could not generate a valid message"
    }
}
export const chooseResponse = (response, response2) => {
    let finalResponse;

    if (
        (response === "error" && response2 === "error") ||
        (response.length > 200 && response2.length > 200)
    ) {
        finalResponse = "Could not generate a valid message";
    } else if (
        response2 === "error" || response2.length > 200
    ) {
        finalResponse = response;
    } else if (
        response === "error" || response.length > 200
    ) {
        finalResponse = response2;
    } else {
        if (response.length > 72 || response2.length > 72) {
            finalResponse = response.length > 72 ? response2 : response;
        } else {
            finalResponse = response.length >= response2.length ? response : response2;
        }
    }
    return finalResponse;
}