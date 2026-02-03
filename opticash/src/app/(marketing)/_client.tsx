"use client";

import { useEffect } from "react";

export default function MarketingClientMarker() {
  useEffect(() => {
    // No-op to keep a client boundary for this segment.
  }, []);

  return <span data-client-marker style={{ display: "none" }} />;
}
