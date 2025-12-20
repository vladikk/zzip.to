function handler(event) {
    // Extract the request URI
    var uri = event.request.uri;

    // ==================== VALIDATION RULES ====================

    // 1. Check path length (max 256 characters)
    if (uri.length > 256) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // 2. Check for invalid patterns
    // Contains ".."
    if (uri.indexOf("..") !== -1) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // Contains "//"
    if (uri.indexOf("//") !== -1) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // Contains "%2F" or "%2f" (encoded forward slash, case-insensitive)
    if (uri.indexOf("%2F") !== -1 || uri.indexOf("%2f") !== -1) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // 3. Check allowed characters: ONLY A-Z, a-z, 0-9, _, -, / allowed
    var allowedCharsRegex = /^[A-Za-z0-9_\-\/]+$/;
    if (!allowedCharsRegex.test(uri)) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // ==================== PATH PARSING ====================

    // Remove leading "/" if present
    var path = uri;
    if (path.charAt(0) === "/") {
        path = path.substring(1);
    }

    // Split by "/" to get segments
    var segments = path.split("/");

    // First segment = key
    var key = segments[0];

    // Remaining segments joined with "/" = rest
    var rest = "";
    if (segments.length > 1) {
        rest = segments.slice(1).join("/");
    }

    // ==================== KVS LOOKUP ====================

    // Lookup the key in KeyValueStore
    var target = event.context.kvs.get(key);

    // If key not found, return 404
    if (target === null) {
        return {
            statusCode: 404,
            statusDescription: "Not Found",
            headers: {
                "content-type": { value: "text/plain" }
            },
            body: "Not Found"
        };
    }

    // ==================== BUILD REDIRECT URL ====================

    var finalUrl;

    // Check if target ends with "/*" (wildcard redirect)
    if (target.length >= 2 && target.substring(target.length - 2) === "/*") {
        // Wildcard redirect: remove "/*" and append "/" + rest
        finalUrl = target.slice(0, -2) + "/" + rest;
    } else {
        // Exact redirect: don't allow extra path
        if (rest !== "") {
            return {
                statusCode: 404,
                statusDescription: "Not Found",
                headers: {
                    "content-type": { value: "text/plain" }
                },
                body: "Not Found"
            };
        }
        // Use target as-is
        finalUrl = target;
    }

    // ==================== APPEND QUERY STRING ====================

    var queryParams = event.request.querystring;
    var queryString = "";
    if (queryParams) {
        var params = [];
        for (var param in queryParams) {
            params.push(param + "=" + queryParams[param].value);
        }
        if (params.length > 0) {
            queryString = "?" + params.join("&");
        }
    }

    // Append query string to final URL if present
    if (queryString !== "") {
        finalUrl = finalUrl + queryString;
    }

    // ==================== RETURN REDIRECT RESPONSE ====================

    return {
        statusCode: 301,
        statusDescription: "Moved Permanently",
        headers: {
            location: { value: finalUrl }
        }
    };
}
