// Stub declarations for types referenced by third-party library declarations
// that are not available in a browser-targeted project.

// @better-fetch/fetch uses `Timer` (Node.js / Bun timeout handle type)
type Timer = ReturnType<typeof setTimeout>;
