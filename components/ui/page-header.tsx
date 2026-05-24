/**
 * UI-SPEC page header contract:
 *  - title at text-lg font-semibold (Heading-M, 18px / 600)
 *  - optional description at text-sm text-muted-foreground
 *  - optional action slot (primary CTA right-aligned)
 *  - separator: border-b with pb-6 mb-6
 *
 * Used by every Wave 3 list/detail page.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6 border-b mb-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
