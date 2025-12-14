import { RiArrowLeftLine, RiFileCopyLine, RiDownloadLine } from '@remixicon/react';

interface InspectorPanelProps {
  data?: {
    type: 'transcript' | 'insight' | 'content';
    title: string;
    content: string;
  };
}

export function InspectorPanel({ data }: InspectorPanelProps) {
  const inspector = data || {
    type: 'transcript' as const,
    title: 'Full Transcript',
    content: `[00:00] Sarah: Thanks for taking the time to meet with us today.

[00:15] John: Of course! I'm excited to learn more about your platform.

[00:22] Sarah: Great! Let's start with understanding your current challenges. What's the biggest pain point you're facing with your current analytics setup?

[00:35] John: Well, the main issue is that our data is scattered across multiple tools. We have customer data in Salesforce, product usage in Mixpanel, and financial data in QuickBooks. Getting a unified view is nearly impossible without manual work.

[01:02] Sarah: That's a common challenge we hear. How much time would you say your team spends on manual data consolidation?

[01:15] John: Honestly, probably 10-15 hours per week. And even then, we're not confident in the accuracy because there's so much room for human error.

[01:30] Sarah: That's significant. What would it mean for your business if you could eliminate that manual work?

[01:40] John: It would be huge. We could reallocate that time to actual analysis and decision-making instead of data wrangling. Plus, we'd have more confidence in our numbers.`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inspector.content);
  };

  const handleDownload = () => {
    const blob = new Blob([inspector.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inspector.title.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{inspector.title}</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
            {inspector.content}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <RiFileCopyLine size={16} />
          Copy
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <RiDownloadLine size={16} />
          Download
        </button>
      </div>
    </div>
  );
}
