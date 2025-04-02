"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@apollo/client";
import { GET_PLANS } from "@/graphql/plan";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Define the type based on the backend schema
type Plan = {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: {
    success: boolean;
    message: string;
    plans: Plan[];
  };
};

const Page = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const { loading, error, data } = useQuery<PlansResponse>(GET_PLANS);

  // Calculate yearly price (20% discount)
  const getPrice = (price: number) => {
    if (billingCycle === "yearly") {
      return (price * 12 * 0.8).toFixed(2);
    }
    return price.toFixed(2);
  };

  if (error) {
    toast.error("Failed to load pricing plans");
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500">
          Failed to load pricing plans. Please try again later.
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-16">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-10 w-24 mb-6" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const plans = data?.plans.plans || [];

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient-custom">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect plan for your needs. All plans include a 14-day
          free trial.
        </p>

        <div className="flex items-center justify-center mt-8 space-x-2">
          <Label
            htmlFor="billing-toggle"
            className={
              billingCycle === "monthly"
                ? "font-medium"
                : "text-muted-foreground"
            }
          >
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === "yearly"}
            onCheckedChange={(checked) =>
              setBillingCycle(checked ? "yearly" : "monthly")
            }
            className="bg-gradient-custom2"
          />
          <Label
            htmlFor="billing-toggle"
            className={
              billingCycle === "yearly"
                ? "font-medium"
                : "text-muted-foreground"
            }
          >
            Yearly{" "}
            <span className="text-gradient-custom text-sm font-medium">Save 20%</span>
          </Label>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <Card
            key={plan.id}
            className={`flex flex-col glow backdrop-blur-sm ${
              index === 1 ? "border-primary shadow-lg relative" : ""
            }`}
          >
            {index === 1 && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-gradient-custom text-primary-foreground text-sm font-medium py-1 px-3 rounded-full">
                  Most Popular
                </span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl text-gradient-custom2">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold text-gradient-custom2">
                  {plan.currency === "USD" ? "$" : plan.currency}
                  {getPrice(plan.price)}
                </span>
                <span className="text-muted-foreground ml-2">
                  /{billingCycle === "monthly" ? "month" : "year"}
                </span>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-pink-500 mr-2 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant={index === 1 ? "default" : "outline"}
                className={`w-full text-white hover:text-white ${index === 1 ? 'bg-gradient-custom' : 'bg-gradient-custom2'}`}
              >
                Get Started
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          Need a custom solution?{" "}
          <a href="#" className="text-gradient-custom font-medium hover:underline underline-offset-4">
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
};

export default Page;
