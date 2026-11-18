import type { AnalysisResult, SummaryLength } from "./types";

export class ApiError extends Error {}

async function parse(response: Response): Promise<AnalysisResult> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Something went wrong (HTTP ${response.status}).`;
    throw new ApiError(message);
  }
  return body as AnalysisResult;
}

export async function analyzeText(
  text: string,
  length: SummaryLength,
  title = "",
): Promise<AnalysisResult> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, length, title }),
    });
    return await parse(response);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function analyzeFile(file: File, length: SummaryLength): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("length", length);
  try {
    const response = await fetch("/api/analyze", { method: "POST", body: form });
    return await parse(response);
  } catch (err) {
    throw toApiError(err);
  }
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError("Couldn't reach the StudySpark server. Check your connection and try again.");
}
