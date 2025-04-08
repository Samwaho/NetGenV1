import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Ticket } from "@/graphql/isp_tickets";
import { TicketCard } from "./TicketCard";
import { useMutation } from "@apollo/client";
import { UPDATE_TICKET_STATUS } from "@/graphql/isp_tickets";
import { toast } from "sonner";

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

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  const [updateTicketStatus] = useMutation(UPDATE_TICKET_STATUS);
  const [localTickets, setLocalTickets] = useState(tickets);

  const getTicketsByStatus = (status: keyof typeof columns) => {
    return localTickets.filter((ticket) => ticket.status === status);
  };

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
    const newTickets = localTickets.map(ticket => 
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
      const revertedTickets = localTickets.map(ticket => 
        ticket.id === draggableId 
          ? { ...ticket, status: source.droppableId as keyof typeof columns }
          : ticket
      );
      setLocalTickets(revertedTickets);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.entries(columns) as [keyof typeof columns, ColumnConfig][]).map(([status, { title, className }]) => (
          <div
            key={status}
            className="flex flex-col h-[calc(100vh-16rem)] rounded-lg border"
          >
            <div className="p-4 border-b bg-card">
              <h3 className="font-semibold">{title}</h3>
              <div className="text-sm text-muted-foreground">
                {getTicketsByStatus(status).length} tickets
              </div>
            </div>
            <Droppable droppableId={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto p-4 space-y-4 ${className}`}
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
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}



