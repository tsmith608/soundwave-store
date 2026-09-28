"use client";

import Script from "next/script";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const CONSENT_KEY = "sw_consent";

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Loads GA4 / Meta Pixel / TikTok Pixel only when their public IDs are set.
 * Google Consent Mode v2 defaults to denied for ad signals until the visitor
 * accepts; analytics_storage defaults to granted for US traffic. Meta and
 * TikTok pixels load only after consent. The first-party /api/events log
 * runs regardless (no cookies, no third parties).
 */
export default function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const anyPixel = Boolean(GA4 || META || TIKTOK);

  useEffect(() => setConsent(readConsent()), []);

  useEffect(() => {
    if (pathname === "/" || pathname?.startsWith("/wedding") || pathname?.startsWith("/voicemail") || pathname?.startsWith("/anniversary") || pathname?.startsWith("/pet-memorial") || pathname?.startsWith("/designs")) {
      track("landing_view", { page: pathname, source: typeof document !== "undefined" ? document.referrer : undefined });
    }
  }, [pathname]);

  const decide = (v: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, v);
    } catch {}
    setConsent(v);
    window.gtag?.("consent", "update", { ad_storage: v, ad_user_data: v, ad_personalization: v });
  };

  return (
    <>
      {GA4 && (
        <>
          <Script id="ga4-consent" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
var c=null;try{c=localStorage.getItem('${CONSENT_KEY}')}catch(e){}
gtag('consent','default',{analytics_storage:'granted',ad_storage:c==='granted'?'granted':'denied',ad_user_data:c==='granted'?'granted':'denied',ad_personalization:c==='granted'?'granted':'denied'});
gtag('js',new Date());gtag('config','${GA4}');`}</Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`} strategy="afterInteractive" />
        </>
      )}
      {META && consent === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META}');fbq('track','PageView');`}</Script>
      )}
      {TIKTOK && consent === "granted" && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${TIKTOK}');ttq.page();}(window, document, 'ttq');`}</Script>
      )}
      {anyPixel && consent === null && (
        <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-white border border-[#E6DFD6] shadow-lg rounded-md p-4 text-sm text-[#4A453F]">
          <p className="mb-3">We use cookies to measure which videos and ads bring people here. Nothing is shared until you say yes.</p>
          <div className="flex gap-2">
            <button onClick={() => decide("granted")} className="px-3 py-1.5 rounded bg-[#2D2A26] text-white">
              Accept
            </button>
            <button onClick={() => decide("denied")} className="px-3 py-1.5 rounded border border-[#DDD5CB]">
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}
