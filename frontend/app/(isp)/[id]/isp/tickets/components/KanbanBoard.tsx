import { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Ticket } from "@/graphql/isp_tickets";
import { TicketCard } from "./TicketCard";
import { useMutation } from "@apollo/client";
import { UPDATE_TICKET_STATUS } from "@/graphql/isp_tickets";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TicketIcon } from "lucide-react";
import { subDays, isAfter, parseISO, startOfToday } from "date-fns";
import { formatDateToNowInTimezone } from "@/lib/utils";

interface KanbanBoardProps {
  tickets: Ticket[];
}

// Define the column structure type
type ColumnConfig = {
  title: string;
  className: string;
}

type ColumnDefinition = {
  [K in 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED']: ColumnConfig;
}

const columns: ColumnDefinition = {
  OPEN: {
    title: "Open",
    className: "bg-blue-50 dark:bg-blue-950/30",
  },
  IN_PROGRESS: {
    title: "In Progress",
    className: "bg-yellow-50 dark:bg-yellow-950/30",
  },
  RESOLVED: {
    title: "Resolved",
    className: "bg-green-50 dark:bg-green-950/30",
  },
  CLOSED: {
    title: "Closed",
    className: "bg-gray-50 dark:bg-gray-950/30",
  },
};

const ITEMS_PER_PAGE = 5;

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  const [updateTicketStatus] = useMutation(UPDATE_TICKET_STATUS);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState("all");
  const [localTickets, setLocalTickets] = useState<Ticket[]>(tickets);

  // Filter tickets based on search query, priority, and date
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const customerFullName = ticket.customer 
        ? `${ticket.customer.firstName} ${ticket.customer.lastName}`.toLowerCase()
        : '';
      
      const matchesSearch = 
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerFullName.includes(searchQuery.toLowerCase());

      const matchesPriority = 
        priorityFilter === "ALL" || ticket.priority === priorityFilter;

      // Date filtering
      let matchesDate = true;
      const ticketDate = parseISO(ticket.createdAt);
      const today = startOfToday();

      switch (dateFilter) {
        case "today":
          matchesDate = isAfter(ticketDate, subDays(today, 1));
          break;
        case "week":
          matchesDate = isAfter(ticketDate, subDays(today, 7));
          break;
        case "month":
          matchesDate = isAfter(ticketDate, subDays(today, 30));
          break;
        default: // "all"
          matchesDate = true;
      }

      return matchesSearch && matchesPriority && matchesDate;
    });
  }, [tickets, searchQuery, priorityFilter, dateFilter]);

  // Get paginated tickets for each status
  const getTicketsByStatus = (status: keyof typeof columns) => {
    const statusTickets = filteredTickets.filter((ticket) => ticket.status === status);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return statusTickets.slice(startIndex, endIndex);
  };

  // Get total pages based on the column with most tickets
  const maxTicketsInColumn = Math.max(
    ...Object.keys(columns).map(
      (status) => filteredTickets.filter((t) => t.status === status).length
    )
  );
  const totalPages = Math.ceil(maxTicketsInColumn / ITEMS_PER_PAGE);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as keyof typeof columns;

    // Create new array with updated status
    const newTickets = localTickets.map((ticket: Ticket) => 
      ticket.id === draggableId 
        ? { ...ticket, status: newStatus }
        : ticket
    );
    
    setLocalTickets(newTickets);

    // Update in the backend using the new mutation
    try {
      await updateTicketStatus({
        variables: {
          ticketId: draggableId,
          status: newStatus,
        },
      });
      
      // Add success toast with type-safe access
      toast.success(`Ticket status updated to ${columns[newStatus].title}`);
    } catch (error) {
      toast.error("Failed to update ticket status");
      // Revert the optimistic update
      const revertedTickets = localTickets.map((ticket: Ticket) => 
        ticket.id === draggableId 
          ? { ...ticket, status: source.droppableId as keyof typeof columns }
          : ticket
      );
      setLocalTickets(revertedTickets);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-col gap-4">
        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card"
          />
          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priorities</SelectItem>
              <SelectItem value="HIGH">High Priority</SelectItem>
              <SelectItem value="MEDIUM">Medium Priority</SelectItem>
              <SelectItem value="LOW">Low Priority</SelectItem>
            </SelectContent>
          </Select>
          <Select 
            value={dateFilter} 
            onValueChange={setDateFilter}
          >
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Past week</SelectItem>
              <SelectItem value="month">Past month</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end sm:justify-start lg:justify-end">
            <span className="text-sm text-muted-foreground">
              {filteredTickets.length} tickets found
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(columns) as [keyof typeof columns, ColumnConfig][]).map(([status, { title, className }]) => (
            <div
              key={status}
              className="flex flex-col rounded-lg shadow-md"
            >
              <div className="p-4 border-b bg-card rounded-t-lg">
                <h3 className="font-semibold">{title}</h3>
                <div className="text-sm text-muted-foreground">
                  {filteredTickets.filter(t => t.status === status).length} tickets
                </div>
              </div>
              <Droppable droppableId={status}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-4 space-y-4 ${className} rounded-b-lg min-h-[100px] max-h-[600px] overflow-y-auto`}
                  >
                    {getTicketsByStatus(status).map((ticket, index) => (
                      <Draggable
                        key={ticket.id}
                        draggableId={ticket.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <TicketCard ticket={ticket} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {getTicketsByStatus(status).length === 0 && (
                      <div className="flex flex-col items-center justify-center text-center py-4">
                        <div className="rounded-full bg-muted/10 p-3 mb-3">
                          <TicketIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm text-muted-foreground">No tickets in {title.toLowerCase()}</p>
                        <p className="text-xs text-muted-foreground/60">Drag and drop tickets here</p>
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}



