"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export function DateTimePicker({
  date,
  setDate,
}: {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date)
  const [hours, setHours] = useState<string>(date ? format(date, "HH") : "12")
  const [minutes, setMinutes] = useState<string>(date ? format(date, "mm") : "00")

  const handleDateChange = (newDate: Date | undefined) => {
    setSelectedDate(newDate)

    if (newDate) {
      const updatedDate = new Date(newDate)
      updatedDate.setHours(Number.parseInt(hours, 10))
      updatedDate.setMinutes(Number.parseInt(minutes, 10))
      setDate(updatedDate)
    } else {
      setDate(undefined)
    }
  }

  const handleTimeChange = (hours: string, minutes: string) => {
    if (selectedDate) {
      const updatedDate = new Date(selectedDate)
      updatedDate.setHours(Number.parseInt(hours, 10))
      updatedDate.setMinutes(Number.parseInt(minutes, 10))
      setDate(updatedDate)
    }
  }

  const handleHoursChange = (value: string) => {
    setHours(value)
    handleTimeChange(value, minutes)
  }

  const handleMinutesChange = (value: string) => {
    setMinutes(value)
    handleTimeChange(hours, value)
  }

  return (
    <div className="flex flex-col space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP p") : <span>Pick a date and time</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <div className="grid gap-1 text-center">
                <Label htmlFor="hours" className="text-xs">
                  Hours
                </Label>
                <Select value={hours} onValueChange={handleHoursChange}>
                  <SelectTrigger id="hours" className="w-[70px]">
                    <SelectValue placeholder="Hours" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 text-center">
                <Label htmlFor="minutes" className="text-xs">
                  Minutes
                </Label>
                <Select value={minutes} onValueChange={handleMinutesChange}>
                  <SelectTrigger id="minutes" className="w-[70px]">
                    <SelectValue placeholder="Minutes" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  const now = new Date()
                  setSelectedDate(now)
                  setHours(format(now, "HH"))
                  setMinutes(format(now, "mm"))
                  setDate(now)
                }}
              >
                <Clock className="mr-2 h-4 w-4" />
                Now
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function DateTimePickerDemo() {
  const [date, setDate] = useState<Date>()

  return (
    <div className="flex flex-col space-y-4 w-full max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold">Date and Time Picker</h2>
      <div className="grid gap-2">
        <Label htmlFor="datetime">Select Date and Time</Label>
        <DateTimePicker date={date} setDate={setDate} />
      </div>

      {date && (
        <div className="text-sm text-muted-foreground mt-2">
          Selected: <span className="font-medium text-foreground">{format(date, "PPP 'at' p")}</span>
        </div>
      )}
    </div>
  )
}

