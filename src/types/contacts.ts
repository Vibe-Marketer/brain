/**
 * Contact Database Types
 * Types for the contacts database feature (DIFF-04)
 */

/** Contact type classification */
export type ContactType = 'client' | 'customer' | 'lead' | 'other';

/**
 * Contact record - represents a person derived from call attendees
 */
export interface Contact {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  
  /** Whether to monitor this contact for health alerts */
  track_health: boolean;
  
  /** Classification: client, customer, lead, or other */
  contact_type: ContactType | null;
  
  /** When this contact was last seen on a call */
  last_seen_at: string | null;
  
  /** Recording ID of the most recent call with this contact */
  last_call_recording_id: number | null;
  
  /** Custom days threshold for health alerts (null = use global default) */
  health_alert_threshold_days: number | null;
  
  /** Last time a health alert was sent for this contact */
  last_alerted_at: string | null;
  
  /** Free-form notes about the contact */
  notes: string | null;
  
  /** Tags for categorization */
  tags: string[] | null;
  
  created_at: string;
  updated_at: string;
}

/**
 * Contact call appearance - junction table entry linking contact to call
 */
export interface ContactCallAppearance {
  contact_id: string;
  recording_id: number;
  user_id: string;
  appeared_at: string | null;
}

/**
 * User contact settings - global preferences for contact tracking
 */
export interface UserContactSettings {
  user_id: string;
  
  /** When true, auto-import attendees from all calls */
  track_all_contacts: boolean;
  
  /** Default days before health alert for contacts */
  default_health_threshold_days: number;
  
  created_at?: string;
  updated_at?: string;
}

/**
 * Contact with computed call count (for display)
 */
export interface ContactWithCallCount extends Contact {
  call_count: number;
}

/**
 * Create contact input
 */
export interface CreateContactInput {
  email: string;
  name?: string | null;
  contact_type?: ContactType | null;
  track_health?: boolean;
  notes?: string | null;
  tags?: string[] | null;
}

/**
 * Update contact input
 */
export interface UpdateContactInput {
  name?: string | null;
  contact_type?: ContactType | null;
  track_health?: boolean;
  health_alert_threshold_days?: number | null;
  notes?: string | null;
  tags?: string[] | null;
}
