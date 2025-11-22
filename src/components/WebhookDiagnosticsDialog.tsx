import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiPulseLine, RiBarChartLine } from "@remixicon/react";
import WebhookAnalytics from "./WebhookAnalytics";
import WebhookDeliveryViewer from "./WebhookDeliveryViewer";

export default function WebhookDiagnosticsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hollow" size="sm">
          <RiPulseLine className="mr-2 h-4 w-4" />
          View Diagnostics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiBarChartLine className="h-5 w-5" />
            Webhook Diagnostics
          </DialogTitle>
          <DialogDescription>
            Monitor webhook delivery status, analytics, and troubleshoot sync issues
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="deliveries">Recent Deliveries</TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-4">
            <WebhookAnalytics />
          </TabsContent>
          
          <TabsContent value="deliveries" className="mt-4">
            <WebhookDeliveryViewer />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
