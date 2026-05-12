// 共通の型定義 - 問い合わせ関連

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  lessonType?: 'group' | 'private' | 'trial' | 'other';
  preferredContact: 'email' | 'phone' | 'line' | 'facebook' | 'instagram';
}

export interface ContactSubmission extends ContactFormData {
  id: string;
  status: 'pending' | 'responded' | 'archived';
  submittedAt: Date;
  updatedAt: Date;
}

export interface ContactSubmittedEvent {
  type: 'CONTACT_SUBMITTED';
  payload: {
    contactId: string;
    email: string;
    submittedAt: Date;
  };
}

export interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  lessonType?: string;
  preferredContact?: string;
}