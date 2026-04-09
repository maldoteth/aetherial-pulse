/**
 * Fansite Reports — Supabase-backed
 */
import { supabase } from '@/integrations/supabase/client';

export interface DeHubReport {
  id: string; tokenId: number; reporterId: string; reason: string;
  description?: string; status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string; updatedAt?: string;
}
export interface ReportSubmission { tokenId: number; reason: string; description?: string; }
export interface ReportReason { id: string; label: string; description?: string; }

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

export async function getAllReports(): Promise<DeHubReport[]> { return []; }

export async function getReportsForNFT(tokenId: number | string): Promise<DeHubReport[]> { return []; }

export async function submitReport(data: ReportSubmission): Promise<{ success: boolean; reportId?: string; message?: string }> {
  return reportContent({ tokenId: data.tokenId, reason: data.reason, description: data.description });
}

export async function getContentReportStatus(tokenId: number | string): Promise<{ reported: boolean }> {
  const myAddr = getWallet();
  if (!myAddr) return { reported: false };
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_address', myAddr)
    .eq('target_type', 'post')
    .eq('target_id', String(tokenId))
    .maybeSingle();
  return { reported: !!data };
}

export async function getUserReportStatus(userId: string): Promise<{ reported: boolean }> {
  const myAddr = getWallet();
  if (!myAddr) return { reported: false };
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_address', myAddr)
    .eq('target_type', 'user')
    .eq('target_id', userId.toLowerCase())
    .maybeSingle();
  return { reported: !!data };
}

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
  const myAddr = getWallet();
  if (!myAddr) return { success: false, message: 'Not authenticated' };

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_address: myAddr,
      target_type: 'post',
      target_id: String(params.tokenId),
      reason: params.reason,
      description: params.description,
    });

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Report submitted' };
}

export async function reportUser(params: { userId: string; reason: string; description?: string }): Promise<{ success: boolean; message?: string }> {
  const myAddr = getWallet();
  if (!myAddr) return { success: false, message: 'Not authenticated' };

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_address: myAddr,
      target_type: 'user',
      target_id: params.userId.toLowerCase(),
      reason: params.reason,
      description: params.description,
    });

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Report submitted' };
}
