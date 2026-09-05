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
        <meta name="theme-color" content="#FBF8F3" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0D0F0E" media="(prefers-color-scheme: dark)" />
        <meta
          name="description"
          content="Your society's community hub — home food, services, and more from your neighbours."
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />

        {/* Warm up the Supabase connection early so the first data fetch is faster. */}
        {process.env.EXPO_PUBLIC_SUPABASE_URL ? (
          <>
            <link rel="preconnect" href={process.env.EXPO_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.EXPO_PUBLIC_SUPABASE_URL} />
          </>
        ) : null}

        {/* Disable body scrolling on web so ScrollViews behave like native. */}
        <ScrollViewStyleReset />
        {/*
          The shell must be exactly as tall as what the browser is showing.

          ScrollViewStyleReset sizes html/body/#root with `height: 100%`, which
          on iOS Safari resolves against a viewport that is not always the one
          you can see: with the address bar and toolbar drawn, the percentage
          can settle on a box shorter than the visible page, and the whole app
          — the floating tab bar included — is laid out inside it. What you get
          is a bar sitting well above the bottom of the screen with a dead
          strip of background beneath it.

          `100dvh` is the *dynamic* viewport: the area actually on screen right
          now, whatever the browser chrome is doing. Because body scrolling is
          off above, iOS never collapses its toolbars here, so this value does
          not thrash mid-scroll the way dvh can on an ordinary page. `100%`
          stays as the fallback for anything older than Safari 15.4.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: '@supports (height: 100dvh) { html, body, #root { height: 100dvh; } }',
          }}
        />
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
