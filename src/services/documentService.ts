import apiClient from './api';
import jsPDF from 'jspdf';
import type {
  DocumentResponse,
  DocumentsResponse,
  AnalyticsResponse,
  LegalModelsStatus
} from '../types/document';
import { getDocumentTypeLabel } from '@/utils/helpers';

export class DocumentService {
  // Upload document
  async uploadDocument(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<DocumentResponse> {
    return apiClient.uploadFile<DocumentResponse>(
      '/upload-document',
      file,
      onProgress
    );
  }

  // Get all documents
  async getDocuments(): Promise<DocumentsResponse> {
    return apiClient.get<DocumentsResponse>('/documents');
  }

  // Get specific document
  async getDocument(documentId: string): Promise<DocumentResponse> {
    return apiClient.get<DocumentResponse>(`/document/${documentId}`);
  }

  // Delete document
  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/document/${documentId}`);
  }

  // Get suggested questions
  async getSuggestedQuestions(documentId: string): Promise<{ questions: string[]; document_id: string }> {
    return apiClient.get<{ questions: string[]; document_id: string }>(`/suggest-questions/${documentId}`);
  }

  // Get analytics
  async getAnalytics(): Promise<AnalyticsResponse> {
    return apiClient.get<AnalyticsResponse>('/analytics');
  }

  // Get legal models status
  async getLegalModelsStatus(): Promise<LegalModelsStatus> {
    return apiClient.get<LegalModelsStatus>('/legal-models/status');
  }

  // Export comprehensive report as PDF
  async exportReport(documentId: string): Promise<{
    blob: Blob;
    filename: string;
    document_id: string;
    generated_at: string;
  }> {
    console.log('DocumentService: Starting PDF export for document:', documentId);

    try {
      // Get document details for report generation
      console.log('DocumentService: Fetching document details for PDF report');
      const document = await this.getDocument(documentId);
      const now = new Date().toISOString();

      console.log('DocumentService: Generating PDF report');

      // Create new PDF document
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to check if we need a new page
      const checkNewPage = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Helper function to add text with word wrapping
      const addWrappedText = (text: string, fontSize: number = 12, isBold: boolean = false, indent: number = 0) => {
        pdf.setFontSize(fontSize);
        if (isBold) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }

        const textWidth = maxWidth - indent;
        const lines = pdf.splitTextToSize(text, textWidth);
        const lineHeight = fontSize * 0.35; // Much tighter line spacing
        const totalHeight = lines.length * lineHeight + 3; // Minimal spacing after text
        
        // Check if we need a new page
        checkNewPage(totalHeight);

        pdf.text(lines, margin + indent, yPosition);
        yPosition += totalHeight;
      };

      // Improved helper function to add list items with proper formatting
      const addListItem = (text: string, index: number, fontSize: number = 12) => {
        const indent = 10; // Consistent left alignment
        
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'normal');
        
        const numberedText = `${index}. ${text}`;
        const textWidth = maxWidth - indent;
        const lines = pdf.splitTextToSize(numberedText, textWidth);
        const lineHeight = fontSize * 0.35; // Tight line height matching text
        const totalHeight = lines.length * lineHeight + 4; // Minimal spacing between items
        
        // Check if we need a new page
        checkNewPage(totalHeight);

        // Add the text with consistent left alignment
        pdf.text(lines, margin + indent, yPosition);
        yPosition += totalHeight;
      };

      // Helper function to add section spacing
      const addSection = (spacing: number = 8) => {
        yPosition += spacing;
        checkNewPage(spacing);
      };

      // Helper function to add a horizontal line
      const addHorizontalLine = () => {
        checkNewPage(15);
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;
      };

      // Title
      addWrappedText('LEGAL DOCUMENT ANALYSIS REPORT', 18, true);
      addHorizontalLine();

      // Document info - more compact
      addWrappedText(`Document: ${document.filename}`, 12, true);
      addWrappedText(`Generated: ${new Date().toLocaleString()}`);
      addWrappedText(`Document Type : ${getDocumentTypeLabel(document.document_type)}`);
      addSection(10);

      // Executive Summary
      addWrappedText('EXECUTIVE SUMMARY', 14, true);
      addWrappedText(document.summary);
      addSection(10);

      // Key Terms & Obligations
      addWrappedText('KEY TERMS & OBLIGATIONS', 14, true);
      if (document.key_clauses && document.key_clauses.length > 0) {
        document.key_clauses.forEach((clause, i) => {
          addListItem(clause, i + 1);
        });
      } else {
        addWrappedText('No key clauses identified.');
      }
      addSection(10);

      // Red Flags & Concerns - FIXED SECTION
      addWrappedText('RED FLAGS & CONCERNS', 14, true);
      if (document.red_flags && document.red_flags.length > 0) {
        document.red_flags.forEach((flag, i) => {
          // Clean the text and ensure proper formatting
          const cleanFlag = flag.trim();
          addListItem(cleanFlag, i + 1);
        });
      } else {
        addWrappedText('No red flags identified.');
      }
      addSection(10);

      // Legal Terminology
      addWrappedText('LEGAL TERMINOLOGY DETECTED', 14, true);
      if (document.legal_terminology_found && document.legal_terminology_found.length > 0) {
        const terminologyText = document.legal_terminology_found.join(', ');
        addWrappedText(terminologyText);
      } else {
        addWrappedText('No specific legal terminology detected.');
      }
      addSection(10);

      // Risk Indicators
      addWrappedText('RISK INDICATORS FOUND', 14, true);
      if (document.risk_indicators && document.risk_indicators.length > 0) {
        const indicatorsText = document.risk_indicators.join(', ');
        addWrappedText(indicatorsText);
      } else {
        addWrappedText('No specific risk indicators found.');
      }
      addSection(10);

      // Urgency Signals (if any)
      if (document.urgency_signals && document.urgency_signals.length > 0) {
        addWrappedText('URGENCY SIGNALS', 14, true);
        addWrappedText(document.urgency_signals.join(', '));
        addSection(10);
      }

      // Suggested Questions
      addWrappedText('SUGGESTED QUESTIONS', 14, true);
      if (document.suggested_questions && document.suggested_questions.length > 0) {
        document.suggested_questions.forEach((question, i) => {
          addListItem(question, i + 1);
        });
      } else {
        addWrappedText('No suggested questions available.');
      }
      addSection(10);

      // Footer
      addSection(20);
      addHorizontalLine();
      addWrappedText('Generated by AI Legal Doc Explainer v8.0.0', 10);
      addWrappedText('Legal AI System powered by Legal-BERT and Gemini AI', 10);
      addWrappedText(`Report generated on ${new Date().toLocaleString()}`, 10);

      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      
      const result = {
        blob: pdfBlob,
        filename: `legal_analysis_${document.filename.replace('.pdf', '')}_${new Date().toISOString().split('T')[0]}.pdf`,
        document_id: documentId,
        generated_at: now
      };

      console.log('DocumentService: PDF report generated successfully');
      return result;

    } catch (error: any) {
      console.error('DocumentService: PDF report generation failed:', error);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  // Helper method to download the PDF
  downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Batch upload documents
  async batchUpload(files: File[]): Promise<{
    results: Array<{
      filename: string;
      status: 'success' | 'error';
      document_id?: string;
      risk_score?: number;
      summary?: string;
      error?: string;
    }>;
    total_files: number;
    successful_uploads: number;
    failed_uploads: number;
  }> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return apiClient.post('/batch-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Compare documents
  async compareDocuments(documentIds: string[]): Promise<{
    comparison_summary: string;
    key_differences: string[];
    risk_comparison: Record<string, number>;
    recommendations: string[];
  }> {
    return apiClient.post('/compare-documents', { document_ids: documentIds });
  }
}

// Create and export singleton instance
export const documentService = new DocumentService();
export default documentService;