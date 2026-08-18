// Safely read a fetch Response as JSON. When the backend is unreachable or
// returns a non-JSON body (e.g. an HTML error/redirect/timeout page), the native
// Response.json() throws a cryptic, browser-specific SyntaxError — on iOS Safari
// "The string did not match the expected pattern." Reading the body as text
// first lets us surface an actionable message instead.
export async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `The server returned an unexpected response (HTTP ${res.status}). The API may be unavailable — please try again.`
    );
  }
}
