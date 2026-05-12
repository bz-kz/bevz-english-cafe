/**
 * Google Analytics Component
 * Google Analytics 4 (GA4) の設定
 */

'use client';

import Script from 'next/script';

interface GoogleAnalyticsProps {
  measurementId: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  if (!measurementId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        id="gtag-script"
      >
        {`
          (function() {
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=${measurementId}';
            document.head.appendChild(script);
          })();
        `}
      </Script>
      <Script
        id="google-analytics"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}

// イベント追跡用のヘルパー関数
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

// よく使用されるイベント追跡関数
export const trackContactFormSubmit = (formType: string) => {
  trackEvent('contact_form_submit', {
    form_type: formType,
    event_category: 'engagement',
    event_label: 'Contact Form'
  });
};

export const trackLessonInquiry = (lessonType: string) => {
  trackEvent('lesson_inquiry', {
    lesson_type: lessonType,
    event_category: 'engagement',
    event_label: 'Lesson Inquiry'
  });
};

export const trackVideoPlay = (videoId: string, videoTitle: string) => {
  trackEvent('video_play', {
    video_id: videoId,
    video_title: videoTitle,
    event_category: 'engagement',
    event_label: 'Video Play'
  });
};

export const trackInstructorView = (instructorName: string) => {
  trackEvent('instructor_view', {
    instructor_name: instructorName,
    event_category: 'engagement',
    event_label: 'Instructor Profile View'
  });
};

// TypeScript用のgtag型定義
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}