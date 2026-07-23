"use client";

import { resolveYandexMapsApiKey } from "@/lib/yandex-api-key";

/** Минимальные типы Яндекс.Карт 2.1 (без @types/yandex-maps). */
export type YmapsNamespace = {
  ready: (cb: () => void) => void;
  Map: new (
    element: HTMLElement | string,
    state: {
      center: number[];
      zoom: number;
      controls?: string[];
      /** Схема Яндекс.Карт (как на yandex.ru/maps). */
      type?: "yandex#map" | "yandex#satellite" | "yandex#hybrid";
    },
    options?: Record<string, unknown>,
  ) => YmapsMap;
  Placemark: new (
    coords: number[],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsGeoObject;
  Circle: new (
    geometry: [number[], number] | number[][],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsGeoObject;
  GeoObjectCollection: new () => YmapsCollection;
  templateLayoutFactory: {
    createClass: (
      template: string,
      overrides?: Record<string, unknown>,
    ) => YmapsLayoutClass;
  };
  shape: {
    Rectangle: new (geometry: unknown) => unknown;
  };
  geometry: {
    pixel: {
      Rectangle: new (coordinates: number[][]) => unknown;
    };
  };
  geocode: (
    query: string | number[],
    options?: { results?: number; kind?: string },
  ) => Promise<YmapsGeocodeResult>;
};

export type YmapsMap = {
  geoObjects: YmapsCollection;
  events: { add: (type: string, cb: (e: YmapsEvent) => void) => void };
  behaviors: { disable: (name: string) => void; enable: (name: string) => void };
  setCenter: (center: number[], zoom?: number, options?: { duration?: number }) => void;
  getZoom: () => number;
  destroy: () => void;
  container?: { fitToViewport: () => void };
};

export type YmapsCollection = {
  add: (obj: YmapsGeoObject | YmapsCollection) => void;
  remove: (obj: YmapsGeoObject | YmapsCollection) => void;
  removeAll: () => void;
};

export type YmapsLayoutClass = {
  superclass: { build: () => void };
  build: () => void;
};

export type YmapsGeoObject = {
  geometry: {
    getCoordinates: () => number[] | [number[], number];
    setCoordinates: (c: number[] | [number[], number]) => void;
  };
  events: { add: (type: string, cb: (e?: YmapsEvent) => void) => void };
  properties: { set: (k: Record<string, unknown>) => void };
  options: { set: (key: string, value: unknown) => void };
  balloon: { open: () => void; close: () => void };
};

export type YmapsEvent = {
  get: (key: string) => number[];
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type YmapsGeocodeResult = {
  geoObjects: {
    get: (i: number) => YmapsGeocodeObject | null;
    getLength: () => number;
  };
};

export type YmapsGeocodeObject = {
  geometry: { getCoordinates: () => number[] };
  getAddressLine?: () => string;
  properties: { get: (key: string) => unknown };
};

declare global {
  interface Window {
    ymaps?: YmapsNamespace;
  }
}

let loadPromise: Promise<YmapsNamespace> | null = null;

export function hasYandexMapsKey(): boolean {
  return Boolean(resolveYandexMapsApiKey());
}

export function loadYandexMaps(): Promise<YmapsNamespace> {
  const key = resolveYandexMapsApiKey();
  if (!key) return Promise.reject(new Error("YANDEX_MAPS_NO_KEY"));

  if (typeof window === "undefined") {
    return Promise.reject(new Error("YANDEX_MAPS_SSR"));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      script.async = true;
      script.onload = () => {
        const ymaps = window.ymaps;
        if (!ymaps) {
          reject(new Error("YANDEX_MAPS_SCRIPT_EMPTY"));
          return;
        }
        ymaps.ready(() => resolve(ymaps));
      };
      script.onerror = () => reject(new Error("YANDEX_MAPS_SCRIPT_FAIL"));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
