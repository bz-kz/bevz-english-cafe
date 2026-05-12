/**
 * Contact Form Validation Schema (zod)
 *
 * Mirror of backend `app/api/schemas/contact.py` (Pydantic).
 * If you change constraints here, update the other file.
 *
 * 単一の真実 (single source of truth) として `ContactForm.tsx` から参照される。
 */

import { z } from 'zod';

export const lessonTypeEnum = z.enum([
  'group',
  'private',
  'online',
  'trial',
  'business',
  'toeic',
  'other',
]);

export const preferredContactEnum = z.enum([
  'email',
  'phone',
  'line',
  'facebook',
  'instagram',
]);

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(1, '名前を入力してください')
    .max(100, '名前は100文字以内で入力してください'),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('正しいメールアドレスを入力してください')
    .max(255, 'メールアドレスは255文字以内で入力してください'),
  phone: z
    .string()
    .regex(
      /^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$/,
      '電話番号の形式が正しくありません'
    )
    .optional()
    .or(z.literal('')),
  lessonType: lessonTypeEnum.or(z.literal('')),
  preferredContact: preferredContactEnum,
  message: z
    .string()
    .min(10, 'メッセージは10文字以上で入力してください')
    .max(1000, 'メッセージは1000文字以内で入力してください'),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type LessonTypeValue = z.infer<typeof lessonTypeEnum>;
export type PreferredContactValue = z.infer<typeof preferredContactEnum>;
