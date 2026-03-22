import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/\//g, "/");

function getSessionId(): string {
  let id = sessionStorage.getItem("_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_sid", id);
  }
  return id;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.slice(0, max);
}

function getElementText(el: Element): string | null {
  const text = (el as HTMLElement).innerText?.trim() || el.getAttribute("aria-label") || el.getAttribute("title");
  return truncate(text || null, 100);
}

export function useClickTracker() {
  const [location] = useLocation();
  const locationRef = useRef(location);
  const queueRef = useRef<object[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    const sessionId = getSessionId();

    function flush() {
      const events = queueRef.current.splice(0);
      if (!events.length) return;
      customFetch(`${BASE}/logs/events`, {
        method: "POST",
        body: JSON.stringify(events),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }

    function scheduleFlush() {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flush();
      }, 3000);
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;

      const el = target.closest("button, a, [role='button'], [role='tab'], [role='menuitem'], input[type='submit'], select") ?? target;

      const event = {
        sessionId,
        eventType: "click",
        elementTag: el.tagName?.toLowerCase() ?? null,
        elementText: getElementText(el),
        elementId: truncate(el.id || null, 128),
        elementClass: truncate(el.className && typeof el.className === "string" ? el.className : null, 200),
        page: locationRef.current,
        metadata: {
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
          href: (el as HTMLAnchorElement).href || null,
        },
      };

      queueRef.current.push(event);
      scheduleFlush();
    }

    document.addEventListener("click", handleClick, { capture: true, passive: true });

    const intervalId = setInterval(flush, 10000);

    window.addEventListener("beforeunload", flush);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      clearInterval(intervalId);
      window.removeEventListener("beforeunload", flush);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flush();
    };
  }, []);
}
