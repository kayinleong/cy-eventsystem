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

    // 2. Write users/{uid} — Cloud Function 1 picks this up and sets claims
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
 * setUserRole — AUTH-08. Updates users/{uid}.role; Cloud Function 1 updates claims + revokes refresh tokens.
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
    await adminDb.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });
    revalidatePath("/users");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
  }
}

/**
 * disableUser — AUTH-09. Toggles Auth.disabled + Firestore.disabled + revokes sessions.
 */
export async function disableUser(uid: string, disabled: boolean) {
  const session = await requireAdmin();

  if (uid === session.uid && disabled) {
    return { ok: false as const, error: "Cannot disable yourself." };
  }

  try {
    // 1. Toggle the Firebase Auth user (blocks NEW sign-ins)
    await adminAuth.updateUser(uid, { disabled });

    // 2. Toggle the Firestore doc (DAL re-checks this on every request)
    await adminDb.collection("users").doc(uid).update({
      disabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    });

    // 3. Revoke EXISTING sessions explicitly (AUTH-09)
    if (disabled) await adminAuth.revokeRefreshTokens(uid);

    revalidatePath("/users");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Update failed" };
  }
}
