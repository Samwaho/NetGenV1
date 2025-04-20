interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function LoadingSpinner({ className, ...props }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center" {...props}>
      <div className={`h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin ${className || ''}`} />
    </div>
  );
}
