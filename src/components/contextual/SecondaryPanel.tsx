import { RiCloseLine, RiPushpinLine, RiPushpin2Line, RiArrowLeftLine } from '@remixicon/react';
import { usePanelStore, PanelType } from '@/stores/panelStore';
import { WorkspaceDetailPanel } from './panels/WorkspaceDetailPanel';
import { CallDetailPanel } from './panels/CallDetailPanel';
import { InsightDetailPanel } from './panels/InsightDetailPanel';
import { FilterToolPanel } from './panels/FilterToolPanel';
import { AIAssistantPanel } from './panels/AIAssistantPanel';
import { InspectorPanel } from './panels/InspectorPanel';

interface SecondaryPanelProps {
  type: PanelType;
  data: any;
  isPinned: boolean;
}

export function SecondaryPanel({ type, data, isPinned }: SecondaryPanelProps) {
  const { closePanel, togglePin, goBack, panelHistory } = usePanelStore();

  const getPanelTitle = () => {
    switch (type) {
      case 'workspace-detail': return 'Workspace';
      case 'call-detail': return 'Call Details';
      case 'insight-detail': return 'Insight';
      case 'filter-tool': return 'Filters';
      case 'ai-assistant': return 'AI Assistant';
      case 'inspector': return 'Inspector';
      default: return 'Panel';
    }
  };

  const renderPanelContent = () => {
    switch (type) {
      case 'workspace-detail':
        return <WorkspaceDetailPanel data={data} />;
      case 'call-detail':
        return <CallDetailPanel data={data} />;
      case 'insight-detail':
        return <InsightDetailPanel data={data} />;
      case 'filter-tool':
        return <FilterToolPanel data={data} />;
      case 'ai-assistant':
        return <AIAssistantPanel data={data} />;
      case 'inspector':
        return <InspectorPanel data={data} />;
      default:
        return <div className="p-4 text-gray-500">No content</div>;
    }
  };

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Panel Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          {/* Back button if history exists */}
          {panelHistory.length > 0 && (
            <button
              onClick={goBack}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Go back"
            >
              <RiArrowLeftLine size={18} className="text-gray-600" />
            </button>
          )}
          
          <h2 className="text-sm font-semibold text-gray-900">
            {getPanelTitle()}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin button */}
          <button
            onClick={togglePin}
            className={`
              p-1 rounded transition-colors
              ${isPinned 
                ? 'bg-purple-100 text-purple-600' 
                : 'hover:bg-gray-100 text-gray-600'
              }
            `}
            title={isPinned ? 'Unpin panel' : 'Pin panel'}
          >
            {isPinned ? (
              <RiPushpin2Line size={18} />
            ) : (
              <RiPushpinLine size={18} />
            )}
          </button>

          {/* Close button */}
          <button
            onClick={closePanel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close panel"
          >
            <RiCloseLine size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {renderPanelContent()}
      </div>
    </div>
  );
}
