import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Root HTML document for the static web export (PWA shell).
// This file is web-only; it has no effect on native.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA / installability */}
        <meta name="application-name" content="Aangan" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aangan" />
        {/* theme-color follows the system scheme so the browser chrome blends in */}
        <meta name="theme-color" content="#F7F7F5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0E0F12" media="(prefers-color-scheme: dark)" />
        <meta
          name="description"
          content="Your society's community hub — home food, services, and more from your neighbours."
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />

        {/* Disable body scrolling on web so ScrollViews behave like native. */}
        <ScrollViewStyleReset />
        {/* Apply saved theme before React mounts to avoid a flash of wrong color. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('senate_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        {/* Register the offline service worker (web only). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});}",
          }}
        />
      </body>
    </html>
  );
}
