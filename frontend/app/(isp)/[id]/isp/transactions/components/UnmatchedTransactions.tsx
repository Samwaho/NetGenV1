"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_UNMATCHED_TRANSACTIONS, UPDATE_TRANSACTION_BILL_REF } from "@/graphql/isp_transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { columns } from "./columns";
import { DataTable } from "./TransactionsTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Loader2 } from "lucide-react";
import { Row } from "@tanstack/react-table";
import { ISPTransaction } from "@/types/isp_transaction";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Define transaction types
enum TransactionType {
  CUSTOMER_PAYMENT = "customer_payment",
  HOTSPOT_VOUCHER = "hotspot_voucher"
}

export function UnmatchedTransactions({ organizationId }: { organizationId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<ISPTransaction | null>(null);
  const [newBillRef, setNewBillRef] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.CUSTOMER_PAYMENT);

  const { data, loading, refetch } = useQuery(GET_UNMATCHED_TRANSACTIONS, {
    variables: { organizationId },
    fetchPolicy: "network-only"
  });

  const [updateBillRef, { loading: updating }] = useMutation(UPDATE_TRANSACTION_BILL_REF, {
    onCompleted: (data) => {
      if (data.updateTransactionBillRef.success) {
        toast.success("Transaction updated successfully");
        setIsDialogOpen(false);
        setSelectedTransaction(null);
        setNewBillRef("");
        setTransactionType(TransactionType.CUSTOMER_PAYMENT);
        refetch();
      } else {
        toast.error(data.updateTransactionBillRef.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  if (loading) return <TableSkeleton columns={9} rows={5} />;

  const unmatched = data?.unmatchedTransactions?.transactions || [];
  const totalCount = data?.unmatchedTransactions?.totalCount || 0;

  const handleOpenDialog = (transaction: ISPTransaction) => {
    setSelectedTransaction(transaction);
    setNewBillRef(transaction.billRefNumber || "");
    setTransactionType(transaction.transactionType as TransactionType || TransactionType.CUSTOMER_PAYMENT);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
    setNewBillRef("");
    setTransactionType(TransactionType.CUSTOMER_PAYMENT);
  };

  const handleUpdate = async () => {
    if (!selectedTransaction) return;
    
    if (!newBillRef.trim()) {
      toast.error("Please enter a valid reference");
      return;
    }

    await updateBillRef({
      variables: {
        transactionId: selectedTransaction.id,
        newBillRef: newBillRef.trim(),
        transactionType: transactionType
      }
    });
  };

  const unmatchedColumns = [
    ...columns,
    {
      id: "actions",
      accessorKey: "id",
      cell: ({ row }: { row: Row<ISPTransaction> }) => {
        const transaction = row.original;
        return (
          <Button 
            size="sm"
            variant="outline"
            onClick={() => handleOpenDialog(transaction)}
          >
            Edit
          </Button>
        );
      }
    }
  ];

  return (
    <>
      <DataTable 
        columns={unmatchedColumns} 
        data={unmatched}
        totalCount={totalCount}
        isLoading={loading}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Transaction</DialogTitle>
            <DialogDescription>
              {transactionType === TransactionType.CUSTOMER_PAYMENT 
                ? "Enter the customer username to link this transaction."
                : "Enter the voucher code to link this transaction."}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">Type:</span>
                <div className="col-span-3">
                  <Select
                    value={transactionType || TransactionType.CUSTOMER_PAYMENT}
                    onValueChange={(value) => setTransactionType(value as TransactionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TransactionType.CUSTOMER_PAYMENT}>
                        Customer Payment
                      </SelectItem>
                      <SelectItem value={TransactionType.HOTSPOT_VOUCHER}>
                        Hotspot Voucher
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">Amount:</span>
                <span className="col-span-3 text-sm">
                  {selectedTransaction.amount}
                </span>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">Phone:</span>
                <span className="col-span-3 text-sm">
                  {selectedTransaction.phoneNumber}
                </span>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">Transaction:</span>
                <span className="col-span-3 text-sm">
                  {selectedTransaction.transactionId}
                </span>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">
                  {transactionType === TransactionType.CUSTOMER_PAYMENT ? "Username:" : "Voucher Code:"}
                </span>
                <div className="col-span-3">
                  <Input
                    value={newBillRef}
                    onChange={(e) => setNewBillRef(e.target.value)}
                    placeholder={transactionType === TransactionType.CUSTOMER_PAYMENT 
                      ? "Enter customer username" 
                      : "Enter voucher code"}
                  />
                </div>
              </div>

              {transactionType === TransactionType.HOTSPOT_VOUCHER && selectedTransaction.packageName && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <span className="text-sm font-medium">Package:</span>
                  <span className="col-span-3 text-sm">
                    {selectedTransaction.packageName}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-sm font-medium">Status:</span>
                <div className="col-span-3">
                  <Badge variant={selectedTransaction.status === "completed" ? "default" : "secondary"}>
                    {selectedTransaction.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}








