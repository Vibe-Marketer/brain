import { Button } from "@/components/ui/button";
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiQuestionLine,
  RiUserLine,
  RiTimeLine,
  RiMailLine,
  RiLockLine,
  RiTeamLine,
  RiMoneyDollarCircleLine,
  RiPlugLine,
  RiRobot2Line,
  RiAdminLine,
} from "@remixicon/react";
import { usePanelStore } from "@/stores/panelStore";

export type SettingHelpTopic =
  | "profile"
  | "preferences"
  | "password"
  | "users"
  | "billing"
  | "integrations"
  | "ai"
  | "admin"
  | "display-name"
  | "timezone"
  | "fathom-email";

interface HelpContent {
  title: string;
  icon: React.ReactNode;
  description: string;
  tips?: string[];
  learnMoreUrl?: string;
}

const helpContent: Record<SettingHelpTopic, HelpContent> = {
  profile: {
    title: "Profile Settings",
    icon: <RiUserLine className="h-5 w-5" />,
    description: "Your profile settings control how you appear to others and your personal information.",
    tips: [
      "Your display name is shown to team members and in call recordings",
      "Email address is used for account login and notifications",
      "Profile changes take effect immediately",
    ],
  },
  "display-name": {
    title: "Display Name",
    icon: <RiUserLine className="h-5 w-5" />,
    description: "Your display name is how you appear to other team members and in call recordings.",
    tips: [
      "Use your full name for easy recognition",
      "This name appears in call transcripts and insights",
      "Team members will see this name in shared workspaces",
    ],
  },
  preferences: {
    title: "Preferences",
    icon: <RiTimeLine className="h-5 w-5" />,
    description: "Customize your experience with timezone and email settings.",
    tips: [
      "Timezone affects how call times are displayed throughout the app",
      "Setting the correct timezone ensures accurate scheduling",
    ],
  },
  timezone: {
    title: "Timezone",
    icon: <RiTimeLine className="h-5 w-5" />,
    description: "Your timezone determines how dates and times are displayed in the application.",
    tips: [
      "Call timestamps will be shown in your selected timezone",
      "This affects calendar integrations and scheduling",
      "Set this to your primary working timezone for accuracy",
    ],
  },
  "fathom-email": {
    title: "Fathom Email",
    icon: <RiMailLine className="h-5 w-5" />,
    description: "The email address associated with your Fathom account for call recording integration.",
    tips: [
      "This email is used to identify your calls from Fathom recordings",
      "Make sure this matches the email you use to join calls",
      "Calls are automatically linked when the email matches",
    ],
  },
  password: {
    title: "Password",
    icon: <RiLockLine className="h-5 w-5" />,
    description: "Keep your account secure by using a strong, unique password.",
    tips: [
      "Use at least 8 characters with a mix of letters, numbers, and symbols",
      "Don't reuse passwords from other accounts",
      "Consider using a password manager for better security",
    ],
  },
  users: {
    title: "Team Users",
    icon: <RiTeamLine className="h-5 w-5" />,
    description: "Manage your team members and their access to the platform.",
    tips: [
      "Invite team members by email to collaborate",
      "Assign appropriate roles based on responsibilities",
      "Remove users who no longer need access",
      "Team members can share workspaces and insights",
    ],
  },
  billing: {
    title: "Billing & Subscription",
    icon: <RiMoneyDollarCircleLine className="h-5 w-5" />,
    description: "Manage your subscription, payment methods, and billing history.",
    tips: [
      "View your current plan and usage",
      "Upgrade to access more features and team members",
      "Update payment methods before they expire",
      "Download invoices for your records",
    ],
  },
  integrations: {
    title: "Integrations",
    icon: <RiPlugLine className="h-5 w-5" />,
    description: "Connect external services to enhance your workflow.",
    tips: [
      "Fathom integration enables automatic call import",
      "Calendar integrations help track scheduled calls",
      "CRM integrations sync customer data automatically",
      "Disconnect integrations you no longer use",
    ],
  },
  ai: {
    title: "AI Settings",
    icon: <RiRobot2Line className="h-5 w-5" />,
    description: "Configure how AI processes and analyzes your calls.",
    tips: [
      "AI insights are generated automatically from call transcripts",
      "Customize AI prompts for more relevant insights",
      "AI tagging helps organize calls automatically",
      "Review AI suggestions to improve accuracy over time",
    ],
  },
  admin: {
    title: "Admin Settings",
    icon: <RiAdminLine className="h-5 w-5" />,
    description: "Administrative controls for managing the organization.",
    tips: [
      "Only visible to users with admin privileges",
      "Manage organization-wide settings and policies",
      "View usage analytics and audit logs",
      "Configure security and compliance settings",
    ],
  },
};

interface SettingHelpPanelProps {
  topic?: SettingHelpTopic;
}

export function SettingHelpPanel({ topic = "profile" }: SettingHelpPanelProps) {
  const { closePanel, togglePin, isPinned } = usePanelStore();

  const content = helpContent[topic] || helpContent.profile;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cb-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
            {content.icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-cb-ink truncate">{content.title}</h3>
            <p className="text-xs text-cb-ink-muted">Help & Tips</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            title={isPinned ? "Unpin panel" : "Pin panel"}
          >
            {isPinned ? (
              <RiPushpinFill className="h-4 w-4 text-cb-ink" />
            ) : (
              <RiPushpinLine className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={closePanel} title="Close panel">
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RiQuestionLine className="h-4 w-4 text-cb-ink-muted" />
            <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
              About
            </h4>
          </div>
          <p className="text-sm text-cb-ink leading-relaxed">
            {content.description}
          </p>
        </div>

        {/* Tips */}
        {content.tips && content.tips.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
              Tips & Best Practices
            </h4>
            <ul className="space-y-2">
              {content.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-cb-ink-muted">
                  <span className="w-5 h-5 rounded-full bg-cb-accent/10 text-cb-accent flex items-center justify-center flex-shrink-0 text-xs font-medium mt-0.5">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Help Section */}
        <div className="space-y-3 pt-4 border-t border-cb-border">
          <h4 className="text-xs font-semibold text-cb-ink-soft uppercase tracking-wide">
            Need More Help?
          </h4>
          <div className="bg-cb-card rounded-lg p-3 border border-cb-border">
            <p className="text-sm text-cb-ink-muted">
              If you need additional assistance with this setting, please contact our support team
              or visit our documentation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingHelpPanel;
