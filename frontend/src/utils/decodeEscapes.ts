// Some trace bodies are double-escaped (an embedded doc JSON-escaped a second time),
// so after JSON.parse they still contain literal \n, \uXXXX, escaped spaces, and YAML
// line-continuation backslashes. Decode those recognized sequences for display only;
// lone backslashes and real newlines are left untouched.
const ESCAPE_PATTERN =
  /\\(?:\r?\n[ \t]*| |U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[ntr"'/\\bf])/g;

const SIMPLE: Record<string, string> = {
  " ": " ",
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "'": "'",
  "/": "/",
  "\\": "\\",
};

export function decodeTraceEscapes(text: string): string {
  if (!text || !text.includes("\\")) {
    return text;
  }
  return text.replace(ESCAPE_PATTERN, (match) => {
    const body = match.slice(1);
    // YAML line continuation: backslash + newline (+ indent) folds away.
    if (body === "" || /^\r?\n[ \t]*$/.test(body)) {
      return "";
    }
    if (body[0] === "U") {
      return String.fromCodePoint(parseInt(body.slice(1), 16));
    }
    if (body[0] === "u" || body[0] === "x") {
      return String.fromCharCode(parseInt(body.slice(1), 16));
    }
    return SIMPLE[body] ?? match;
  });
}

// Pictographs plus their skin-tone modifiers, ZWJ, variation selector, keycap, and
// regional-indicator flag halves, so composed emoji are removed without leftovers.
const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3]/gu;

export function stripEmoji(text: string): string {
  if (!text) {
    return text;
  }
  // Collapse the space left on either side of a removed emoji to avoid double gaps.
  return text.replace(new RegExp(` *(?:${EMOJI_PATTERN.source})+ *`, "gu"), (m) =>
    m.startsWith(" ") && m.endsWith(" ") ? " " : "",
  );
}
