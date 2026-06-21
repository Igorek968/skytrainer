"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type WhenInViewportProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Подгрузить чуть раньше появления в viewport, например «200px». */
  rootMargin?: string;
  className?: string;
};

/** Рендерит children только когда блок попадает (или близок) к viewport. */
export function WhenInViewport({
  children,
  fallback = null,
  rootMargin = "200px",
  className,
}: WhenInViewportProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : fallback}
    </div>
  );
}
