"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.2 });

function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPath = useRef(pathname + searchParams.toString());

  useEffect(() => {
    const current = pathname + searchParams.toString();
    if (current !== prevPath.current) {
      NProgress.start();
      prevPath.current = current;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleComplete = () => NProgress.done();
    window.addEventListener("routechange-start", handleComplete);
    window.addEventListener("popstate", handleComplete);

    const observer = new MutationObserver(() => {
      if (document.readyState === "complete") {
        NProgress.done();
      }
    });
    observer.observe(document, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("routechange-start", handleComplete);
      window.removeEventListener("popstate", handleComplete);
      observer.disconnect();
    };
  }, []);

  return null;
}

export function RouteProgress() {
  return (
    <>
      <Suspense fallback={null}>
        <RouteProgressInner />
      </Suspense>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #nprogress .bar {
              background: hsl(262, 83%, 58%);
              height: 2px;
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              z-index: 9999;
            }
            #nprogress .peg {
              box-shadow: 0 0 10px hsl(262, 83%, 58%), 0 0 5px hsl(262, 83%, 58%);
            }
            #nprogress .spinner {
              display: none !important;
            }
          `,
        }}
      />
    </>
  );
}
