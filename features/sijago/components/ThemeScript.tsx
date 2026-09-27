/**
 * ThemeScript - Initializes theme from localStorage before React hydration
 * This prevents the flash of wrong theme on page load.
 *
 * Must be a Server Component: in Next.js / React 19, <script> tags rendered
 * by Client Components are inert on the client. Rendering it from the server
 * inlines the snippet into the SSR HTML so the browser executes it before
 * hydration.
 */
export default function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        const stored = localStorage.getItem('deeptutor-theme');

        document.documentElement.classList.remove('dark', 'theme-glass', 'theme-snow');

        if (stored === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (stored === 'glass') {
          document.documentElement.classList.add('dark', 'theme-glass');
        } else if (stored === 'snow') {
          document.documentElement.classList.add('theme-snow');
        } else if (stored === 'light') {
          // already clean
        } else {
          // No stored preference: open the light "snow" canvas.
          //
          // This used to follow prefers-color-scheme and pick Dark on a dark OS.
          // That is wrong here, because AI Mastery is framed inside Careevo, whose
          // own chrome is always light: the workspace would open warm-black
          // under a white navbar — reintroducing exactly the mismatch the
          // light-mode repaint removed. The frame has to match its host, so the
          // default is light regardless of the OS.
          //
          // Dark and Glass are untouched and still fully available in
          // Settings -> Appearance; they are opt-in now, not the default.
          document.documentElement.classList.add('theme-snow');
          localStorage.setItem('deeptutor-theme', 'snow');
        }
      } catch (e) {
        /* localStorage may be disabled */
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
