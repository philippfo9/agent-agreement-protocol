"use client";

const skeletonBase = "animate-pulse bg-gray-800 rounded";

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
        <span>{text}</span>
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
    <div className="text-center py-16">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-300">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className={`${skeletonBase} h-4 w-28 mb-2`} />
          <div className={`${skeletonBase} h-3 w-20`} />
        </div>
        <div className={`${skeletonBase} h-6 w-16 rounded-full`} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className={`${skeletonBase} h-10 w-full`} />
        <div className={`${skeletonBase} h-10 w-full`} />
        <div className={`${skeletonBase} h-10 w-full`} />
        <div className={`${skeletonBase} h-10 w-full`} />
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className={`${skeletonBase} h-8 w-48 mb-2`} />
        <div className={`${skeletonBase} h-4 w-96`} />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className={`${skeletonBase} h-5 w-32 mb-4`} />
          <div className="grid grid-cols-2 gap-4">
            <div className={`${skeletonBase} h-12 w-full`} />
            <div className={`${skeletonBase} h-12 w-full`} />
          </div>
        </div>
      ))}
    </div>
  );
}
