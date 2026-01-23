import { pdf } from '@react-pdf/renderer';
import { QueryIntelligenceReport } from '@/components/moonbug/reports/QueryIntelligenceReport';
import { gatherReportData, type QueryIntelligenceReportData } from './gather-report-data';

/**
 * Generates and downloads the Query Intelligence PDF report
 */
export async function exportIntelligenceReport(
  intelligenceState: {
    detectedTopic?: any;
    primaryQuery?: any;
    intelligence?: any;
    suggestions?: any[];
    intentSummary?: any;
    gaps?: any;
    entities?: any;
  },
  existingQueries: string[] = []
): Promise<void> {
  // Gather data from state
  const reportData = gatherReportData(intelligenceState, existingQueries);
  
  // Generate PDF blob
  const blob = await pdf(<QueryIntelligenceReport data={reportData} />).toBlob();
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `query-intelligence-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type { QueryIntelligenceReportData };
