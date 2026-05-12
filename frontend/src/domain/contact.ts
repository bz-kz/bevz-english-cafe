/**
 * Contact Domain Entity
 * 問い合わせに関するドメインロジックとビジネスルールを定義
 */

import { generateUUID } from '@/utils/uuid';

export interface ContactSubmittedEvent {
  type: 'CONTACT_SUBMITTED';
  payload: {
    contactId: string;
    email: string;
    submittedAt: Date;
  };
}

export interface ContactValidationFailedEvent {
  type: 'CONTACT_VALIDATION_FAILED';
  payload: {
    errors: Record<string, string>;
  };
}

export type ContactEvent = ContactSubmittedEvent | ContactValidationFailedEvent;

export class Contact {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly message: string,
    public readonly phone?: string,
    public readonly lessonType?: 'group' | 'private' | 'trial' | 'other',
    public readonly preferredContact: 'email' | 'phone' | 'line' | 'facebook' | 'instagram' = 'email'
  ) {
    this.validate();
  }

  private validate(): void {
    const errors: Record<string, string> = {};

    if (!this.name.trim()) {
      errors.name = 'お名前は必須です';
    }

    if (!this.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!this.isValidEmail(this.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    if (!this.message.trim()) {
      errors.message = 'メッセージは必須です';
    } else if (this.message.length > 1000) {
      errors.message = 'メッセージは1000文字以内で入力してください';
    }

    if (this.phone && !this.isValidPhone(this.phone)) {
      errors.phone = '有効な電話番号を入力してください';
    }

    if (Object.keys(errors).length > 0) {
      throw new ContactValidationError(errors);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // 日本の電話番号形式をチェック
    const phoneRegex = /^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  }

  submit(): ContactSubmittedEvent {
    return {
      type: 'CONTACT_SUBMITTED',
      payload: {
        contactId: generateUUID(),
        email: this.email,
        submittedAt: new Date()
      }
    };
  }

  toApiPayload() {
    return {
      name: this.name,
      email: this.email,
      message: this.message,
      phone: this.phone,
      lessonType: this.lessonType,
      preferredContact: this.preferredContact
    };
  }
}

export class ContactValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super('Contact validation failed');
    this.name = 'ContactValidationError';
  }
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
  phone?: string;
  lessonType?: 'group' | 'private' | 'trial' | 'other';
  preferredContact?: 'email' | 'phone' | 'line' | 'facebook' | 'instagram';
}