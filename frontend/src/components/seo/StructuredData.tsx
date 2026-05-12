/**
 * Structured Data Component
 * 構造化データ（JSON-LD）を埋め込むためのコンポーネント
 */

interface StructuredDataProps {
  data: object;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, null, 2),
      }}
    />
  );
}

// 講師用構造化データ
export function InstructorStructuredData({ instructor }: { instructor: any }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: instructor.name,
    alternateName: instructor.nameJapanese,
    jobTitle: '英会話講師',
    worksFor: {
      '@type': 'EducationalOrganization',
      name: '英会話カフェ'
    },
    nationality: instructor.nationality,
    knowsLanguage: instructor.languages,
    hasCredential: instructor.certifications,
    description: instructor.introduction,
    image: instructor.photo,
    aggregateRating: instructor.rating ? {
      '@type': 'AggregateRating',
      ratingValue: instructor.rating,
      reviewCount: instructor.reviewCount,
      bestRating: 5,
      worstRating: 1
    } : undefined
  };

  return <StructuredData data={structuredData} />;
}

// レッスン用構造化データ
export function LessonStructuredData({ lesson }: { lesson: any }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: lesson.title,
    description: lesson.description,
    provider: {
      '@type': 'EducationalOrganization',
      name: '英会話カフェ'
    },
    courseMode: lesson.type === 'online' ? 'online' : 'onsite',
    educationalLevel: lesson.level.join(', '),
    timeRequired: `PT${lesson.duration}M`,
    offers: {
      '@type': 'Offer',
      price: lesson.price.amount,
      priceCurrency: lesson.price.currency,
      availability: 'https://schema.org/InStock'
    },
    image: lesson.image,
    coursePrerequisites: lesson.requirements?.join(', '),
    teaches: lesson.features?.join(', ')
  };

  return <StructuredData data={structuredData} />;
}

// FAQ用構造化データ
export function FAQStructuredData({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };

  return <StructuredData data={structuredData} />;
}

// レビュー用構造化データ
export function ReviewStructuredData({ reviews }: { reviews: any[] }) {
  const structuredData = reviews.map(review => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: review.studentName
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1
    },
    reviewBody: review.comment,
    datePublished: review.submittedAt,
    itemReviewed: {
      '@type': 'EducationalOrganization',
      name: '英会話カフェ'
    }
  }));

  return (
    <>
      {structuredData.map((data, index) => (
        <StructuredData key={index} data={data} />
      ))}
    </>
  );
}