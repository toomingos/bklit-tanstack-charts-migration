/** TanStack's mark / definition / renderer generics are invariant in the datum and scale types, which these builders erase;
 * every unchecked boundary cast goes through here. */
export function erase(value: unknown): never {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion -- the one erasure point, justified above
  return value as never;
}
