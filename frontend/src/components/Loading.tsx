"use client";

const skeletonBase = "animate-pulse bg-shell-skeleton rounded";

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-shell-muted">
        <div className="w-5 h-5 border-2 border-shell-border border-t-white rounded-full animate-spin" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  description,
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-6">{icon}</div>
      <h3 className="text-lg font-semibold text-shell-fg">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-shell-muted max-w-md mx-auto">{description}</p>
      ) : null}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="dark-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className={`${skeletonBase} h-4 w-32 mb-2`} />
          <div className={`${skeletonBase} h-3 w-20`} />
        </div>
        <div className={`${skeletonBase} h-6 w-16 rounded-full`} />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className={`${skeletonBase} h-12 w-full`} />
        <div className={`${skeletonBase} h-12 w-full`} />
        <div className={`${skeletonBase} h-12 w-full`} />
        <div className={`${skeletonBase} h-12 w-full`} />
      </div>
    </div>
  );
}

export function CardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className={`${skeletonBase} h-8 w-48 mb-3`} />
        <div className={`${skeletonBase} h-4 w-96`} />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="dark-card p-8">
          <div className={`${skeletonBase} h-5 w-32 mb-6`} />
          <div className="grid grid-cols-2 gap-4">
            <div className={`${skeletonBase} h-14 w-full`} />
            <div className={`${skeletonBase} h-14 w-full`} />
          </div>
        </div>
      ))}
    </div>
  );
}
