import type { InstructorTaxStatus } from "@prisma/client";

export type ClientCheckoutInstructorSummary = {
  id: string;
  name: string | null;
  hourlyRate: number;
  taxStatus?: InstructorTaxStatus | null;
};
