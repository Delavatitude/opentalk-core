export const CONTEXTS = ["general"];
export function contextsFor(type) {
  const configured = Array.isArray(type.contexts) ? type.contexts.filter(Boolean) : [];
  return configured.length ? configured : ["general"];
}
