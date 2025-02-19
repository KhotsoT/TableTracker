import { cn } from "@/lib/utils"

export function PageHeader({ 
  title, 
  subtitle, 
  children // for action buttons/elements
}) {
  return (
    <div className="flex justify-between items-start border-b border-gray-200 pb-5 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  )
}

export function PageContainer({ children, className }) {
  return (
    <div className={cn(
      "max-w-7xl mx-auto px-6 py-8 min-h-screen",
      className
    )}>
      {children}
    </div>
  )
} 