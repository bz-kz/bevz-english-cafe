import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const navigation = {
    main: [
      { name: 'ホーム', href: '/' },
      { name: '講師紹介', href: '/instructors' },
      { name: 'レッスン', href: '/lessons' },
      { name: 'お問い合わせ', href: '/contact' },
    ],
    social: [
      {
        name: 'Facebook',
        href: '#',
        icon: (props: React.SVGProps<SVGSVGElement>) => (
          <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path
              fillRule="evenodd"
              d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        name: 'Instagram',
        href: '#',
        icon: (props: React.SVGProps<SVGSVGElement>) => (
          <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path
              fillRule="evenodd"
              d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.316-1.296C4.165 14.81 3.662 13.628 3.662 12.017c0-1.611.503-2.793 1.471-3.675.968-.882 2.119-1.372 3.316-1.372 1.297 0 2.448.49 3.316 1.372.968.882 1.471 2.064 1.471 3.675 0 1.611-.503 2.793-1.471 3.675-.868.806-2.019 1.296-3.316 1.296zm7.718-4.971c0-1.297-.49-2.448-1.296-3.316C14.81 7.733 13.628 7.23 12.017 7.23c-1.611 0-2.793.503-3.675 1.471-.882.968-1.372 2.119-1.372 3.316 0 1.297.49 2.448 1.372 3.316.882.968 2.064 1.471 3.675 1.471 1.611 0 2.793-.503 3.675-1.471.806-.868 1.296-2.019 1.296-3.316z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      {
        name: 'LINE',
        href: '#',
        icon: (props: React.SVGProps<SVGSVGElement>) => (
          <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12.017.572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
        ),
      },
    ],
  };

  return (
    <footer className="bg-gray-900">
      <div className="container-custom">
        <div className="py-12 md:py-16">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            {/* ブランド情報 */}
            <div className="space-y-8 xl:col-span-1">
              <div>
                <span className="text-2xl font-bold text-white">
                  英会話カフェ
                </span>
                <p className="mt-4 text-base text-gray-300">
                  ネイティブ講師との楽しい英会話レッスンで、
                  あなたの英語力を向上させませんか？
                  初心者から上級者まで対応しています。
                </p>
              </div>
              <div className="flex space-x-6">
                {navigation.social.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <span className="sr-only">{item.name}</span>
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>

            {/* ナビゲーションとアクセス情報 */}
            <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  ナビゲーション
                </h3>
                <ul className="mt-4 space-y-4">
                  {navigation.main.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-base text-gray-300 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  アクセス情報
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-base text-gray-300">
                      〒150-0001<br />
                      東京都渋谷区神宮前1-2-3<br />
                      英会話カフェビル 2F
                    </p>
                  </div>
                  <div>
                    <p className="text-base text-gray-300">
                      TEL: 03-1234-5678<br />
                      Email: info@english-cafe.com
                    </p>
                  </div>
                  <div>
                    <p className="text-base text-gray-300">
                      営業時間:<br />
                      平日 10:00-22:00<br />
                      土日祝 10:00-20:00
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-700 pt-8">
            <p className="text-base text-gray-400 xl:text-center">
              &copy; {currentYear} 英会話カフェ. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;