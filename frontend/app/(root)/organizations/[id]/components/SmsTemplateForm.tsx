import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@apollo/client";
import { CREATE_SMS_TEMPLATE, UPDATE_SMS_TEMPLATE } from "@/graphql/sms_templates";
import { TemplateCategory } from "@/types/sms_template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";
import React from "react";

const schema = z.object({
  name: z.string().min(2),
  content: z.string().min(5),
  category: z.string(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const COMMON_VARIABLES = [
  "firstName",
  "lastName",
  "organizationName",
  "expirationDate",
  "packageName",
  "phoneNumber",
  "supportEmail",
  "amountDue",
  "dueDate",
  "paybillNumber",
  "username",
];

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  return Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, ""))));
}

export default function SmsTemplateForm({
  organizationId,
  onCreated,
  onCancel,
  template,
  onUpdated
}: {
  organizationId: string;
  onCreated?: () => void;
  onCancel?: () => void;
  template?: any;
  onUpdated?: () => void;
}) {
  const [createTemplate, { loading: creating }] = useMutation(CREATE_SMS_TEMPLATE);
  const [updateTemplate, { loading: updating }] = useMutation(UPDATE_SMS_TEMPLATE);
  const loading = creating || updating;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: template ? {
      name: template.name,
      content: template.content,
      category: template.category,
      description: template.description || "",
      isActive: template.isActive,
    } : {
      name: "",
      content: "",
      category: "CUSTOMER_ONBOARDING",
      description: "",
      isActive: true,
    },
  });

  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  // If template changes, reset form
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        content: template.content,
        category: template.category,
        description: template.description || "",
        isActive: template.isActive,
      });
    }
  }, [template]);

  const insertVariable = (variable: string) => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = form.getValues("content") || "";
    const before = value.substring(0, start);
    const after = value.substring(end);
    const newValue = `${before}{{${variable}}}${after}`;
    form.setValue("content", newValue, { shouldDirty: true });
    form.trigger("content");
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
    }, 0);
  };

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setSuccess(null);
    const variables = extractVariables(data.content);
    try {
      if (template) {
        // Update
        const res = await updateTemplate({
          variables: {
            templateId: template.id,
            organizationId,
            input: {
              name: data.name,
              content: data.content,
              category: data.category,
              description: data.description,
              variables,
              isActive: data.isActive,
            },
          },
        });
        if (res.data?.updateSmsTemplate?.success) {
          setSuccess("Template updated successfully");
          if (onUpdated) onUpdated();
        } else {
          setError(res.data?.updateSmsTemplate?.message || "Failed to update template");
        }
      } else {
        // Create
        const res = await createTemplate({
          variables: {
            organizationId,
            input: {
              name: data.name,
              content: data.content,
              category: data.category,
              description: data.description,
              variables,
              isActive: data.isActive,
            },
          },
        });
        if (res.data?.createSmsTemplate?.success) {
          setSuccess("Template created successfully");
          form.reset();
          if (onCreated) onCreated();
        } else {
          setError(res.data?.createSmsTemplate?.message || "Failed to create template");
        }
      }
    } catch (e: any) {
      setError(e.message || "Error saving template");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <Input {...form.register("name")}/>
        {form.formState.errors.name && <span className="text-xs text-red-500">{form.formState.errors.name.message}</span>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Content</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline">Insert Variable</Button>
            </PopoverTrigger>
            <PopoverContent className="p-2 w-48">
              <div className="flex flex-col gap-1">
                {COMMON_VARIABLES.map(v => (
                  <Button key={v} type="button" variant="ghost" className="justify-start" onClick={() => insertVariable(v)}>
                    {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Textarea
          rows={4}
          ref={contentRef}
          value={form.watch("content")}
          onChange={e => form.setValue("content", e.target.value, { shouldDirty: true })}
        />
        {form.formState.errors.content && <span className="text-xs text-red-500">{form.formState.errors.content.message}</span>}
        <div className="text-xs text-muted-foreground mt-1">Variables: {extractVariables(form.watch("content")).join(", ") || "None"}</div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <Select
          value={form.watch("category")}
          onValueChange={val => form.setValue("category", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(TemplateCategory).map((key) => (
              <SelectItem key={key} value={key}>
                {key.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.category && <span className="text-xs text-red-500">{form.formState.errors.category.message}</span>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Input {...form.register("description")}/>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={form.watch("isActive")} onCheckedChange={val => form.setValue("isActive", !!val)} id="isActive" />
        <label htmlFor="isActive" className="text-sm">Active</label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {template ? "Update Template" : "Create Template"}
        </Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>}
      </div>
    </form>
  );
} 