"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { clientEnv } from "@/lib/env";
import { trackMetaEvent } from "@/lib/meta/pixel";

export function MetaPixel() {
  const pathname = usePathname();
  const trackedPath = useRef<string | null>(null);
  const pixelId = clientEnv.NEXT_PUBLIC_META_PIXEL_ID;

  useEffect(() => {
    if (pathname !== "/lp" || trackedPath.current === pathname) return;
    trackedPath.current = pathname;
    trackMetaEvent("ViewContent", { content_name: "GTA VI Creator Landing Page", content_category: "landing_page" });
  }, [pathname]);

  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
    </Script>
  );
}
