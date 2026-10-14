"use client";

import { useSyncExternalStore } from "react";
import { createSession, reduceSession } from "./session";
import { randomSeed } from "./sheet";
import { clearSession, loadSession, saveSession } from "./storage";
import type { SessionAction, TestConfig, TestKind, TestSession } from "./types";

/*
 * One store per test kind keeps Pauli and Kraepelin isolated. Every route
 * reads the same live session from here, which matters because Next keeps
 * recently visited routes mounted (hidden) instead of unmounting them.
 */

export interface SessionSnapshot {
  session: TestSession | null;
  /** True when stored data failed validation and was discarded. */
  discardedInvalid: boolean;
}

export interface DispatchResult {
  session: TestSession | null;
  finishedNow: boolean;
}

interface SessionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SessionSnapshot;
  dispatch: (action: SessionAction) => DispatchResult;
  replace: (session: TestSession | null) => void;
}

function createStore(kind: TestKind): SessionStore {
  let snapshot: SessionSnapshot | null = null;
  const listeners = new Set<() => void>();

  function current(): SessionSnapshot {
    if (snapshot === null) {
      const loaded = loadSession(kind);
      snapshot = {
        session: loaded.state === "ok" ? loaded.session : null,
        discardedInvalid: loaded.state === "invalid",
      };
    }
    return snapshot;
  }

  function set(next: SessionSnapshot) {
    snapshot = next;
    if (next.session) saveSession(next.session);
    else clearSession(kind);
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: current,
    dispatch(action) {
      const prev = current().session;
      if (!prev) return { session: null, finishedNow: false };
      const next = reduceSession(prev, action);
      if (next !== prev) set({ session: next, discardedInvalid: false });
      return {
        session: next,
        finishedNow: prev.status !== "finished" && next.status === "finished",
      };
    },
    replace(session) {
      set({ session, discardedInvalid: false });
    },
  };
}

const stores = new Map<TestKind, SessionStore>();

export function getSessionStore(kind: TestKind): SessionStore {
  let store = stores.get(kind);
  if (!store) {
    store = createStore(kind);
    stores.set(kind, store);
  }
  return store;
}

/** Replaces any existing session of this kind with a fresh one in the "ready" state. */
export function prepareSession(config: TestConfig): void {
  getSessionStore(config.kind).replace(createSession(config, randomSeed(), crypto.randomUUID()));
}

const serverSnapshot = () => null;

/** Null while rendering on the server and during hydration: storage is not readable yet. */
export function useSessionSnapshot(kind: TestKind): SessionSnapshot | null {
  const store = getSessionStore(kind);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}

/*
 * Shared clock. Ticks only while a component subscribes, and re-reads the
 * time when the tab becomes visible again so the display catches up at once.
 */
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function updateClock() {
  clockNow = Date.now();
  clockListeners.forEach((listener) => listener());
}

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    clockNow = Date.now();
    clockTimer = setInterval(updateClock, 200);
    document.addEventListener("visibilitychange", updateClock);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      if (clockTimer !== null) clearInterval(clockTimer);
      clockTimer = null;
      document.removeEventListener("visibilitychange", updateClock);
    }
  };
}

function getClock() {
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}

const noopSubscribe = () => () => {};
const serverClock = () => 0;

/** Current time, refreshed several times a second while `active` is true. */
export function useNow(active: boolean): number {
  return useSyncExternalStore(active ? subscribeClock : noopSubscribe, getClock, serverClock);
}
