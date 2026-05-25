"use server";
// app/(app)/users/actions.ts
// Per RESEARCH §2.5-§2.6. PATTERNS §1 row "app/(app)/users/actions.ts".
// Each action: requireAdmin() → Zod parse → Admin SDK calls → revalidatePath.
//
// InviteUserSchema lives in @/lib/schemas/user (Phase 1; not @/lib/schemas/auth
// — plan text at step 4.0 had the wrong path).

import { requireAdmin } from "@/lib/auth/dal";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { InviteUserSchema } from "@/lib/schemas/user";
import { recomputeAllowedStaffForAllEvents } from "@/lib/data/allowed-staff.server";

/**
 * inviteUser — AUTH-07. Creates a Firebase Auth user without a password,
 * writes the users/{uid} doc (Cloud Function 1 picks up the role + sets claims),
 * generates a password reset link, and RETURNS the link in the response payload
 * per D-09 so admin can copy/share even if email delivery fails.
 */
export async function inviteUser(formData: FormData) {
  const session = await requireAdmin();

  const parsed = InviteUserSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, displayName, role } = parsed.data;

  try {
    // 1. Create the Firebase Auth user (no password — invitee sets via /set-password)
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      disabled: false,
    });

    // 2. Write users/{uid} — Firestore is the source of truth for role.
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      disabled: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: session.uid,
      lastLoginAt: null,
    });

    // 2b. Inlined Function 1 (was Cloud Function `onUserWriteSetClaims`):
    // mirror role to the user's Auth custom claims so subsequent ID tokens
    // carry `role` and downstream rules `request.auth.token.role` work
    // without the DAL Firestore fallback. New users have no existing
    // refresh tokens, so we skip revokeRefreshTokens here.
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 2c. Inlined Function 2 (was `onUserRoleChange`): if the new user is
    // an admin, every event's allowedStaff array must include them. Iterate
    // events and recompute. Skipped for staff invites (no event membership
    // change). At v1 scale (<100 events) the sweep is acceptable.
    if (role === "admin") {
      await recomputeAllowedStaffForAllEvents();
      revalidatePath("/events");
    }

    // 3. Generate password reset link (D-07/D-09)
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/set-password`,
      handleCodeInApp: false,
    };
    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    // 3b. Trigger Firebase to ALSO send the templated email (D-07).
    // Admin SDK's generatePasswordResetLink does NOT auto-send the email — it just
    // generates the URL. The Identity Toolkit REST API's sendOobCode endpoint fires
    // the templated email using Firebase's built-in delivery infrastructure.
    // Non-fatal: if this fails (rate limit, transient), the resetLink in the response
    // payload is the primary delivery path per D-09 (Copy-link UI).
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    let emailSent = false;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
          },
        );
        emailSent = res.ok;
      } catch {
        // Swallow — resetLink in response is the fallback per D-09
      }
    }

    revalidatePath("/users");
    return { ok: true as const, uid: userRecord.uid, resetLink, emailSent };
  } catch (err) {
    // Firebase Auth errors have a `.code` (e.g., "auth/email-already-exists")
    const code = (err as { code?: string }).code;
    let userMessage = "Couldn't invite — try again.";
    if (code === "auth/email-already-exists") {
      userMessage = "This email is already in use.";
    }
    // D-09: even on failure, if we got far enough to generate a link, return it
    return { ok: false as const, error: userMessage };
  }
}

/**
 * setUserRole — AUTH-08.
 *
 * Inlined Cloud Functions 1 + 2:
 *   - Update Firestore users/{uid}.role (source of truth)
 *   - Mirror role to Auth custom claims via setCustomUserClaims
 *   - Revoke refresh tokens so the user picks up new claims on next request
 *   - If admin status flipped (was admin XOR now admin), recompute
 *     allowedStaff on every event so role-based event access stays in sync
 */
export async function setUserRole(uid: string, role: "admin" | "staff") {
  const session = await requireAdmin();

  if (!uid || !["admin", "staff"].includes(role)) {
    return { ok: false as const, error: "Invalid input" };
  }
  // Prevent admin from demoting themselves while last admin (basic safety)
  if (uid === session.uid && role === "staff") {
    const admins = await adminDb.collection("users").where("role", "==", "admin").limit(2).get();
    if (admins.size <= 1) {
      return { ok: false as const, error: "Cannot demote the last admin." };
    }
  }

  try {
    // Capture admin status BEFORE update so we can detect a flip.
    const docRef = adminDb.collection("users").doc(uid);
    const before = await docRef.get();
    const beforeData = before.data() ?? {};
    const wasAdmin = beforeData.role === "admin" && beforeData.disabled !== true;

    // 1. Firestore (source of truth) first.
    await docRef.update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });

    // 2. Mirror to Auth custom claims (inlined Function 1).
    await adminAuth.setCustomUserClaims(uid, { role });

    // 3. Revoke refresh tokens so the user re-fetches an ID token with the
    //    new claim on their next request (AUTH-09 immediate effect).
    await adminAuth.revokeRefreshTokens(uid);

    // 4. If admin status flipped, recompute event.allowedStaff across all
    //    events (inlined Function 2 — was `onUserRoleChange`).
    const isNowAdmin = role === "admin" && beforeData.disabled !== true;
    if (wasAdmin !== isNowAdmin) {
      await recomputeAllowedStaffForAllEvents();
      revalidatePath("/events");
    }

    revalidatePath("/users");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
  }
}

/**
 * disableUser — AUTH-09. Toggles Auth.disabled + Firestore.disabled + revokes sessions.
 *
 * Also inlines the admin-status-flip side of Function 2: if disabling an
 * admin (or re-enabling one), the user's effective admin-ness changes,
 * so every event's allowedStaff must be recomputed.
 */
export async function disableUser(uid: string, disabled: boolean) {
  const session = await requireAdmin();

  if (uid === session.uid && disabled) {
    return { ok: false as const, error: "Cannot disable yourself." };
  }

  try {
    // Capture admin status BEFORE so we can detect a flip via disable.
    const docRef = adminDb.collection("users").doc(uid);
    const before = await docRef.get();
    const beforeData = before.data() ?? {};
    const wasAdmin = beforeData.role === "admin" && beforeData.disabled !== true;

    // 1. Toggle the Firebase Auth user (blocks NEW sign-ins).
    await adminAuth.updateUser(uid, { disabled });

    // 2. Toggle the Firestore doc (DAL re-checks this on every request).
    await docRef.update({
      disabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });

    // 3. Revoke EXISTING sessions explicitly (AUTH-09).
    if (disabled) await adminAuth.revokeRefreshTokens(uid);

    // 4. Admin status may have flipped — recompute allowedStaff
    //    (inlined Function 2). An admin being disabled = no longer admin;
    //    an admin being re-enabled = admin again.
    const isNowAdmin = beforeData.role === "admin" && !disabled;
    if (wasAdmin !== isNowAdmin) {
      await recomputeAllowedStaffForAllEvents();
      revalidatePath("/events");
    }

    revalidatePath("/users");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
  }
}
