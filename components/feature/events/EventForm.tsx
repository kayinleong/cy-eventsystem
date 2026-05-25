// Phase 2 — Shared EventForm for /events/new (create) and /events/[id]/edit
// (Block D UI swap, plan 02-07).
//
// Uses shadcn v4 <Field> primitives (D-01-04-B / D-01-06-A): the legacy v3
// <Form> / <FormField> Context wrapper is empty in the radix-nova registry.
// We bind react-hook-form's `register` / `setValue` / `Controller` directly to
// shadcn primitives inside each <Field>.
//
// REQUIREMENTS:
//   - EVT-01 — admin OR self-team-lead can create. Server Action enforces
//     server-side; here we pre-fill teamLeads with the current user when
//     creating so the schema's .min(1) check passes without the user having
//     to add themselves manually.
//   - EVT-05 — admin OR existing team lead can edit. Server Action enforces.
//   - Backup team support per event.
//
// Calendar pickers use shadcn Calendar inside a Popover (single-date mode).
// Comboboxes are custom multi-select pickers built on shadcn Command + Popover.
//
// D-01-06-G: Zod 4's `.default()` makes input fields `T | undefined` in the
// rhf input type. Normalize at the submit boundary via `?? defaultValue`
// before calling the strict-typed Server Action.
//
// Phase 2 swap: createEvent/updateEvent Server Actions replace mock-store
// mutators. Validation errors from the action (Zod fieldErrors) surface via
// rhf.setError so the inline FieldError chrome stays unchanged.

"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  EventFormSchema,
  type EventFormInput,
} from "@/lib/schemas/event";
import { createEvent, updateEvent } from "@/app/(app)/events/actions";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import type { UserDoc } from "@/lib/types/user";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TeamLeadCombobox } from "./TeamLeadCombobox";
import { BackupTeamCombobox } from "./BackupTeamCombobox";
import { cn } from "@/lib/utils";

export type EventFormProps =
  | {
      mode: "create";
      initial?: EventFormInput;
      eventId?: undefined;
      users: UserDoc[];
    }
  | {
      mode: "edit";
      eventId: string;
      initial: EventFormInput;
      users: UserDoc[];
    };

export function EventForm(props: EventFormProps) {
  const { mode, initial, eventId, users } = props;
  const router = useRouter();
  const session = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<EventFormInput>({
    resolver: zodResolver(EventFormSchema),
    mode: "onBlur",
    defaultValues:
      initial ?? {
        name: "",
        startDate: "",
        endDate: "",
        location: "",
        description: "",
        // EVT-01 — schema requires ≥1 team lead. Pre-fill with the current
        // user when creating so the field passes initial validation without
        // forcing the user to add themselves manually. The Server Action
        // also requires admin OR self-in-teamLeads, so this default also
        // satisfies the authorization gate for non-admin creators.
        teamLeads: session ? [session.uid] : [],
        backupTeams: [],
      },
  });

  // Use rhf's `useWatch` (subscribes via Context, memoization-safe) rather
  // than `useForm().watch()` (returns a non-memoizable function — React
  // Compiler skips compilation of the whole component if used at render time).
  const teamLeads = useWatch({ control, name: "teamLeads" }) ?? [];

  async function onSubmit(values: EventFormInput) {
    // D-01-06-G: normalize Zod-default fields at the submit boundary.
    const payload = {
      name: values.name,
      startDate: values.startDate,
      endDate: values.endDate,
      location: values.location ?? "",
      description: values.description ?? "",
      teamLeads: values.teamLeads,
      backupTeams: values.backupTeams ?? [],
    };

    setSubmitting(true);
    try {
      if (mode === "create") {
        const result = await createEvent(payload);
        if (!result.ok) {
          // Surface field-level Zod errors via rhf.setError so the inline
          // FieldError chrome lights up exactly the bad field.
          if (result.errors) {
            for (const [field, messages] of Object.entries(result.errors)) {
              if (messages && messages.length > 0) {
                setError(field as keyof EventFormInput, {
                  type: "server",
                  message: messages[0],
                });
              }
            }
          }
          toast.error(result.error || "Couldn't create event");
          return;
        }
        toast.success("Event created");
        router.push(`/events/${result.eventId}`);
        router.refresh();
      } else if (eventId) {
        const result = await updateEvent(eventId, payload);
        if (!result.ok) {
          if (result.errors) {
            for (const [field, messages] of Object.entries(result.errors)) {
              if (messages && messages.length > 0) {
                setError(field as keyof EventFormInput, {
                  type: "server",
                  message: messages[0],
                });
              }
            }
          }
          toast.error(result.error || "Couldn't update event");
          return;
        }
        toast.success("Event updated");
        router.push(`/events/${eventId}`);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-2xl"
      noValidate
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="event-name">Name</FieldLabel>
          <Input
            id="event-name"
            placeholder="e.g. Summer Tech Conference"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError
            errors={
              errors.name ? [{ message: errors.name.message }] : undefined
            }
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field data-invalid={!!errors.startDate}>
            <FieldLabel htmlFor="event-startDate">Start date</FieldLabel>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      id="event-startDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                      aria-invalid={!!errors.startDate}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {field.value
                        ? format(new Date(field.value), "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        field.value ? new Date(field.value) : undefined
                      }
                      onSelect={(d) =>
                        field.onChange(d ? d.toISOString() : "")
                      }
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            <FieldError
              errors={
                errors.startDate
                  ? [{ message: errors.startDate.message }]
                  : undefined
              }
            />
          </Field>

          <Field data-invalid={!!errors.endDate}>
            <FieldLabel htmlFor="event-endDate">End date</FieldLabel>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      id="event-endDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                      aria-invalid={!!errors.endDate}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {field.value
                        ? format(new Date(field.value), "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        field.value ? new Date(field.value) : undefined
                      }
                      onSelect={(d) =>
                        field.onChange(d ? d.toISOString() : "")
                      }
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            <FieldError
              errors={
                errors.endDate
                  ? [{ message: errors.endDate.message }]
                  : undefined
              }
            />
          </Field>
        </div>

        <Field data-invalid={!!errors.location}>
          <FieldLabel htmlFor="event-location">Location</FieldLabel>
          <Input
            id="event-location"
            placeholder="Venue or address"
            aria-invalid={!!errors.location}
            {...register("location")}
          />
          <FieldError
            errors={
              errors.location
                ? [{ message: errors.location.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.teamLeads}>
          <FieldLabel htmlFor="event-teamLeads">Team leads</FieldLabel>
          <Controller
            control={control}
            name="teamLeads"
            render={({ field }) => (
              <TeamLeadCombobox
                value={field.value ?? []}
                onChange={field.onChange}
                users={users}
              />
            )}
          />
          <FieldError
            errors={
              errors.teamLeads
                ? [{ message: errors.teamLeads.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.backupTeams}>
          <FieldLabel htmlFor="event-backupTeams">Backup team</FieldLabel>
          <Controller
            control={control}
            name="backupTeams"
            render={({ field }) => (
              <BackupTeamCombobox
                value={field.value ?? []}
                onChange={field.onChange}
                excludeUids={teamLeads}
                users={users}
              />
            )}
          />
          <FieldError
            errors={
              errors.backupTeams
                ? [{ message: errors.backupTeams.message }]
                : undefined
            }
          />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="event-description">Description</FieldLabel>
          <Textarea
            id="event-description"
            rows={4}
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          <FieldError
            errors={
              errors.description
                ? [{ message: errors.description.message }]
                : undefined
            }
          />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {mode === "create" ? "Create event" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
