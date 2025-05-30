import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "ISP Dashboard",
  description: "Overview of your ISP business metrics",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
