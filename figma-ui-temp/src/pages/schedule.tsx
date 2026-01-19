import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebPageHeader } from "../components/web/page-header"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

export default function SchedulePage() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const currentWeek = [
    { day: "Mon", date: 13, jobs: 5 },
    { day: "Tue", date: 14, jobs: 7 },
    { day: "Wed", date: 15, jobs: 4 },
    { day: "Thu", date: 16, jobs: 6 },
    { day: "Fri", date: 17, jobs: 8 },
    { day: "Sat", date: 18, jobs: 3 },
    { day: "Sun", date: 19, jobs: 0 },
  ]

  const mockScheduledJobs = [
    {
      id: "1",
      time: "8:00 AM",
      customer: "Green Acres HOA",
      service: "Lawn Mowing",
      crew: "Crew A",
      status: "scheduled",
    },
    {
      id: "2",
      time: "10:00 AM",
      customer: "Smith Residence",
      service: "Spring Cleanup",
      crew: "Crew B",
      status: "in-progress",
    },
    {
      id: "3",
      time: "1:00 PM",
      customer: "Downtown Office Park",
      service: "Edging & Trimming",
      crew: "Crew A",
      status: "scheduled",
    },
  ]

  return (
    <WebAppShell pageTitle="Schedule" userRole="USER">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Schedule"
          subtitle="Manage job schedules and crew assignments"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Schedule" },
          ]}
          actions={
            <WebButton variant="primary">
              <Calendar className="w-4 h-4 mr-2" />
              Add to Schedule
            </WebButton>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl space-y-6">
            {/* Week Navigation */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <WebButton variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4" />
                </WebButton>
                <h2 className="text-lg font-semibold">Week of January 13, 2026</h2>
                <WebButton variant="ghost" size="sm">
                  <ChevronRight className="w-4 h-4" />
                </WebButton>
              </div>

              {/* Week View */}
              <div className="grid grid-cols-7 gap-2 mt-4">
                {currentWeek.map((day) => (
                  <div
                    key={day.date}
                    className={`
                      p-4 rounded-lg text-center cursor-pointer transition-colors
                      ${
                        day.date === 13
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent"
                      }
                    `}
                  >
                    <div className="text-sm font-medium mb-1">{day.day}</div>
                    <div className="text-2xl font-semibold mb-2">{day.date}</div>
                    {day.jobs > 0 && (
                      <div className="text-xs">
                        {day.jobs} {day.jobs === 1 ? "job" : "jobs"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-card border border-border rounded-lg">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold">Today's Schedule - Monday, Jan 13</h2>
              </div>
              <div className="divide-y divide-border">
                {mockScheduledJobs.map((job) => (
                  <div key={job.id} className="p-6 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div className="text-sm font-medium text-muted-foreground w-20">
                          {job.time}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{job.customer}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{job.service}</p>
                          <div className="flex items-center gap-2">
                            <WebBadge variant="status" status={job.status as "scheduled" | "in-progress"}>
                              {job.status}
                            </WebBadge>
                            <span className="text-sm text-muted-foreground">{job.crew}</span>
                          </div>
                        </div>
                      </div>
                      <WebButton variant="secondary" size="sm">
                        View Details
                      </WebButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WebAppShell>
  )
}
