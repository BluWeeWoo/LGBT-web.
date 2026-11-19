// This flag records entry through RYE's demo form. The hosting platform
// supplies the verified identity used for every persistent story write.
export const demoCookie = "rye_demo_login";

export function isReviewLogin(headers: Pick<Headers, "get">) {
  return (headers.get("cookie") || "").split(";").some(part => part.trim() === demoCookie + "=review");
}

function hasDemoLogin(headers: Pick<Headers, "get">) {
  return isReviewLogin(headers) || (headers.get("cookie") || "").split(";").some(part => part.trim() === demoCookie + "=1");
}

export function storySession(headers: Pick<Headers, "get">) {
  return {
    loggedIn: hasDemoLogin(headers),
    platformSignedIn: Boolean(headers.get("oai-authenticated-user-id")),
  };
}

export type StorySession = ReturnType<typeof storySession> & { canReview?: boolean; canShare?: boolean };

export function storyAuthor(headers: Headers) {
  return hasDemoLogin(headers) ? headers.get("oai-authenticated-user-id") : null;
}
