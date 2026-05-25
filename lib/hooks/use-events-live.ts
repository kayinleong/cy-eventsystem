"use client";
// lib/hooks/use-events-live.ts
// Live hook scoped to the visible cursor page per D-20 (50-row window).
// SSR seed pattern: server passes `initial` from getEventsPage; hook takes
// over via onSnapshot for the same query window.
//
// EVT-08 — the array-contains filter on `allowedStaff` enforces staff
// scoping client-side. The firestore.rules `isMember(resource)` also
// enforces this at the database layer, but the SDK projection here means
// the listener never receives rows the rule would deny (which would surface
// as `permission-denied` errors in the console).
//
// Auth race note: same pattern as useInventoryLive — register the
// onSnapshot listener INSIDE onAuthStateChanged so the Firebase Web SDK's
// auth.currentUser is hydrated before the query goes out. Without this,
// listeners can fire while auth is still pending and Firestore treats the
// request as unauthenticated → permission-denied even when the rule allows
// signed-in users.

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  documentId,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { EventDoc, EventStatus } from "@/lib/types/event";
import type { Session } from "@/lib/types/session";

function tsToIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function toEvent(d: QueryDocumentSnapshot): EventDoc {
  const data = d.data();
  return {
    id: d.id,
    name: data.name ?? "",
    startDate: tsToIso(data.startDate) ?? new Date(0).toISOString(),
    endDate: tsToIso(data.endDate) ?? new Date(0).toISOString(),
    status: (data.status ?? "planned") as EventStatus,
    location: data.location ?? "",
    description: data.description ?? "",
    teamLeads: Array.isArray(data.teamLeads) ? (data.teamLeads as string[]) : [],
    backupTeams: Array.isArray(data.backupTeams)
      ? (data.backupTeams as string[])
      : [],
    allowedStaff: Array.isArray(data.allowedStaff)
      ? (data.allowedStaff as string[])
      : [],
    plannedItems: data.plannedItems ?? {},
    createdAt: tsToIso(data.createdAt) ?? new Date(0).toISOString(),
    createdBy: data.createdBy ?? "",
    closedAt: tsToIso(data.closedAt),
    closedBy: data.closedBy ?? null,
  };
}

export type UseEventsLiveOpts = {
  /** Session payload — gates the EVT-08 array-contains filter. */
  session: Session;
  /** Optional status filter (planned / active / completed / cancelled). */
  status?: string;
  /** Listener window size; defaults to 50 per D-20. */
  limit?: number;
};

export function useEventsLive(
  initial: EventDoc[],
  opts: UseEventsLiveOpts,
): EventDoc[] {
  const [events, setEvents] = useState<EventDoc[]>(initial);

  useEffect(() => {
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }
      if (!user) return;

      const constraints: QueryConstraint[] = [];
      // EVT-08: staff must be in allowedStaff. Admin sees everything.
      if (opts.session.role !== "admin") {
        constraints.push(
          where("allowedStaff", "array-contains", opts.session.uid),
        );
      }
      if (opts.status) {
        constraints.push(where("status", "==", opts.status));
      }
      constraints.push(
        orderBy("startDate", "asc"),
        orderBy(documentId()),
        fbLimit(opts.limit ?? 50),
      );

      const q = query(collection(db, "events"), ...constraints);
      unsubSnap = onSnapshot(
        q,
        (snap: QuerySnapshot) => {
          setEvents(snap.docs.map((d) => toEvent(d as QueryDocumentSnapshot)));
        },
        (err: FirestoreError) => {
          // Surface rule/listener errors so a future rule tightening or index
          // miss is immediately visible during dev. Production should never
          // hit this because Server Components seed via Admin SDK.
          console.error(
            "[useEventsLive] onSnapshot error:",
            err.code,
            err.message,
          );
        },
      );
    });

    return () => {
      if (unsubSnap) unsubSnap();
      unsubAuth();
    };
  }, [opts.session.uid, opts.session.role, opts.status, opts.limit]);

  return events;
}
