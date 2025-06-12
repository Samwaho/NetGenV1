"use client";
import { motion } from "motion/react";
import { Star, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Chief Executive Officer",
    image: "/testimonials/avatar1.jpg",
    content: "ISPinnacle has transformed how we manage our ISP operations. The customer management and billing features have saved us countless hours.",
    rating: 5,
    company: "TechNet ISP"
  },
  {
    name: "David Chen",
    role: "Chief Technology Officer",
    image: "/testimonials/avatar2.jpg",
    content: "The network monitoring capabilities are outstanding. We can now proactively address issues before they affect our customers.",
    rating: 5,
    company: "ConnectFast"
  },
  {
    name: "Maria Rodriguez",
    role: "Operations Manager",
    image: "/testimonials/avatar3.jpg",
    content: "Excellent support and regular updates. The platform keeps getting better, and our team loves using it.",
    rating: 5,
    company: "LinkWave"
  }
];

export function Testimonials() {
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
            Testimonials
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-custom bg-clip-text text-transparent">
            Trusted by ISPs Worldwide
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            See what our customers have to say about their experience with NetGen
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
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
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star 
                          key={i} 
                          className="h-5 w-5 fill-primary text-primary" 
                        />
                      ))}
                    </div>
                    <Quote className="h-6 w-6 text-primary/20" />
                  </div>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </p>

                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold group-hover:text-primary transition-colors truncate">
                        {testimonial.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground truncate">
                          {testimonial.role}
                        </p>
                        <span className="text-muted-foreground/50">•</span>
                        <p className="text-sm text-muted-foreground truncate">
                          {testimonial.company}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

