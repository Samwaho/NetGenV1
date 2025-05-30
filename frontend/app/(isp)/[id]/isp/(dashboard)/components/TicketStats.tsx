"use client";

import { Loader2, TicketIcon, AlertCircle, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-[120px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground mt-2">Loading tickets...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[120px] text-center">
    <div className="p-2 bg-accent rounded-full mb-2">
      <TicketIcon className="h-5 w-5 text-accent-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">No tickets yet</p>
  </div>
);

interface TicketStatsProps {
  tickets: Ticket[];
}

export function TicketStats({ tickets }: TicketStatsProps) {
  if (tickets.length === 0) return <EmptyState />;

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === "OPEN").length;
  const inProgressTickets = tickets.filter(t => t.status === "IN_PROGRESS").length;
  const resolvedTickets = tickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length;
  const activeTickets = openTickets + inProgressTickets;
  const urgentTickets = tickets.filter(t => t.priority === "URGENT").length;
  const highPriorityTickets = tickets.filter(t => t.priority === "HIGH").length;

  const activePercentage = ((activeTickets / totalTickets) * 100).toFixed(1);

  // Calculate tickets created in the last 7 days
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentTickets = tickets.filter(
    t => new Date(t.createdAt) >= lastWeek
  ).length;

  // Get most common ticket category
  const ticketsByCategory = tickets.reduce((acc: Record<string, number>, ticket: Ticket) => {
    const category = ticket.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const categoryEntries = Object.entries(ticketsByCategory);
  const mostCommonCategory = categoryEntries.length > 0 
    ? categoryEntries.sort((a, b) => b[1] - a[1])[0] 
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-foreground">
            {totalTickets}
          </div>
          {recentTickets > 0 && (
            <div className="flex items-center gap-1 text-chart-4">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-medium">
                {recentTickets} new this week
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              activeTickets > 0 ? "bg-chart-3" : "bg-muted"
            )} />
            <span className="text-xs text-muted-foreground">
              {activeTickets} active now
            </span>
          </div>
          <span className="text-xs font-medium text-gradient-custom">
            {activePercentage}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-orange-100 rounded-full">
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Urgent/High</p>
            <p className="text-xs text-muted-foreground truncate">{urgentTickets + highPriorityTickets} tickets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-green-100 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Resolved</p>
            <p className="text-xs text-muted-foreground truncate">{resolvedTickets} tickets</p>
          </div>
        </div>
      </div>

      {mostCommonCategory && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-custom rounded-full">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Top category</p>
              <p className="text-sm font-medium text-foreground truncate">
                {mostCommonCategory[0]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
