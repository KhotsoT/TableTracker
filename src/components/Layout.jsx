import { cn } from "@/lib/utils"
import { useState, useEffect } from 'react';
import { getSMSBalance } from '../services/smsService';

export function PageHeader({ 
  title, 
  subtitle, 
  children // for action buttons/elements
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 sm:mt-1 text-sm text-gray-500 line-clamp-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {children && (
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            {children}
          </div>
        )}
      </div>
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