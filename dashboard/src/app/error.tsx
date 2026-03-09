"use client";

export default function Error({
	error,
	reset,
}: { error: Error; reset: () => void }): React.ReactElement {
	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
			<h2 className="text-lg font-semibold">Something went wrong</h2>
			<p className="text-muted-foreground text-sm">{error.message}</p>
			<button
				onClick={reset}
				className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
			>
				Try again
			</button>
		</div>
	);
}
