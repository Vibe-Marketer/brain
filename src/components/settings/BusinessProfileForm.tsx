/**
 * Business Profile Form
 *
 * 34-field form for AI content personalization with auto-save on blur.
 * Fields organized by category matching the database schema.
 */

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RiLoader2Line, RiCheckLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  BusinessProfile,
  BusinessProfileInput,
  ProductServiceDelivery,
  PrimaryDeliveryMethod,
  BusinessModel,
  PrimarySellingMechanism,
  PrimaryAdvertisingMode,
  PrimaryLeadGetter,
} from '@/types/content-hub';

interface BusinessProfileFormProps {
  profile: BusinessProfile;
  onUpdate: (id: string, updates: BusinessProfileInput) => Promise<BusinessProfile | null>;
  className?: string;
}

interface FieldState {
  saving: boolean;
  saved: boolean;
}

export function BusinessProfileForm({
  profile,
  onUpdate,
  className,
}: BusinessProfileFormProps) {
  // Track saving state per field
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  // Clear saved indicators after delay
  useEffect(() => {
    const savedFields = Object.entries(fieldStates).filter(([, state]) => state.saved);
    if (savedFields.length > 0) {
      const timeout = setTimeout(() => {
        setFieldStates((prev) => {
          const next = { ...prev };
          savedFields.forEach(([field]) => {
            if (next[field]) {
              next[field] = { ...next[field], saved: false };
            }
          });
          return next;
        });
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [fieldStates]);

  // Handle field blur - auto-save
  const handleFieldSave = useCallback(
    async (fieldName: keyof BusinessProfileInput, value: string | number | null) => {
      // Check if value has changed
      const currentValue = profile[fieldName as keyof BusinessProfile];
      if (value === currentValue) return;

      setFieldStates((prev) => ({
        ...prev,
        [fieldName]: { saving: true, saved: false },
      }));

      const result = await onUpdate(profile.id, { [fieldName]: value });

      if (result) {
        setFieldStates((prev) => ({
          ...prev,
          [fieldName]: { saving: false, saved: true },
        }));
      } else {
        setFieldStates((prev) => ({
          ...prev,
          [fieldName]: { saving: false, saved: false },
        }));
        toast.error('Failed to save changes');
      }
    },
    [profile, onUpdate]
  );

  // Field input component with auto-save
  const renderTextInput = (
    field: keyof BusinessProfileInput,
    label: string,
    placeholder?: string,
    type: 'text' | 'number' | 'url' = 'text'
  ) => {
    const value = profile[field as keyof BusinessProfile];
    const state = fieldStates[field] || { saving: false, saved: false };

    return (
      <div className="space-y-2">
        <Label htmlFor={field} className="flex items-center gap-2">
          {label}
          {state.saving && <RiLoader2Line className="h-3 w-3 animate-spin text-muted-foreground" />}
          {state.saved && <RiCheckLine className="h-3 w-3 text-green-600" />}
        </Label>
        <Input
          id={field}
          type={type}
          defaultValue={value as string | number | undefined}
          placeholder={placeholder}
          onBlur={(e) => {
            const newValue = type === 'number'
              ? e.target.value ? Number(e.target.value) : null
              : e.target.value || null;
            handleFieldSave(field, newValue);
          }}
        />
      </div>
    );
  };

  // Textarea component with auto-save
  const renderTextarea = (
    field: keyof BusinessProfileInput,
    label: string,
    placeholder?: string,
    rows = 3
  ) => {
    const value = profile[field as keyof BusinessProfile];
    const state = fieldStates[field] || { saving: false, saved: false };

    return (
      <div className="space-y-2">
        <Label htmlFor={field} className="flex items-center gap-2">
          {label}
          {state.saving && <RiLoader2Line className="h-3 w-3 animate-spin text-muted-foreground" />}
          {state.saved && <RiCheckLine className="h-3 w-3 text-green-600" />}
        </Label>
        <Textarea
          id={field}
          defaultValue={value as string | undefined}
          placeholder={placeholder}
          rows={rows}
          onBlur={(e) => handleFieldSave(field, e.target.value || null)}
        />
      </div>
    );
  };

  // Select component with auto-save
  const renderSelect = <T extends string>(
    field: keyof BusinessProfileInput,
    label: string,
    options: { value: T; label: string }[],
    placeholder?: string
  ) => {
    const value = profile[field as keyof BusinessProfile] as T | null;
    const state = fieldStates[field] || { saving: false, saved: false };

    return (
      <div className="space-y-2">
        <Label htmlFor={field} className="flex items-center gap-2">
          {label}
          {state.saving && <RiLoader2Line className="h-3 w-3 animate-spin text-muted-foreground" />}
          {state.saved && <RiCheckLine className="h-3 w-3 text-green-600" />}
        </Label>
        <Select
          defaultValue={value || undefined}
          onValueChange={(newValue) => handleFieldSave(field, newValue as T)}
        >
          <SelectTrigger id={field}>
            <SelectValue placeholder={placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  // Define select options
  const productServiceDeliveryOptions: { value: ProductServiceDelivery; label: string }[] = [
    { value: 'Software', label: 'Software' },
    { value: 'Info services', label: 'Info Services' },
    { value: 'Physical products', label: 'Physical Products' },
  ];

  const primaryDeliveryMethodOptions: { value: PrimaryDeliveryMethod; label: string }[] = [
    { value: 'DIY', label: 'DIY (Self-service)' },
    { value: 'Done with you', label: 'Done With You' },
    { value: 'Done for you', label: 'Done For You' },
  ];

  const businessModelOptions: { value: BusinessModel; label: string }[] = [
    { value: 'Low-volume high-ticket', label: 'Low-Volume High-Ticket' },
    { value: 'High-volume low-ticket', label: 'High-Volume Low-Ticket' },
    { value: 'One-time', label: 'One-Time' },
  ];

  const primarySellingMechanismOptions: { value: PrimarySellingMechanism; label: string }[] = [
    { value: 'In-person self-checkout', label: 'In-Person Self-Checkout' },
    { value: 'In-person salesperson', label: 'In-Person Salesperson' },
    { value: 'Online self-checkout', label: 'Online Self-Checkout' },
    { value: 'Online salesperson', label: 'Online Salesperson' },
  ];

  const primaryAdvertisingModeOptions: { value: PrimaryAdvertisingMode; label: string }[] = [
    { value: 'Warm outreach', label: 'Warm Outreach' },
    { value: 'Cold outreach', label: 'Cold Outreach' },
    { value: 'Free content', label: 'Free Content' },
    { value: 'Paid ads', label: 'Paid Ads' },
  ];

  const primaryLeadGetterOptions: { value: PrimaryLeadGetter; label: string }[] = [
    { value: 'Themselves or employees', label: 'Themselves or Employees' },
    { value: 'Referrals', label: 'Referrals' },
    { value: 'Agencies', label: 'Agencies' },
    { value: 'Affiliates', label: 'Affiliates' },
  ];

  return (
    <div className={cn('space-y-8', className)}>
      {/* Company & Product Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Company & Product
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTextInput('company_name', 'Company Name', 'Your company name')}
          {renderTextInput('website', 'Website', 'https://example.com', 'url')}
          {renderTextInput('industry', 'Industry', 'e.g., SaaS, E-commerce, Consulting')}
          {renderSelect('product_service_delivery', 'Product/Service Delivery', productServiceDeliveryOptions)}
        </div>
        <div className="mt-4">
          {renderTextarea('primary_product_service', 'Primary Product/Service', 'Describe your main offering...', 2)}
        </div>
      </section>

      <Separator />

      {/* Business Model & Operations Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Business Model & Operations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTextInput('employees_count', 'Number of Employees', 'e.g., 10', 'number')}
          {renderSelect('primary_delivery_method', 'Primary Delivery Method', primaryDeliveryMethodOptions)}
          {renderSelect('business_model', 'Business Model', businessModelOptions)}
          {renderSelect('primary_selling_mechanism', 'Primary Selling Mechanism', primarySellingMechanismOptions)}
        </div>
        <div className="mt-4">
          {renderTextarea('current_tech_status', 'Current Technology Stack', 'What tools and systems do you use?', 2)}
        </div>
      </section>

      <Separator />

      {/* Marketing & Sales Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Marketing & Sales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelect('primary_advertising_mode', 'Primary Advertising Mode', primaryAdvertisingModeOptions)}
          {renderSelect('primary_lead_getter', 'Primary Lead Source', primaryLeadGetterOptions)}
          {renderTextInput('primary_marketing_channel', 'Primary Marketing Channel', 'e.g., LinkedIn, Email, Webinars')}
          {renderTextInput('sales_cycle_length', 'Sales Cycle Length (days)', 'e.g., 30', 'number')}
          {renderTextInput('primary_social_platforms', 'Primary Social Platforms', 'e.g., LinkedIn, Twitter, Instagram')}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {renderTextarea('marketing_channels', 'All Marketing Channels', 'List all channels you use...', 2)}
          {renderTextarea('messaging_angles', 'Key Messaging Angles', 'Your main value propositions and positioning...', 2)}
        </div>
      </section>

      <Separator />

      {/* Customer Acquisition & Onboarding Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Customer Acquisition & Onboarding
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {renderTextarea('customer_acquisition_process', 'Customer Acquisition Process', 'How do prospects become customers?', 3)}
          {renderTextarea('customer_onboarding_process', 'Customer Onboarding Process', 'How do you onboard new customers?', 3)}
        </div>
      </section>

      <Separator />

      {/* Customer Insights Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Customer Insights
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {renderTextarea('icp_customer_segments', 'Ideal Customer Profile (ICP)', 'Describe your ideal customer segments or buyer personas...', 3)}
          {renderTextarea('primary_pain_points', 'Primary Pain Points', 'What problems do your customers face?', 3)}
          {renderTextarea('top_objections', 'Top Objections', 'What objections do you commonly hear?', 3)}
          {renderTextarea('top_decision_drivers', 'Top Decision Drivers', 'What drives customers to buy?', 3)}
        </div>
      </section>

      <Separator />

      {/* Value Proposition Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Value Proposition
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {renderTextarea('value_prop_differentiators', 'Key Differentiators', 'What makes you different from competitors?', 3)}
          {renderTextarea('proof_assets_social_proof', 'Proof Assets & Social Proof', 'Testimonials, case studies, certifications...', 3)}
        </div>
      </section>

      <Separator />

      {/* Offers & Products Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Offers & Products
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderTextInput('average_order_value', 'Average Order Value ($)', 'e.g., 2500', 'number')}
          {renderTextInput('customer_average_order_value', 'Customer AOV ($)', 'e.g., 5000', 'number')}
          {renderTextInput('customer_lifetime_value', 'Customer Lifetime Value ($)', 'e.g., 15000', 'number')}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {renderTextarea('guarantees', 'Guarantees', 'Any guarantees you offer...', 2)}
          {renderTextarea('promotions_offers', 'Current Promotions & Offers', 'Active promotions or offer packages...', 2)}
          {renderTextarea('other_products', 'Other Products', 'High-ticket, mid-ticket, low-ticket offerings...', 2)}
        </div>
      </section>

      <Separator />

      {/* Brand & Voice Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Brand & Voice
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {renderTextarea('brand_voice', 'Brand Voice', 'Describe your brand tone and personality...', 3)}
          {renderTextarea('prohibited_terms', 'Prohibited Terms', 'Words or phrases to avoid in content...', 2)}
          {renderTextarea('common_sayings_trust_signals', 'Common Sayings & Trust Signals', 'Phrases you commonly use that build trust...', 2)}
        </div>
      </section>

      <Separator />

      {/* Growth Section */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Growth
        </h3>
        {renderTextarea('biggest_growth_constraint', 'Biggest Growth Constraint', 'What is your biggest barrier to growth?', 3)}
      </section>
    </div>
  );
}

export default BusinessProfileForm;
