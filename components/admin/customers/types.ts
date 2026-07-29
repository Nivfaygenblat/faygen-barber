export type Customer = {
  id: string;

  full_name: string;

  phone: string;

  notes: string | null;

  first_visit: string | null;

  last_visit: string | null;

  next_visit: string | null;

  total_appointments: number;

  completed_appointments: number;

  cancelled_appointments: number;

  pending_appointments: number;

  total_spent: number;

  created_at: string;

  updated_at: string;
};