"use client";
import { motion } from "motion/react";
import { 
  Users, Network, CreditCard, Headphones, 
  BarChart2, Shield 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Users,
    title: "Customer Management",
    description: "Efficiently manage customer profiles, subscriptions, and service history.",
    badge: "Core Feature"
  },
  {
    icon: Network,
    title: "Network Monitoring",
    description: "Real-time monitoring of your network infrastructure and performance.",
    badge: "Real-time"
  },
  {
    icon: CreditCard,
    title: "Billing & Invoicing",
    description: "Automated billing system with multiple payment gateway integrations.",
    badge: "Automated"
  },
  {
    icon: Headphones,
    title: "Support Ticketing",
    description: "Streamlined customer support with integrated ticketing system.",
    badge: "24/7 Support"
  },
  {
    icon: BarChart2,
    title: "Analytics & Reports",
    description: "Comprehensive reporting tools for business insights and decision making.",
    badge: "Analytics"
  },
  {
    icon: Shield,
    title: "Security",
    description: "Enterprise-grade security features to protect your business data.",
    badge: "Enterprise"
  }
];

export function Features() {
  return (
    <section className="relative py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
      <div className="container relative mx-auto max-w-7xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <Badge 
            variant="secondary" 
            className="mb-4"
          >
            Features
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-custom bg-clip-text text-transparent">
            Powerful Features for Modern ISPs
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Everything you need to manage and grow your ISP business efficiently
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={cn(
                "relative group h-full p-6 hover:shadow-xl transition-all duration-300",
                "before:absolute before:inset-0 before:rounded-xl",
                "before:bg-gradient-to-b before:from-transparent before:to-muted/10",
                "hover:before:to-muted/20 before:transition-colors"
              )}>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="h-6">
                      {feature.badge}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {feature.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
