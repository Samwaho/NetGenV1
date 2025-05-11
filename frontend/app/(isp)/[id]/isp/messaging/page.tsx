"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { SEND_SMS, SEND_BULK_SMS } from "@/graphql/sms";
import type { SendSmsResponse, SendBulkSmsResponse } from "@/graphql/sms";
import { GET_ISP_CUSTOMERS } from "@/graphql/isp_customers";
import { GET_ISP_STATIONS } from "@/graphql/isp_stations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Users, Wifi, Phone, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Define interfaces for the data structures
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  station: {
    id: string;
    name: string;
  };
}

interface Station {
  id: string;
  name: string;
}

export default function MessagingPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  
  const [message, setMessage] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [stationCommandOpen, setStationCommandOpen] = useState(false);
  const [customerCommandOpen, setCustomerCommandOpen] = useState(false);
  
  // Fetch customers
  const { data: customersData, loading: customersLoading } = useQuery(GET_ISP_CUSTOMERS, {
    variables: { 
      organizationId,
      page: 1,
      pageSize: 100 // Get a reasonable number of customers
    },
    fetchPolicy: "network-only",
  });
  
  // Fetch stations
  const { data: stationsData, loading: stationsLoading } = useQuery(GET_ISP_STATIONS, {
    variables: { 
      organizationId,
      page: 1,
      pageSize: 100 // Get a reasonable number of stations
    },
    fetchPolicy: "network-only",
  });
  
  // SMS mutations
  const [sendSms, { loading: sendingSms }] = useMutation<SendSmsResponse>(SEND_SMS);
  const [sendBulkSms, { loading: sendingBulkSms }] = useMutation<SendBulkSmsResponse>(SEND_BULK_SMS);
  
  const customers: Customer[] = customersData?.customers?.customers || [];
  const stations: Station[] = stationsData?.stations?.stations || [];
  
  // Get customers for selected station
  const stationCustomers = selectedStation 
    ? customers.filter((customer: Customer) => customer.station?.id === selectedStation)
    : [];
    
  // Filter customers based on search query
  const filteredCustomers = customerSearchQuery 
    ? customers.filter(customer => 
        `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.phone?.includes(customerSearchQuery)
      )
    : customers;
  
  // Get selected customer details
  const selectedCustomerDetails = customers.filter(customer => 
    selectedCustomers.includes(customer.id)
  );
  
  // Get selected station details
  const selectedStationDetails = stations.find(station => 
    station.id === selectedStation
  );
  
  const handleSendToIndividual = async () => {
    if (!message) {
      toast.error("Please enter a message");
      return;
    }
    
    if (selectedCustomers.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }
    
    try {
      if (selectedCustomers.length === 1) {
        // Send to single selected customer
        const customer = customers.find((c: Customer) => c.id === selectedCustomers[0]);
        if (customer?.phone) {
          const { data, errors } = await sendSms({
            variables: {
              organizationId,
              to: customer.phone,
              message
            }
          });

          console.log("SMS response:", data, "Errors:", errors);

          if (data?.sendSms?.success) {
            toast.success(`SMS sent to ${customer.firstName} ${customer.lastName}`);
            setSelectedCustomers([]);
            setMessage("");
          } else {
            // Show success toast anyway if the message_id exists (indicating success)
            if (data?.sendSms?.messageId) {
              toast.success(`SMS sent to ${customer.firstName} ${customer.lastName}`);
              setSelectedCustomers([]);
              setMessage("");
            } else {
              toast.error(`Failed to send SMS: ${data?.sendSms?.message || "Unknown error"}`);
            }
          }
        } else {
          toast.error(`${customer?.firstName} ${customer?.lastName} has no phone number`);
        }
      } else {
        // Send to multiple selected customers
        const phoneNumbers = selectedCustomers
          .map(id => customers.find((c: Customer) => c.id === id)?.phone)
          .filter(Boolean) as string[];
        
        if (phoneNumbers.length > 0) {
          const { data, errors } = await sendBulkSms({
            variables: {
              organizationId,
              to: phoneNumbers,
              message
            }
          });

          console.log("Bulk SMS response:", data, "Errors:", errors);

          if (data?.sendBulkSms?.success) {
            toast.success(`SMS sent to ${data?.sendBulkSms?.totalSent || 0} customers`);
            setSelectedCustomers([]);
            setMessage("");
          } else {
            // Show success toast if totalSent > 0 (indicating partial success)
            if (data?.sendBulkSms?.totalSent && data.sendBulkSms.totalSent > 0) {
              toast.success(`SMS sent to ${data.sendBulkSms.totalSent} customers (${data.sendBulkSms.failed || 0} failed)`);
              setSelectedCustomers([]);
              setMessage("");
            } else {
              toast.error(`Failed to send SMS: ${data?.sendBulkSms?.message || "Unknown error"}`);
            }
          }
        } else {
          toast.error("No valid phone numbers found for selected customers");
        }
      }
    } catch (error) {
      console.error("SMS sending error:", error);
      toast.error(`Error sending SMS: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  const handleSendToManual = async () => {
    if (!message) {
      toast.error("Please enter a message");
      return;
    }
    
    if (!manualNumber) {
      toast.error("Please enter a phone number");
      return;
    }
    
    try {
      // Send to manually entered number
      const { data, errors } = await sendSms({
        variables: {
          organizationId,
          to: manualNumber,
          message
        }
      });

      console.log("Manual SMS response:", data, "Errors:", errors);

      if (data?.sendSms?.success) {
        toast.success("SMS sent successfully");
        setManualNumber("");
        setMessage("");
      } else {
        // Show success toast anyway if the message_id exists (indicating success)
        if (data?.sendSms?.messageId) {
          toast.success("SMS sent successfully");
          setManualNumber("");
          setMessage("");
        } else {
          toast.error(`Failed to send SMS: ${data?.sendSms?.message || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("SMS sending error:", error);
      toast.error(`Error sending SMS: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  const handleSendToStation = async () => {
    if (!message) {
      toast.error("Please enter a message");
      return;
    }
    
    if (!selectedStation) {
      toast.error("Please select a station");
      return;
    }
    
    try {
      const phoneNumbers = stationCustomers
        .map((customer: Customer) => customer.phone)
        .filter(Boolean) as string[];
      
      if (phoneNumbers.length === 0) {
        toast.error("No customers with phone numbers found for this station");
        return;
      }
      
      const { data, errors } = await sendBulkSms({
        variables: {
          organizationId,
          to: phoneNumbers,
          message
        }
      });

      console.log("Station SMS response:", data, "Errors:", errors);

      if (data?.sendBulkSms?.success) {
        toast.success(`SMS sent to ${data?.sendBulkSms?.totalSent || 0} customers`);
        setSelectedStation("");
        setMessage("");
      } else {
        // Show success toast if totalSent > 0 (indicating partial success)
        if (data?.sendBulkSms?.totalSent && data.sendBulkSms.totalSent > 0) {
          toast.success(`SMS sent to ${data.sendBulkSms.totalSent} customers (${data.sendBulkSms.failed || 0} failed)`);
          setSelectedStation("");
          setMessage("");
        } else {
          toast.error(`Failed to send SMS: ${data?.sendBulkSms?.message || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("SMS sending error:", error);
      toast.error(`Error sending SMS: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  const toggleCustomerSelection = (customerId: string) => {
    if (selectedCustomers.includes(customerId)) {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId));
    } else {
      setSelectedCustomers([...selectedCustomers, customerId]);
    }
  };
  
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            Customer Messaging
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Send SMS notifications to your customers
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/customers`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Button>
      </div>
      
      <Card className="shadow-md border-muted">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send SMS Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="customers" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Customers</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Manual Entry</span>
              </TabsTrigger>
              <TabsTrigger value="station" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2">
                <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">By Station</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="customers" className="space-y-6 mt-2">
              <div className="space-y-6">
                <div className="border rounded-lg p-4 bg-card">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Select Recipients
                  </h3>
                  
                  <Popover open={customerCommandOpen} onOpenChange={setCustomerCommandOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerCommandOpen}
                        className="w-full justify-between"
                      >
                        {selectedCustomers.length > 0 
                          ? `${selectedCustomers.length} customer${selectedCustomers.length > 1 ? 's' : ''} selected`
                          : "Search customers..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search customers..." 
                          value={customerSearchQuery}
                          onValueChange={setCustomerSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>No customers found.</CommandEmpty>
                          <CommandGroup>
                            {customersLoading ? (
                              <div className="flex items-center justify-center p-4">
                                <span className="text-sm text-muted-foreground">Loading customers...</span>
                              </div>
                            ) : (
                              filteredCustomers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={`${customer.firstName} ${customer.lastName}`}
                                  onSelect={() => toggleCustomerSelection(customer.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Checkbox
                                    checked={selectedCustomers.includes(customer.id)}
                                    className="mr-2"
                                    onCheckedChange={() => {}}
                                  />
                                  <span>{customer.firstName} {customer.lastName}</span>
                                  {customer.phone ? (
                                    <Badge variant="outline" className="ml-auto">
                                      {customer.phone}
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="ml-auto">
                                      No phone
                                    </Badge>
                                  )}
                                </CommandItem>
                              ))
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {selectedCustomers.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected Recipients:</h4>
                      <ScrollArea className="h-24 rounded-md border p-2">
                        <div className="space-y-1">
                          {selectedCustomerDetails.map((customer) => (
                            <div key={customer.id} className="flex items-center justify-between">
                              <span className="text-sm">
                                {customer.firstName} {customer.lastName}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant={customer.phone ? "outline" : "destructive"} className="text-xs">
                                  {customer.phone || "No phone"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleCustomerSelection(customer.id)}
                                >
                                  <span className="sr-only">Remove</span>
                                  <span className="text-xs">×</span>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customersMessage" className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    Message Content
                  </Label>
                  <Textarea
                    id="customersMessage"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {message.length} characters
                    </p>
                    <Button
                      onClick={handleSendToIndividual}
                      disabled={!message || sendingSms || selectedCustomers.length === 0}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {sendingSms ? "Sending..." : "Send Message"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-6 mt-2">
              <div className="space-y-6">
                <div className="border rounded-lg p-4 bg-card">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Recipient Phone Number
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="manualNumber">Phone Number</Label>
                    <Input
                      id="manualNumber"
                      placeholder="Enter phone number (e.g. +254712345678)"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Enter a phone number to send an SMS directly
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manualMessage" className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    Message Content
                  </Label>
                  <Textarea
                    id="manualMessage"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {message.length} characters
                    </p>
                    <Button
                      onClick={handleSendToManual}
                      disabled={!message || sendingSms || !manualNumber}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {sendingSms ? "Sending..." : "Send Message"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="station" className="space-y-6 mt-2">
              <div className="space-y-6">
                <div className="border rounded-lg p-4 bg-card">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    Select Station
                  </h3>
                  
                  <Popover open={stationCommandOpen} onOpenChange={setStationCommandOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={stationCommandOpen}
                        className="w-full justify-between"
                      >
                        {selectedStationDetails 
                          ? selectedStationDetails.name
                          : "Select a station..."}
                        <Wifi className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search stations..." />
                        <CommandList>
                          <CommandEmpty>No stations found.</CommandEmpty>
                          <CommandGroup>
                            {stationsLoading ? (
                              <div className="flex items-center justify-center p-4">
                                <span className="text-sm text-muted-foreground">Loading stations...</span>
                              </div>
                            ) : (
                              stations.map((station) => {
                                const customerCount = customers.filter(c => c.station?.id === station.id).length;
                                return (
                                  <CommandItem
                                    key={station.id}
                                    value={station.name}
                                    onSelect={() => {
                                      setSelectedStation(station.id);
                                      setStationCommandOpen(false);
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <Wifi className="h-4 w-4 mr-2" />
                                    <span>{station.name}</span>
                                    <Badge variant="secondary" className="ml-auto">
                                      {customerCount} customers
                                    </Badge>
                                  </CommandItem>
                                );
                              })
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {selectedStationDetails && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected Station:</h4>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStationDetails.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {stationCustomers.length} customers
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stationMessage" className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    Message Content
                  </Label>
                  <Textarea
                    id="stationMessage"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {message.length} characters
                    </p>
                    <Button
                      onClick={handleSendToStation}
                      disabled={!message || sendingBulkSms || !selectedStation}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {sendingBulkSms ? "Sending..." : "Send to Station"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}













