export type PublicQueue = {
  id: string;
  name: string;
  is_open: boolean;
  waiting_count: number;
  est_wait_minutes: number;
};

export type PublicBusiness = {
  name: string;
  kind: "clinic" | "barber" | "lab" | "other";
  queues: PublicQueue[];
};

export type TicketStatusValue = "waiting" | "serving" | "done" | "skipped" | "cancelled";

export type TicketStatus = {
  ticket_no: number;
  status: TicketStatusValue;
  customer_name: string;
  queue_id: string;
  queue_name: string;
  business_name: string;
  serving_no: number | null;
  people_ahead: number;
  avg_minutes: number;
  est_wait_minutes: number;
};

/** الحمولة اللي بيبثها _broadcast_queue: أرقام فقط بدون بيانات شخصية */
export type QueueBroadcast = {
  serving_no: number | null;
  waiting_nos: number[];
  avg_minutes: number;
};

// ---- صفحات صاحب النشاط ----
export type Business = {
  id: string;
  name: string;
  slug: string;
  kind: "clinic" | "barber" | "lab" | "other";
  is_active: boolean;
};

export type QueueRow = {
  id: string;
  business_id: string;
  name: string;
  is_open: boolean;
  avg_service_minutes: number;
  control_token: string;
};

export type ControlTicket = { id: string; ticket_no: number; name: string; phone: string };

export type ControlState = {
  queue: { id: string; name: string; is_open: boolean; avg_minutes: number };
  serving: (ControlTicket & { started_at: string }) | null;
  waiting: ControlTicket[];
};
