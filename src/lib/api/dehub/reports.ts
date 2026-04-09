/**
 * Fansite Reports — Stub
 */

export interface DeHubReport {
  id: string; tokenId: number; reporterId: string; reason: string;
  description?: string; status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string; updatedAt?: string;
}
export interface ReportSubmission { tokenId: number; reason: string; description?: string; }
export interface ReportReason { id: string; label: string; description?: string; }

export async function getAllReports(): Promise<DeHubReport[]> { return []; }
export async function getReportsForNFT(tokenId: number | string): Promise<DeHubReport[]> { return []; }
export async function submitReport(data: ReportSubmission): Promise<{ success: boolean; reportId?: string; message?: string }> {
  return { success: true, message: 'Report submitted' };
}
export async function getContentReportStatus(tokenId: number | string): Promise<{ reported: boolean }> { return { reported: false }; }
export async function getUserReportStatus(userId: string): Promise<{ reported: boolean }> { return { reported: false }; }
export async function getContentReportReasons(): Promise<ReportReason[]> {
  return [
    { id: 'spam', label: 'Spam' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'inappropriate', label: 'Inappropriate Content' },
    { id: 'copyright', label: 'Copyright Violation' },
    { id: 'other', label: 'Other' },
  ];
}
export async function getUserReportReasons(): Promise<ReportReason[]> {
  return [
    { id: 'spam', label: 'Spam' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'impersonation', label: 'Impersonation' },
    { id: 'other', label: 'Other' },
  ];
}
export async function reportContent(params: { tokenId: number; reason: string; description?: string }): Promise<{ success: boolean; message?: string }> {
  return { success: true, message: 'Report submitted' };
}
export async function reportUser(params: { userId: string; reason: string; description?: string }): Promise<{ success: boolean; message?: string }> {
  return { success: true, message: 'Report submitted' };
}
