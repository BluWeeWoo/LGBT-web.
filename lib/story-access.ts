// This flag records entry through RYE's demo form. The hosting platform
// supplies the verified identity used for every persistent story write.
export const demoCookie = "rye_demo_login";

function hasDemoLogin(headers: Pick<Headers, "get">) {
  return (headers.get("cookie") || "").split(";").some(part => part.trim() === demoCookie + "=1");
}

export function storySession(headers: Pick<Headers, "get">) {
  return {
    loggedIn: hasDemoLogin(headers),
    platformSignedIn: Boolean(headers.get("oai-authenticated-user-id")),
  };
}

export type StorySession = ReturnType<typeof storySession>;

export function storyAuthor(headers: Headers) {
  return hasDemoLogin(headers) ? headers.get("oai-authenticated-user-id") : null;
}
