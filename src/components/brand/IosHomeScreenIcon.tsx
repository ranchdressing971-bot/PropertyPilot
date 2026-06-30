/**
 * Explicit apple-touch-icon in HTML (required for iOS 18 Liquid Glass / adaptive icons).
 * Must be transparent — iOS supplies the light/dark/tinted background automatically.
 */
export function IosHomeScreenIcon() {
  return (
    <>
      <link
        rel="apple-touch-icon"
        href="/icons/ios/apple-touch-icon-180-transparent.png"
        sizes="180x180"
      />
      <link
        rel="apple-touch-icon-precomposed"
        href="/icons/ios/apple-touch-icon-180-transparent.png"
      />
    </>
  );
}
