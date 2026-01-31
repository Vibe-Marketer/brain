/**
 * Contacts Tab for Settings Page
 * Wrapper for ContactsTable to be used in the Settings layout
 */

import * as React from "react";
import { ContactsTable } from "@/components/contacts/ContactsTable";

export default function ContactsTab() {
  return (
    <div className="h-full">
      <ContactsTable />
    </div>
  );
}
